import {OPERATIONS,CONTRACT_VERSION} from './catalogue.js';
import {authenticate,tenantAuth} from '../auth.js';
import {validate} from '../mcp/validate.js';
import {fail} from '../util.js';
export function contractRoutes(route,body){
 route('POST','/api/tenants/:tid/operations/:operation',async(c,p)=>{
  const actor=await authenticate(c);if(actor.type!=='key')fail(403,'API_KEY_REQUIRED');
  const expected=c.req.headers.get('X-VideoAgentVault-Contract');if(expected&&expected!==CONTRACT_VERSION)fail(409,'CONTRACT_VERSION_MISMATCH');
  const op=OPERATIONS.find(t=>t.name===p.operation);if(!op)fail(404,'OPERATION_NOT_FOUND');
  await tenantAuth(c,p.tid,op.scope,'viewer');const args=await body(c);validate(op.inputSchema,args);return op.fn(c,p.tid,args);
 });
}
