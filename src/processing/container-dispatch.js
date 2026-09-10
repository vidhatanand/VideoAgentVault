import {startupDiagnostics,safeDiagnostics,processorFailure} from './diagnostics.js';
import {fail} from '../util.js';

/** A lost DO acknowledgement is observed via /status, never automatically re-dispatched. */
export async function dispatchContainer(c,j,stub,input){
 let response;
 try{response=await stub.fetch('http://container/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});}
 catch(error){
  await c.db.run('UPDATE jobs SET result_json=? WHERE id=?',[JSON.stringify({diagnostics:startupDiagnostics('container_rpc',error,'CONTAINER_RPC_UNCERTAIN')}),j.id]);
  return;
 }
 if(response.ok){await response.body?.cancel();return;}
 let value;try{value=await response.json();}catch{}
 const diagnostics=safeDiagnostics(value?.diagnostics)||{...startupDiagnostics('container_rpc',null,'CONTAINER_START_FAILED'),httpStatus:response.status};
 await c.db.run('UPDATE jobs SET result_json=? WHERE id=?',[JSON.stringify({diagnostics}),j.id]);
 fail(502,value?.error?processorFailure(value.error):'CONTAINER_START_FAILED');
}
