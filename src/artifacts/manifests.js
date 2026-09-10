import {claimOps} from '../runs/claims.js';
import {hash,canonicalJSON,now,fail,number,text} from '../util.js';
import {requireVersion} from '../evidence/versions.js';
import {requireVideo} from '../library.js';
import {policyOps,checkRevision,agentOnly,revisionOps} from '../access/policy.js';

export async function manifestOp(c,{id,videoId,tenantId,sourceVersionId=null,artifactId=null,jobId=null,origin,kind,start=0,end=0,language='en',method={},coverage={},payload={}}){
 const body=canonicalJSON(payload);if(body.length>65536)fail(413,'ARTIFACT_MANIFEST_TOO_LARGE');
 return ['INSERT OR IGNORE INTO artifact_manifests(id,tenant_id,video_id,source_version_id,artifact_id,job_id,origin,kind,start_seconds,end_seconds,language,method_json,coverage_json,payload_json,payload_sha256,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,tenantId,videoId,sourceVersionId,artifactId,jobId,origin,kind,start,end,language,JSON.stringify(method),JSON.stringify(coverage),body,await hash(body),now()]];
}
export async function importFinding(c,vid,b){
 const v=await requireVideo(c,vid,'intelligence:write','editor');await checkRevision(c,v,b.expectedRevision);
 const version=await requireVersion(c,b.sourceVersionId);if(version.video_id!==vid)fail(400,'SOURCE_VERSION_MISMATCH');
 const start=number(b.start,'start',0,86400),end=number(b.end,'end',start,86400);if(end<=start||end>v.duration_seconds)fail(400,'EVIDENCE_INTERVAL_OUT_OF_BOUNDS');
 const content=text(b.text,'text',16000),producer=text(b.producer,'producer',120),kind=text(b.kind||'finding','kind',40);
 if(!['finding','transcript','visual','translation','quality'].includes(kind))fail(400,'INVALID_EVIDENCE_KIND');
 if(b.language&&b.language!=='en')fail(400,'ENGLISH_LAUNCH_ONLY');
 const payload={text:content,producer,declared:b.data||{},callerAgentId:agentOnly(c)?c.actor.agentId:null};
 const id='am_'+(await hash(canonicalJSON({vid,version:version.id,requestKey:text(b.requestKey,'requestKey',160)}))).slice(0,40);
 const old=await c.db.one('SELECT * FROM artifact_manifests WHERE id=?',[id]);if(old){if(old.payload_sha256!==await hash(canonicalJSON(payload))||old.start_seconds!==start||old.end_seconds!==end||old.kind!==kind)fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return old;}
 const aid='a_'+id.slice(3),op=await manifestOp(c,{id,videoId:vid,tenantId:v.tenant_id,sourceVersionId:version.id,artifactId:aid,origin:'caller-supplied',kind,start,end,payload,method:{producer,verifiedModelProvenance:false},coverage:{declaredInterval:true,exhaustive:false}});
 await c.db.batch([...policyOps(c),...claimOps(c,vid,b),...revisionOps(c,'videos',v,b.expectedRevision),['INSERT INTO artifacts(id,tenant_id,video_id,layer,start_seconds,end_seconds,text,data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',[aid,v.tenant_id,vid,kind,start,end,content,JSON.stringify({callerSupplied:true,producer}),now()]],op]);
 return c.db.one('SELECT * FROM artifact_manifests WHERE id=?',[id]);
}
