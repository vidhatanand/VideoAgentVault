import {requireVideo} from '../library.js';
import {requireVersion,captureVersion} from '../evidence/versions.js';
import {policyOps,revisionOps} from '../access/policy.js';
import {claimOps} from '../runs/claims.js';
import {manifestOp} from './manifests.js';
import {hash,canonicalJSON,text,number,fail} from '../util.js';
/** Files use the normal bounded upload API; this binds a inspected local result to its input. */
export async function importMediaResult(c,vid,b){
 const output=await requireVideo(c,vid,'intelligence:write','editor'),source=await requireVersion(c,b.sourceVersionId);
 const input=await requireVideo(c,source.video_id);if(input.tenant_id!==output.tenant_id||input.id===vid)fail(400,'DERIVED_SOURCE_REQUIRED');
 if(output.visibility!=='private')fail(409,'PRIVATE_DRAFT_REQUIRED','Bind source lineage before publishing an imported result.');
 if(output.status!=='ready')fail(409,'OUTPUT_NOT_READY');const probe=JSON.parse(output.probe_json||'null');if(!probe?.durationSeconds)fail(409,'OUTPUT_INSPECTION_REQUIRED','Run the bounded probe job before registering a local audio or video result.');
 const version=await captureVersion(c,output);if(!version.fingerprint)fail(409,'OUTPUT_CONTENT_HASH_REQUIRED');
 const start=number(b.start,'start',0,input.duration_seconds),end=number(b.end,'end',start,input.duration_seconds);if(end<=start)fail(400,'INVALID_SOURCE_INTERVAL');
 const producer=text(b.producer,'producer',120),requestKey=text(b.requestKey,'requestKey',160),payload={producer,inputSourceVersionId:source.id,outputSourceVersionId:version.id,outputDurationSeconds:probe.durationSeconds,sourceInterval:{start,end},provenance:'caller-declared'};
 const id='am_'+(await hash(canonicalJSON({vid,requestKey}))).slice(0,40),old=await c.db.one('SELECT * FROM artifact_manifests WHERE id=?',[id]);if(old){if(old.payload_sha256!==await hash(canonicalJSON(payload)))fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return old;}
 if(await c.db.one('WITH RECURSIVE parents(id) AS (SELECT source_video_id FROM video_dependencies WHERE video_id=? UNION SELECT d.source_video_id FROM video_dependencies d JOIN parents ON d.video_id=parents.id) SELECT 1 FROM parents WHERE id=?',[input.id,vid]))fail(409,'DEPENDENCY_CYCLE');
 const op=await manifestOp(c,{id,videoId:vid,tenantId:output.tenant_id,sourceVersionId:source.id,origin:'caller-supplied',kind:'derived-media',start,end,payload,method:{measuredMediaInspection:true,verifiedModelProvenance:false},coverage:{declaredInterval:true,exhaustive:false}});
 await c.db.batch([...policyOps(c),...revisionOps(c,'videos',output,b.expectedRevision),...claimOps(c,vid,b),['INSERT INTO video_dependencies(video_id,source_video_id) VALUES(?,?) ON CONFLICT DO NOTHING',[vid,input.id]],op]);return c.db.one('SELECT * FROM artifact_manifests WHERE id=?',[id]);
}
