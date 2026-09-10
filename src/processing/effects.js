import {hash,canonicalJSON,now,fail} from '../util.js';
/** Persist intent before an external paid effect. An ambiguous result is never retried automatically. */
export async function modelEffect(c,j,model,input){
 if(!c.effectUnit)return c.env.AI.run(model,input);
 if(!j?.id||!j.tenant_id)fail(409,'PERSISTED_JOB_REQUIRED');
 const inputHash=await hash(canonicalJSON({model,input})),id='fx_'+await hash(`${j.id}:${c.effectUnit}:${c.effectStage||""}:${inputHash}`);
 const old=await c.db.one('SELECT * FROM processing_effects WHERE id=?',[id]);
 if(old){if(old.input_hash!==inputHash)fail(409,'EFFECT_INPUT_CHANGED');if(old.state!=='completed')fail(409,'PAID_EFFECT_OUTCOME_UNKNOWN','The model call may have completed before its receipt was saved. Review provider usage before explicitly starting another job.');return JSON.parse(old.output_json);}
 await c.db.run("INSERT INTO processing_effects(id,tenant_id,job_id,input_hash,state,created_at) VALUES(?,?,?,?,'started',?)",[id,j.tenant_id,j.id,inputHash,now()]);
 const output=await c.env.AI.run(model,input),json=JSON.stringify(output);
 if(json.length>800000)fail(502,'MODEL_RECEIPT_TOO_LARGE');
 await c.db.run("UPDATE processing_effects SET state='completed',output_json=?,completed_at=? WHERE id=?",[json,now(),id]);
 return output;
}
export async function effectChargeId(c,j,metric,suffix){return c.effectUnit?'cost_'+await hash(canonicalJSON({job:j.id,unit:c.effectUnit,stage:c.effectStage||'',metric,suffix})):undefined;}
