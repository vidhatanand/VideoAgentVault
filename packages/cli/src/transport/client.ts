import {CliError,statusExit} from '../errors/index.js';
import {setTimeout as pause} from 'node:timers/promises';
export function checkedEndpoint(value: string,dev=false){let u;try{u=new URL(value);}catch{throw new CliError('ENDPOINT_INVALID','Supply an absolute HTTPS endpoint.');}if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new CliError('ENDPOINT_INVALID','Endpoint must be an origin without credentials, query or path.');if(u.protocol!=='https:'&&!(dev&&u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new CliError('HTTPS_REQUIRED','Remote endpoints require HTTPS; loopback HTTP requires --dev.');return u.origin;}
export class Client {
 origin: string; key: string; version: string;
 constructor(origin: string,key: string,version: string){this.origin=origin;this.key=key;this.version=version;}
 async request(route: string,{method='GET',body,raw=false,readOnly=method==='GET',signal}: any={}){
  if(!route.startsWith('/')||route.startsWith('//'))throw new CliError('PATH_INVALID','Use a relative API path.');
  for(let attempt=0;attempt<3;attempt++){
   let r;try{r=await fetch(this.origin+route,{method,redirect:'manual',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':raw?'application/octet-stream':'application/json','X-VideoAgentVault-Contract':this.version},body:body===undefined?undefined:raw?body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});}catch{if(signal?.aborted)throw new CliError('READ_ABORTED','Read stopped without cancelling server work.',8);if(readOnly&&attempt<2){await pause(250*2**attempt,undefined,{signal});continue;}throw new CliError('TRANSPORT_UNKNOWN',readOnly?'Read failed after bounded retries.':'Mutation outcome unknown. Reconcile using the saved request; do not create a new request key.',8);}
   if(r.status>=300&&r.status<400){await r.body?.cancel();throw new CliError('REDIRECT_REJECTED','API redirect rejected; credentials were not forwarded.',8);}
   if(readOnly&&[429,502,503,504].includes(r.status)&&attempt<2){const delay=r.headers.get('retry-after'),seconds=Number(delay);const ms=delay?(Number.isFinite(seconds)?seconds*1000:Date.parse(delay)-Date.now()):250*2**attempt;await r.body?.cancel();if(!Number.isFinite(ms)||ms>30000)throw new CliError('RETRY_LATER','Server requested a longer delay. Retry this read later.',8);await pause(Math.max(0,ms),undefined,{signal});continue;}
   let result;try{result=await r.json();}catch{throw new CliError('RESPONSE_INVALID','Server did not return the expected JSON contract.',8);}
   if(!r.ok){const code=/^[A-Z0-9_]+$/.test(result.error?.code||'')?result.error.code:'HTTP_ERROR';throw new CliError(code,`Request rejected (${r.status}, ${code}).`,statusExit(r.status,code));}return result;
  }
 }
 async call(workspace: string,name: string,args: unknown,readOnly=false,signal?: AbortSignal){return this.request(`/api/tenants/${encodeURIComponent(workspace)}/operations/${encodeURIComponent(name)}`,{method:'POST',body:args,readOnly,signal});}
}
