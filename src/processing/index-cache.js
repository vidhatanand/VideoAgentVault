import {hash,canonicalJSON,now,fail} from '../util.js';
import {bytesHash} from '../artifacts/fingerprint.js';
import {policyOps} from '../access/policy.js';
import {MODELS} from '../ai/models.js';
export async function unitCacheKey(c,j,v,unit,bytes,state){
 const source=await c.db.one('SELECT s.* FROM job_source_versions b JOIN source_versions s ON s.id=b.source_version_id WHERE b.job_id=? AND s.video_id=?',[j.id,v.id]);
 // Unknown historical content never produces a claim of cache equality.
 if(!source?.fingerprint)return null;
 const id='ic_'+await hash(canonicalJSON({source:source.id,fingerprint:source.fingerprint,content:await bytesHash(bytes),start:unit.start,end:unit.end,type:unit.type,silence:unit.silence||[],models:MODELS,prompt:state.visualPrompt||'',translate:!!state.translateEnglish,release:c.env.RELEASE_SHA||'local',actor:j.agent_id||j.key_id||'workspace-members'}));
 return {id,sourceVersionId:source.id};
}
export async function reuseUnit(c,j,v,index,key){
 if(!key)return false;const old=await c.db.one('SELECT * FROM index_unit_cache WHERE id=? AND tenant_id=? AND video_id=?',[key.id,j.tenant_id,v.id]);if(!old)return false;
 for(const id of JSON.parse(old.artifact_ids_json)){if(!await c.db.one('SELECT id FROM artifacts WHERE id=? AND video_id=? AND tenant_id=?',[id,v.id,j.tenant_id]))fail(409,'CACHED_EVIDENCE_UNAVAILABLE');}
 await c.db.batch([...policyOps(c),['INSERT INTO index_unit_receipts(job_id,unit_index,cache_id,reused,created_at) VALUES(?,?,?,1,?) ON CONFLICT(job_id,unit_index) DO NOTHING',[j.id,index,key.id,now()]]]);return true;
}
export async function completeUnit(c,j,v,index,unit,key){
 if(!key)return;const rows=await c.db.all('SELECT id FROM artifacts WHERE job_id=? AND video_id=? AND layer=? AND start_seconds>=? AND end_seconds<=? ORDER BY start_seconds,id',[j.id,v.id,unit.type==='audio'?'transcript':'visual',unit.start,unit.end]);
 await c.db.batch([...policyOps(c),['INSERT INTO index_unit_cache(id,tenant_id,video_id,source_version_id,producer_job_id,artifact_ids_json,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',[key.id,j.tenant_id,v.id,key.sourceVersionId,j.id,JSON.stringify(rows.map(x=>x.id)),now()]],['INSERT INTO index_unit_receipts(job_id,unit_index,cache_id,reused,created_at) VALUES(?,?,?,0,?) ON CONFLICT(job_id,unit_index) DO NOTHING',[j.id,index,key.id,now()]]]);
}
export async function reusedTranscript(c,j,v){return c.db.all(`SELECT DISTINCT a.* FROM index_unit_receipts r JOIN index_unit_cache u ON u.id=r.cache_id JOIN json_each(u.artifact_ids_json) ids JOIN artifacts a ON a.id=ids.value WHERE r.job_id=? AND a.video_id=? AND a.layer='transcript' ORDER BY a.start_seconds,a.id`,[j.id,v.id]);}
