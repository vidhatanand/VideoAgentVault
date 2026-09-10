import fs from 'node:fs/promises';
import {setTimeout as pause} from 'node:timers/promises';
import {CliError} from '../errors/index.js';
import {atomicJSON} from '../config/profile.js';
export async function watch(client: any,workspace: string,id: string | undefined,flags: any,events=false){
 if(!id)throw new CliError('JOB_ID_REQUIRED','Use --id with the job identifier.');
 const seconds=Number(flags.timeout||3600),interval=Number(flags.interval||2);if(!Number.isFinite(seconds)||seconds<=0||seconds>86400||!Number.isFinite(interval)||interval<0.1||interval>60)throw new CliError('WATCH_BOUNDS','Use a timeout from 0 to 86400 seconds (exclusive of 0) and interval from 0.1 to 60 seconds.');
 let cursor=0,stopped=false,last='';const controller=new AbortController();const stop=()=>{stopped=true;controller.abort();};
 if(flags['cursor-file']){try{const saved=JSON.parse(await fs.readFile(flags['cursor-file'],'utf8'));if(saved.origin!==client.origin||saved.workspace!==workspace||saved.jobId!==id)throw new CliError('CURSOR_MISMATCH','Cursor belongs to another job or endpoint.');if(!Number.isSafeInteger(saved.cursor)||saved.cursor<0)throw new CliError('CURSOR_INVALID','Saved cursor must be a nonnegative integer.');cursor=saved.cursor;}catch(e){if(e.code!=='ENOENT')throw e;}}
 const deadline=Date.now()+seconds*1000;const timer=setTimeout(()=>controller.abort(),seconds*1000);
 process.once('SIGINT',stop);
 try{while(Date.now()<deadline&&!stopped){
  const value=await client.call(workspace,events?'job_events':'job_get',events?{jobId:id,cursor}:{jobId:id},true,controller.signal);
  if(events){for(const event of value.items)process.stdout.write(JSON.stringify({type:'job.event',...event})+'\n');cursor=value.nextCursor;if(flags['cursor-file'])await atomicJSON(flags['cursor-file'],{origin:client.origin,workspace,jobId:id,cursor});if(value.terminal&&!value.items.length)return {jobId:id,cursor,terminal:true};}
  else{const signature=JSON.stringify([value.state,value.progress]);if(signature!==last){last=signature;if(flags.jsonl)process.stdout.write(JSON.stringify({type:'job.progress',jobId:id,state:value.state,progress:value.progress})+'\n');else process.stderr.write(`${id}: ${value.state} ${JSON.stringify(value.progress??{eta:null})}\n`);}if(['succeeded','failed','cancelled'].includes(value.state)){if(value.state!=='succeeded')throw new CliError('JOB_'+value.state.toUpperCase(),'Job finished without success. Inspect jobs get for retained diagnostics.',7);return value;}}
  await pause(interval*1000,undefined,{signal:controller.signal});
 }if(stopped)return {jobId:id,watcherStopped:true,serverJobCancelled:false,cursor};throw new CliError('WATCH_TIMEOUT','Watch timed out; the server job was not cancelled. Resume watching the same job.',9);
 }catch(error){if(stopped)return {jobId:id,watcherStopped:true,serverJobCancelled:false,cursor};if(controller.signal.aborted)throw new CliError('WATCH_TIMEOUT','Watch timed out; the server job was not cancelled. Resume watching the same job.',9);throw error;}finally{clearTimeout(timer);process.removeListener('SIGINT',stop);}
}
