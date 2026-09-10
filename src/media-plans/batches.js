import {scopedContext,flushScoped} from '../processing/scoped-context.js';
import {validateTimelines} from './timelines.js';
import {tenantAuth,isSuper} from '../auth.js';
import {bindKey,agentOnly,policyOps,assertion,permission} from '../access/policy.js';
import {requireVideo} from '../library.js';
import {getRecipe} from './recipes.js';
import {validateInputs} from './reuse.js';
import {createJob,quoteJob,getJob,cancelJob} from '../jobs.js';
import {uid,now,text,integer,hash,canonicalJSON,fail} from '../util.js';

export async function getBatch(c,tid,id){
 await tenantAuth(c,tid);const batch=await c.db.one('SELECT * FROM media_batches WHERE id=? AND tenant_id=?',[id,tid]);
 if(!batch||agentOnly(c)&&batch.agent_id!==c.actor.agentId)fail(404,'BATCH_NOT_FOUND');
 await getRecipe(c,tid,batch.recipe_id);
 const items=await c.db.all('SELECT ordinal,state,job_id,charge_micros,reused FROM media_batch_items WHERE batch_id=? ORDER BY ordinal',[id]);
 return {id,recipeId:batch.recipe_id,state:batch.state,budgetMicros:batch.budget_micros,spentMicros:batch.spent_micros,deadlineAt:batch.deadline_at,lastError:batch.last_error,completed:items.filter(x=>x.state==='succeeded').length,total:items.length,items};
}
export async function startBatch(c,tid,b){
 await tenantAuth(c,tid,'processing:write','editor');permission(c,'cancel');const key=text(b.requestKey,'requestKey',160),requestHash=await hash(canonicalJSON(b));
 const old=await c.db.one('SELECT id,request_hash FROM media_batches WHERE tenant_id=? AND request_key=?',[tid,key]);
 if(old){if(old.request_hash!==requestHash)fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return getBatch(c,tid,old.id);}
 const recipe=await getRecipe(c,tid,b.recipeId);await validateInputs(c,recipe.inputs);await validateTimelines(c,tid,recipe.variants);
 const budget=integer(b.budgetMicros,'budgetMicros',1,100000000),id=uid('batch_'),time=now();
 const quotes=[];for(const spec of recipe.variants)quotes.push(await quoteJob(c,tid,spec));
 const required=quotes.reduce((n,q)=>n+q.reserveMicros,0);if(budget<required)fail(400,'BATCH_BUDGET_TOO_LOW',`All variants require an authorization ceiling of ${required} credit micros.`);
 const ops=[...policyOps(c),['INSERT INTO media_batches(id,tenant_id,recipe_id,agent_id,key_id,session_id,actor_email,request_key,request_hash,budget_micros,deadline_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,tid,recipe.id,c.actor.agentId||null,c.actor.keyId||null,c.actor.sessionId||null,c.actor.email,key,requestHash,budget,time+integer(b.deadlineSeconds??7200,'deadlineSeconds',60,14400)*1000,time,time]]];
 recipe.variants.forEach((spec,i)=>ops.push(['INSERT INTO media_batch_items(batch_id,ordinal,spec_json) VALUES(?,?,?)',[id,i,canonicalJSON({...spec,budgetMicros:quotes[i].reserveMicros})]]));
 await c.db.batch(ops);return getBatch(c,tid,id);
}
export async function stopBatch(c,tid,id){
 await tenantAuth(c,tid,'processing:write','editor');permission(c,'cancel');const b=await getBatch(c,tid,id);if(['succeeded','failed','cancelled'].includes(b.state))return b;
 await c.db.batch([...policyOps(c),['UPDATE media_batches SET state=\'cancelling\',updated_at=? WHERE id=? AND state IN (\'queued\',\'running\')',[now(),id]]]);
 return getBatch(c,tid,id);
}
export async function principal(c,b){
 if(b.key_id){await bindKey(c,b.key_id);if(c.actor.agentId!==b.agent_id)fail(403,'BATCH_AGENT_CHANGED');}
 else {const s=await c.db.one('SELECT email FROM sessions WHERE id=? AND revoked_at IS NULL AND expires_at>?',[b.session_id,now()]);if(!s||s.email!==b.actor_email)fail(401,'BATCH_SESSION_EXPIRED');c.actor={type:'session',email:s.email,sessionId:b.session_id,super:isSuper(c.env,s.email)};}
 await tenantAuth(c,b.tenant_id,'processing:write','editor');
}
// One bounded serial producer. Every dispatch is persisted before creating its idempotent job.
export async function recoverBatches(context){
 const batches=await context.db.all("SELECT * FROM media_batches WHERE state IN ('queued','running','cancelling') AND lease_until<? ORDER BY created_at LIMIT 20",[now()]);
 for(const b of batches){const c=scopedContext(context,'batch'),token=uid('lease_');
  const lease=await c.db.run('UPDATE media_batches SET lease_until=?,lease_token=? WHERE id=? AND lease_until<?',[now()+120000,token,b.id,now()]);if(!lease.meta.changes)continue;
  const fence=()=>assertion('EXISTS(SELECT 1 FROM media_batches WHERE id=? AND lease_token=? AND lease_until>?)',[b.id,token,now()]);
  try{
   await principal(c,b);const recipe=await getRecipe(c,b.tenant_id,b.recipe_id);await validateInputs(c,recipe.inputs);await validateTimelines(c,b.tenant_id,recipe.variants);
   const items=await c.db.all('SELECT * FROM media_batch_items WHERE batch_id=? ORDER BY ordinal',[b.id]);let spent=0,active=false,failed=false;
   for(const item of items){if(!item.job_id)continue;const job=await getJob(c,item.job_id);if(!job.finished_at){active=true;if(b.state==='cancelling'||now()>b.deadline_at)await cancelJob(c,job.id);continue;}
    const charge=job.result?.provisionalTenantChargeMicros||0;spent+=charge;failed ||= job.state!=='succeeded';
    await c.db.batch([...fence(),['UPDATE media_batch_items SET state=?,charge_micros=? WHERE batch_id=? AND ordinal=?',[job.state,charge,b.id,item.ordinal]]]);
   }
   if(active)continue;
   const next=items.find(x=>!x.job_id);let state=b.state==='cancelling'?'cancelled':failed||now()>b.deadline_at?'failed':next?'running':'succeeded';
   await c.db.batch([...fence(),['UPDATE media_batches SET state=?,spent_micros=?,updated_at=? WHERE id=? AND state=?',[state,spent,now(),b.id,b.state]]]);
   if(state!=='running')continue;
   let dispatch=next.dispatch_json?JSON.parse(next.dispatch_json):null;
   if(!dispatch){const spec=JSON.parse(next.spec_json),v=spec.videoId?await requireVideo(c,spec.videoId,'processing:write','editor'):null;if(spent+spec.budgetMicros>b.budget_micros)fail(409,'BATCH_BUDGET_EXHAUSTED');dispatch={...spec,...(v?{expectedRevision:v.revision}:{}),requestKey:`${b.id}:${next.ordinal}`};
    await c.db.batch([...fence(),...policyOps(c),['UPDATE media_batch_items SET dispatch_json=? WHERE batch_id=? AND ordinal=? AND dispatch_json IS NULL',[canonicalJSON(dispatch),b.id,next.ordinal]]]);
   }
   // Cancellation fences new work. A job created during an overlapping stop is retained and cancelled next recovery.
   if((await c.db.one('SELECT state FROM media_batches WHERE id=?',[b.id])).state!=='running')continue;
   const job=await createJob(c,b.tenant_id,dispatch,jid=>[...fence(),...assertion("EXISTS(SELECT 1 FROM media_batches WHERE id=? AND state='running')",[b.id]),['UPDATE media_batch_items SET job_id=?,state=\'queued\' WHERE batch_id=? AND ordinal=?',[jid,b.id,next.ordinal]]]);
   await c.db.batch([...fence(),['UPDATE media_batch_items SET job_id=?,state=? WHERE batch_id=? AND ordinal=?',[job.id,job.state,b.id,next.ordinal]]]);
  }catch(error){await c.db.run("UPDATE media_batches SET state='failed',last_error=?,updated_at=? WHERE id=? AND lease_token=?",[error.code||'BATCH_EXECUTION_FAILED',now(),b.id,token]);}
  finally{await c.db.run('UPDATE media_batches SET lease_until=0 WHERE id=? AND lease_token=?',[b.id,token]);await flushScoped(c);}
 }
 return batches.length;
}

export async function listBatches(c,tid){await tenantAuth(c,tid);const rows=await c.db.all('SELECT id FROM media_batches WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',[tid]),items=[];for(const r of rows)try{items.push(await getBatch(c,tid,r.id));}catch(e){if(![403,404].includes(e.status))throw e;}return {items};}
