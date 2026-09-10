import {json,now} from '../util.js';
import {safeDiagnostics,startupDiagnostics} from './diagnostics.js';

/** Advance one bounded startup step. A persisted dispatch intent is never sent twice. */
export async function startContainer(owner,input){
 const {storage,container}=owner.ctx;let stage='startup_intent';
 const existing=await storage.get('job');
 if(existing&&existing!==input.id)return json({error:'CONTAINER_JOB_MISMATCH'},409);
 if(await storage.get('stopped'))return json({error:'CONTAINER_STOPPED'},409);
 if(await storage.get('startupFailure'))return json({error:await storage.get('startupFailure'),diagnostics:await storage.get('diagnostics')},503);
 // Old DOs have no startup input: their dispatch outcome must be observed, not repeated.
 if((existing&&!await storage.get('startupInput'))||await storage.get('dispatchSent'))return json({accepted:true,observationOnly:true},202);
 try{
  if(!existing){
   const started=now();await storage.put({job:input.id,started,deadline:started+(input.maxWallSeconds+60)*1000,startupInput:input});
   await storage.setAlarm(started+(input.maxWallSeconds+60)*1000);
   stage='container_start';await storage.put('diagnostics',startupDiagnostics(stage));
   container.start({enableInternet:true});
  }
  stage='container_monitor';owner.observeLifecycle();
  stage='port_health';const port=container.getTcpPort(8080);
  // One read per queue tick, with a short timeout: never hold the DO gate through cold start.
  let health;
  try{health=await port.fetch('http://container/health',{signal:AbortSignal.timeout(3000)});}
  catch(error){await storage.put('diagnostics',startupDiagnostics(stage,error,'CONTAINER_NOT_READY'));return json({accepted:true,starting:true},202);}
  if(!health.ok){await health.body?.cancel();await storage.put('diagnostics',{...startupDiagnostics(stage,null,'CONTAINER_NOT_READY'),httpStatus:health.status});return json({accepted:true,starting:true},202);}
  stage='health_identity';const identity=await health.json();
  if(owner.env.PROCESSOR_RELEASE&&identity.processorRelease!==owner.env.PROCESSOR_RELEASE){
   await storage.put({startupFailure:'PROCESSOR_RELEASE_MISMATCH',diagnostics:startupDiagnostics(stage,null,'PROCESSOR_RELEASE_MISMATCH')});
   return json({error:'PROCESSOR_RELEASE_MISMATCH',diagnostics:await storage.get('diagnostics')},503);
  }
  stage='processor_dispatch';
  // Persist intent BEFORE the POST. A lost acknowledgement leads only to status observation.
  await storage.put({dispatchSent:true,diagnostics:startupDiagnostics(stage)});
  try{
   const response=await port.fetch('http://container/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(5000)});
   await response.body?.cancel();
   if(!response.ok){const code='PROCESSOR_DISPATCH_REJECTED';await storage.put({startupFailure:code,diagnostics:{...startupDiagnostics(stage,null,code),httpStatus:response.status}});return json({error:code,diagnostics:await storage.get('diagnostics')},503);}
   await storage.put('diagnostics',startupDiagnostics('processor_accepted'));return json({accepted:true},202);
  }catch(error){await storage.put('diagnostics',startupDiagnostics(stage,error,'PROCESSOR_DISPATCH_UNCERTAIN'));return json({accepted:true,observationOnly:true},202);}
 }catch(error){
  const code='CONTAINER_STARTUP_FAILED',diagnostics=startupDiagnostics(stage,error,code);
  await storage.put({startupFailure:code,diagnostics});return json({error:code,diagnostics:safeDiagnostics(diagnostics)},503);
 }
}
