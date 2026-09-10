import {authorizeManifest} from './access.js';
import {requireVersion} from './versions.js';
import {tenantAuth} from '../auth.js';
import {requireVideo} from '../library.js';
import {videoFilter} from '../access/policy.js';
import {manifestOp} from '../artifacts/manifests.js';
import {integer,number,text,fail} from '../util.js';
export const evidenceView=r=>({...r,method:JSON.parse(r.method_json),coverage:JSON.parse(r.coverage_json),payload:JSON.parse(r.payload_json),method_json:undefined,coverage_json:undefined,payload_json:undefined,watch:{videoId:r.video_id,start:r.start_seconds,end:r.end_seconds}});

/** Legacy rows retain an explicit unknown source binding, never fabricated provenance. */
export async function backfillLegacy(c,vid){
 const rows=await c.db.all('SELECT a.* FROM artifacts a LEFT JOIN artifact_manifests m ON m.artifact_id=a.id WHERE a.video_id=? AND m.id IS NULL ORDER BY a.id LIMIT 100',[vid]);
 if(rows.length)await c.db.batch(await Promise.all(rows.map(r=>manifestOp(c,{id:'am_'+r.id,videoId:vid,tenantId:r.tenant_id,artifactId:r.id,jobId:r.job_id,origin:'legacy-unverified-source',kind:r.layer,start:r.start_seconds,end:r.end_seconds,payload:{text:r.text,data:JSON.parse(r.data_json)},method:{sourceBinding:'unknown',modelProvenance:'unknown'},coverage:{exhaustive:false,migrated:true}}))));
 return rows.length;
}
export async function evidenceSearch(c,tid,b={}){
 await tenantAuth(c,tid,'search:read','viewer');if(b.mode&&b.mode!=='keyword')fail(400,'USE_BUDGETED_SEMANTIC_JOB');
 if(b.videoId){const v=await requireVideo(c,b.videoId);if(v.tenant_id!==tid)fail(404,'VIDEO_NOT_FOUND');await backfillLegacy(c,v.id);}
 const f=videoFilter(c),args=[tid,...f.args],where=["m.tenant_id=?",f.sql,"v.status IN ('ready','processing')"];
 if(b.videoId){where.push('m.video_id=?');args.push(b.videoId);}
 if(b.sourceVersionId){where.push('m.source_version_id=?');args.push(b.sourceVersionId);}
 if(b.kind){where.push('m.kind=?');args.push(text(b.kind,'kind',40));}
 if(b.language){where.push('m.language=?');args.push(text(b.language,'language',35));}
 if(b.start!==undefined){where.push('m.end_seconds>=?');args.push(number(Number(b.start),'start',0,86400));}
 if(b.end!==undefined){where.push('m.start_seconds<=?');args.push(number(Number(b.end),'end',0,86400));}
 if(b.query){where.push('m.artifact_id IN (SELECT a.id FROM artifacts_fts JOIN artifacts a ON a.rowid=artifacts_fts.rowid WHERE artifacts_fts MATCH ?)');args.push(text(b.query,'query',1000).split(/\s+/).filter(Boolean).map(x=>'"'+x.replaceAll('"','""')+'"').join(' AND '));}
 const limit=integer(Number(b.limit??30),'limit',1,100),cursor=b.cursor?text(b.cursor,'cursor',100):null;
 if(cursor){where.push('m.id>?');args.push(cursor);}
 const rows=await c.db.all(`SELECT m.*,v.title FROM artifact_manifests m JOIN videos v ON v.id=m.video_id WHERE ${where.join(' AND ')} ORDER BY m.id LIMIT ?`,[...args,limit+1]);
 const visible=[];for(const row of rows.slice(0,limit))try{await authorizeManifest(c,row);visible.push(evidenceView(row));}catch(e){if(![403,404,409].includes(e.status))throw e;}
 return {items:visible,nextCursor:rows.length>limit?rows[limit-1].id:null,ordering:'stable_manifest_id',note:'Visual evidence is sampled descriptions. Coverage and caller provenance are explicit per result.'};
}
export async function evidenceBundle(c,tid,b){
 await tenantAuth(c,tid,'search:read','viewer');if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>50)fail(400,'EVIDENCE_BUNDLE_LIMIT');
 const items=[];
 for(const id of [...new Set(b.ids)]){const r=await c.db.one('SELECT * FROM artifact_manifests WHERE id=? AND tenant_id=?',[text(id,'id',100),tid]);if(!r)fail(404,'EVIDENCE_NOT_FOUND');await authorizeManifest(c,r);if(r.source_version_id){await requireVersion(c,r.source_version_id);const available=await c.db.one("SELECT o.id FROM source_versions s JOIN objects o ON o.id=s.object_id WHERE s.id=? AND o.status='ready'",[r.source_version_id]);if(!available)fail(409,'EVIDENCE_SOURCE_UNAVAILABLE');}items.push(evidenceView(r));}
 return {items,sourceVideos:[...new Set(items.map(x=>x.video_id))],complete:true,scope:'All requested references reauthorized; no factual correctness guarantee'};
}
