import {createJob,getJob} from '../jobs.js';
import {requireVideo} from '../library.js';
import {captureVersion,requireVersion} from '../evidence/versions.js';
import {tenantAuth} from '../auth.js';
import {checkRevision,policyOps} from '../access/policy.js';
import {hash,canonicalJSON,text,fail,now} from '../util.js';
import {MODELS} from '../ai/models.js';

export async function inputSnapshot(c,vid){
 const v=await requireVideo(c,vid),version=await captureVersion(c,v);
 const tracks=await c.db.all("SELECT id,revision,source_video_id,cues_json,is_default FROM media_tracks WHERE video_id=? AND status='active' ORDER BY id",[vid]);
 const auxiliary=[];for(const track of tracks)if(track.source_video_id)auxiliary.push((await captureVersion(c,await requireVideo(c,track.source_video_id))).id);
 return {videoId:vid,sourceVersionId:version.id,fingerprint:version.fingerprint,tracks,auxiliary,captionPath:v.caption_path};
}
export async function validateInputs(c,inputs){for(const input of inputs){const version=await requireVersion(c,input.sourceVersionId);if(version.video_id!==input.videoId)fail(400,'RECIPE_SOURCE_MISMATCH');const fresh=await inputSnapshot(c,input.videoId);if(canonicalJSON(fresh)!==canonicalJSON(input))fail(409,'RECIPE_INPUT_CHANGED','Create a new recipe version after reviewing the changed source or tracks.');}}
export async function reusableJob(c,tid,b){
 await tenantAuth(c,tid,'processing:write','editor');
 if(!['probe','preview','export','transcode','index'].includes(b.kind))fail(400,'UNSUPPORTED_REUSE_OPERATION');
 const v=await requireVideo(c,b.videoId,'processing:write','editor');if(v.tenant_id!==tid)fail(404,'VIDEO_NOT_FOUND');
 const key=text(b.requestKey,'requestKey',160),actor=c.actor.agentId||c.actor.email,requestHash=await hash(canonicalJSON(b));
 const receipt=await c.db.one('SELECT * FROM processing_reuse WHERE tenant_id=? AND actor_id=? AND request_key=?',[tid,actor,key]);
 if(receipt){if(receipt.request_hash!==requestHash)fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return {reused:true,job:await getJob(c,receipt.job_id),processingChargeMicros:0};}
 // Existing requests keep their original exact payload and reservation.
 const existing=await c.db.one('SELECT id FROM jobs WHERE tenant_id=? AND request_key=?',[tid,key]);if(existing)return {reused:false,job:await createJob(c,tid,b)};
 await checkRevision(c,v,b.expectedRevision);
 const input=await inputSnapshot(c,v.id);if(!input.fingerprint&&b.reuse!==false)fail(409,'CONTENT_FINGERPRINT_UNKNOWN','This legacy source has no verified content fingerprint. Choose a new processing request with reuse:false explicitly.');
 const {requestKey,budgetMicros,expectedRevision,approved,reuse,...parameters}=b;
 const fingerprint=await hash(canonicalJSON({input,parameters,models:MODELS,processor:c.env.PROCESSOR_RELEASE||'local',actor}));
 if(reuse!==false){
  const old=await c.db.one("SELECT * FROM jobs WHERE tenant_id=? AND reuse_fingerprint=? AND state IN ('succeeded','queued','container_running','ai_index') ORDER BY created_at DESC LIMIT 1",[tid,fingerprint]);
  if(old){const job=await getJob(c,old.id);
   const missing=await c.db.one("SELECT COUNT(*) n FROM objects WHERE video_id=? AND path LIKE ? AND status!='ready'",[v.id,`jobs/${old.id}/%`]);
   if(missing.n)fail(409,'CACHED_OUTPUT_UNAVAILABLE');
   await c.db.batch([...policyOps(c),['INSERT INTO processing_reuse(id,tenant_id,actor_id,request_key,request_hash,job_id,created_at) VALUES(?,?,?,?,?,?,?)',['reuse_'+(await hash(tid+actor+key)).slice(0,40),tid,actor,key,requestHash,old.id,now()]]]);
   return {reused:true,job,processingChargeMicros:0,originalReceiptRetained:true,inFlight:!old.finished_at};
  }
 }
 const job=await createJob(c,tid,b,jid=>[['UPDATE jobs SET reuse_fingerprint=? WHERE id=?',[fingerprint,jid]]]);return {reused:false,job};
}
