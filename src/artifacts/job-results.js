import {manifestOp} from './manifests.js';
import {MODELS} from '../ai/models.js';
export async function resultManifestOps(c,j,result){
 const sources=await c.db.all('SELECT s.id,s.video_id FROM job_source_versions b JOIN source_versions s ON s.id=b.source_version_id WHERE b.job_id=? ORDER BY s.id',[j.id]);
 const params=JSON.parse(j.payload_json),video=await c.db.one('SELECT duration_seconds FROM videos WHERE id=?',[j.video_id]);
 const payload={jobId:j.id,inputVersions:sources,output:{},models:j.kind==='index'?{asr:MODELS.asr,vision:MODELS.vision}:undefined};
 for(const key of ['summary','answer','text','quality','primaryPath','sourcePath','exportPath','exportFormat','previewPath','thumbnailPath','transcriptSegments','coverage','reusedUnits'])if(result[key]!==undefined)payload.output[key]=result[key];
 if(Array.isArray(result.items))payload.references=result.items.map(x=>({id:x.evidenceId||x.id,videoId:x.video_id,start:x.start_seconds,end:x.end_seconds}));
 const start=params.startSeconds||0,end=params.endSeconds??result.durationSeconds??video?.duration_seconds??0;
 return [await manifestOp(c,{id:'am_result_'+j.id,videoId:j.video_id,tenantId:j.tenant_id,sourceVersionId:sources[0]?.id||null,jobId:j.id,origin:'hosted',kind:'job-'+j.kind,start,end:Math.max(start,end),payload,method:{operation:j.kind,release:c.env.RELEASE_SHA||'local',sourceBinding:sources.length?'recorded':'not-applicable-or-unavailable'},coverage:{exhaustive:false,resultReceipt:true}})];
}
