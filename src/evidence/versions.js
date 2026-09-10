import {requireVideo} from '../library.js';
import {videoAccess,policyOps} from '../access/policy.js';
import {hash,now,fail} from '../util.js';
import {partFingerprint} from '../artifacts/fingerprint.js';

export async function captureVersion(c,v){
 const object=await c.db.one("SELECT * FROM objects WHERE video_id=? AND path=? AND status='ready'",[v.id,v.source_path]);
 if(!object)fail(409,'SOURCE_OBJECT_REQUIRED','An immutable stored source is required for versioned evidence.');
 const old=await c.db.one('SELECT * FROM source_versions WHERE video_id=? AND object_id=?',[v.id,object.id]);if(old)return old;
 let fingerprint=object.content_hash,method=fingerprint?.startsWith('parts:')?'sha256-part-manifest-v1':fingerprint?'sha256':'unknown-legacy-content';if(fingerprint?.startsWith('parts:'))fingerprint=fingerprint.slice(6);
 if(!fingerprint&&object.role==='source'&&object.path.startsWith('source.')){const parts=await c.db.all('SELECT part_number,size,sha256 FROM upload_parts WHERE video_id=? ORDER BY part_number',[v.id]);fingerprint=await partFingerprint(parts,object.size);if(fingerprint)method='sha256-part-manifest-v1';}
 const id='sv_'+(await hash(`${v.id}:${object.id}`)).slice(0,40);
 await c.db.batch([...policyOps(c),['INSERT OR IGNORE INTO source_versions(id,tenant_id,video_id,object_id,fingerprint,fingerprint_method,source_revision,path,size,duration_seconds,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,v.tenant_id,v.id,object.id,fingerprint,method,v.revision,object.path,object.size,v.duration_seconds||0,now()]]]);
 return c.db.one('SELECT * FROM source_versions WHERE id=?',[id]);
}
export async function requireVersion(c,id){
 const version=await c.db.one('SELECT * FROM source_versions WHERE id=?',[id]);if(!version)fail(404,'SOURCE_VERSION_NOT_FOUND');
 await requireVideo(c,version.video_id);await videoAccess(c,{id:version.video_id});
 const object=await c.db.one("SELECT id FROM objects WHERE id=? AND status='ready'",[version.object_id]);if(!object)fail(409,'SOURCE_VERSION_UNAVAILABLE');
 return version;
}
export async function versions(c,vid){const v=await requireVideo(c,vid);if(['ready','processing'].includes(v.status))await captureVersion(c,v);return {items:await c.db.all('SELECT * FROM source_versions WHERE video_id=? ORDER BY created_at DESC,id',[vid]),currentSourcePath:v.source_path};}
export async function jobVersionOps(c,jid,ids){const ops=[];for(const id of [...new Set(ids)]){const v=await c.db.one('SELECT * FROM videos WHERE id=?',[id]);const version=await captureVersion(c,v);ops.push(['INSERT OR IGNORE INTO job_source_versions(job_id,source_version_id) VALUES(?,?)',[jid,version.id]]);}return ops;}
export async function checkSourceVersions(c,j){
 const inputs=await c.db.all('SELECT s.* FROM job_source_versions b JOIN source_versions s ON s.id=b.source_version_id WHERE b.job_id=?',[j.id]);
 for(const s of inputs){const current=await c.db.one("SELECT o.id FROM objects o JOIN videos v ON v.id=o.video_id WHERE v.id=? AND o.path=v.source_path AND o.status='ready' AND v.status NOT IN ('deleting','deleted')",[s.video_id]);if(current?.id!==s.object_id)fail(409,'JOB_SOURCE_VERSION_CHANGED');}
}
