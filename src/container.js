import {startContainer} from './processing/container-startup.js';
import {json,now} from './util.js';
import {safeProgress} from './processing/progress.js';
import {processorFailure,safeDiagnostics} from './processing/diagnostics.js';

/** One durable lifecycle per job. Never restart an ambiguous paid invocation. */
export class MediaContainer {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  if(!this.ctx.container)return json({error:'Container binding missing'},503);
  return this.ctx.blockConcurrencyWhile(async()=>{
   const path=new URL(request.url).pathname;
   if(path==='/run')return this.run(await request.json());
   if(path==='/status')return json(await this.status());
   if(path==='/cancel'){await this.stop();return json({ok:true});}
   return json({error:'Not found'},404);
  });
 }
 observeLifecycle(){
  if(this.monitorTask)return;
  const record=error=>this.ctx.blockConcurrencyWhile(async()=>{
   const storage=this.ctx.storage;
   if(await storage.get('receipt')||await storage.get('completed')||await storage.get('stopped'))return;
   const diagnostics={...await storage.get('diagnostics'),runtimeExit:error?'CONTAINER_RUNTIME_ERROR':'CONTAINER_EXITED',runtimeExitedAt:now()};
   // Only a numeric exit code is retained; raw runtime messages may contain capabilities.
   const match=error&&/exit code[: ]+(-?\d+)/i.exec(String(error.message||''));
   if(match)diagnostics.runtimeExitCode=Number(match[1]);
   await storage.put('diagnostics',safeDiagnostics(diagnostics));
  });
  this.monitorTask=this.ctx.container.monitor().then(()=>record(null),record);
  this.ctx.waitUntil(this.monitorTask);
 }
 async run(input){return startContainer(this,input);}
 async stop(){
  await this.ctx.container.destroy();
  await this.ctx.storage.put('stopped',true);
  await this.ctx.storage.deleteAlarm();
 }
 async complete(value){
  const storage=this.ctx.storage;
  // Save the processor receipt before teardown, including across DO eviction.
  value={...value,diagnostics:safeDiagnostics(value.diagnostics||await storage.get('diagnostics')),progress:safeProgress(value.progress||await storage.get('progress'))};
  await storage.put('receipt',value);
  try{await this.stop();}catch{
   await storage.setAlarm(now()+15000);
   return {state:'running',detail:'CONTAINER_CLEANUP_PENDING',progress:{stage:'cleanup',updatedAt:now()}};
  }
  const started=await storage.get('started');
  const completed={...value,lifecycleSeconds:Math.max(0,(now()-(started||now()))/1000)};
  await storage.put('completed',completed);
  return completed;
 }
 async status(){
  const storage=this.ctx.storage;
  const completed=await storage.get('completed');if(completed)return completed;
  const receipt=await storage.get('receipt');if(receipt)return this.complete(receipt);
  if(await storage.get('stopped'))return this.complete({state:'failed',error:'CONTAINER_STOPPED'});
  const deadline=await storage.get('deadline');
  if(!deadline||now()>=deadline)return this.complete({state:'failed',error:'PROCESSING_DEADLINE_EXCEEDED'});
  const startupFailure=await storage.get('startupFailure');
  if(startupFailure)return this.complete({state:'failed',error:startupFailure});
  const input=await storage.get('startupInput');
  if(input&&!await storage.get('dispatchSent')){
   const diagnostics=await storage.get('diagnostics');if(diagnostics?.runtimeExit)return this.complete({state:'failed',error:diagnostics.runtimeExit,diagnostics});
   const response=await this.run(input);const value=await response.json();
   if(!response.ok)return this.complete({state:'failed',error:processorFailure(value.error),diagnostics:value.diagnostics});
   return {state:'starting',diagnostics:await storage.get('diagnostics')};
  }
  this.observeLifecycle();
  let observationKind='transport',httpStatus;
  try{
   // A lifecycle hint is not a processor receipt. Query the port even when
   // running is false; reconnecting the DO must not discard completed work.
   const response=await this.ctx.container.getTcpPort(8080).fetch('http://container/status',{signal:AbortSignal.timeout(10000)});
   httpStatus=response.status;observationKind='http';
   if(!response.ok)throw new Error('Status unavailable');
   observationKind='body';
   const value=await response.json();
   if(!value.id&&value.state==='starting')return this.complete({state:'failed',error:'PROCESSOR_STATE_LOST'});
   observationKind='identity';
   if(value.id!==await storage.get('job'))throw new Error('Status job mismatch');
   const diagnostics={...safeDiagnostics(value.diagnostics),lastObservedAt:now()};
   await storage.put('diagnostics',diagnostics);
   if(safeProgress(value.progress))await storage.put('progress',safeProgress(value.progress));
   if(['done','failed'].includes(value.state)){
    if(value.state==='failed')value.error=processorFailure(value.error);
    return this.complete(value);
   }
   if(!['running','starting'].includes(value.state))throw new Error('Invalid processor status');
   return {state:value.state,progress:safeProgress(value.progress),diagnostics:safeDiagnostics(value.diagnostics)};
  }catch{
   // Retry observation only, bounded by the original alarm. Never rerun work.
   const previous=await storage.get('diagnostics')||{};
   const diagnostics={...previous,observationError:'PROCESSOR_STATUS_UNAVAILABLE',observationKind,httpStatus,observationFailures:(previous.observationFailures||0)+1};
   await storage.put('diagnostics',safeDiagnostics(diagnostics));
   if(previous.runtimeExit)return this.complete({state:'failed',error:previous.runtimeExit,diagnostics});
   return {state:'running',detail:'PROCESSOR_STATUS_UNAVAILABLE',diagnostics,progress:await storage.get('progress')};
  }
 }
 async alarm(){
  return this.ctx.blockConcurrencyWhile(async()=>{
   if(await this.ctx.storage.get('completed'))return;
   const receipt=await this.ctx.storage.get('receipt');
   await this.complete(receipt||{state:'failed',error:'PROCESSING_DEADLINE_EXCEEDED'});
  });
 }
}
