import {agentOnly} from './access/policy.js';
/** Explicit capability router, not an unprovable global price optimizer. No silent paid fallback. */
import {tenantAuth} from './auth.js';
import {requireVideo} from './library.js';
import {quoteJob,createJob} from './jobs.js';
import {fail,uid,now,text,integer,choice} from './util.js';
import {ENCODING_PROFILES,mediaJobOptions} from './media-features.js';
export async function getPolicy(c,tid){const t=await tenantAuth(c,tid,'videos:read','viewer');return JSON.parse(t.provider_policy_json);}
export async function setPolicy(c,tid,b){const t=await tenantAuth(c,tid,'policy:write','owner');if(c.actor.type==='key')fail(403,'SESSION_REQUIRED');const p={...JSON.parse(t.provider_policy_json),...b};if(typeof p.allowStream!=='boolean')fail(400,'INVALID_STREAM_POLICY');const value={allowStream:p.allowStream,defaultProfile:choice(p.defaultProfile,Object.keys(ENCODING_PROFILES),'defaultProfile'),maxJobMicros:integer(p.maxJobMicros,'maxJobMicros',1000,1e10)};await c.db.run('UPDATE tenants SET provider_policy_json=? WHERE id=?',[JSON.stringify(value),tid]);await c.db.audit(tid,c.actor.email,'provider.policy',tid,value);return value;}
export async function planProcessing(c,tid,b){
  const t=await tenantAuth(c,tid,'processing:write','editor'),policy=JSON.parse(t.provider_policy_json);
  const v=await requireVideo(c,b.videoId,'processing:write','editor');if(v.tenant_id!==tid)fail(403,'TENANT_MISMATCH');if(v.status!=='ready')fail(409,'VIDEO_NOT_READY');
  const need=choice(b.need||'playback',['playback','adaptive','preview','export','index','managed_conversion'],'need');
  const spec={...mediaJobOptions({...b,kind:need==='preview'?'preview':need==='export'?'export':'transcode',profile:b.profile||policy.defaultProfile}),videoId:v.id,expectedRevision:v.revision,maxWallSeconds:integer(b.maxWallSeconds??900,'maxWallSeconds',30,3600),encrypted:b.encrypted!==false};
  let provider='ffmpeg',reason='',kind='transcode';const probe=JSON.parse(v.probe_json||'null');
  if(need==='playback'&&v.kind==='hls'){provider='r2';kind=null;reason='An HLS playback version already exists; reuse it without processing.';}
  else if(need==='playback'&&probe?.browserCompatible&&v.kind==='mp4'){provider='r2';kind=null;reason='Server-probed browser-compatible MP4; reuse it. This does not guarantee every client device.';}
  else if(need==='playback'&&!probe){kind='probe';reason='Codec compatibility is not yet verified. Probe first, then request a fresh plan; no paid second step is automatic.';}
  else if(need==='managed_conversion'){if(!policy.allowStream||c.env.STREAM_ENABLED!=='true')fail(403,'STREAM_NOT_ALLOWED_BY_POLICY');provider='stream';kind='stream';reason='Caller explicitly requested managed conversion. Importing a single MP4 is not an adaptive HLS export.';}
  else if(['preview','export','index'].includes(need)){kind=need;reason='Use the local Cloudflare processing pipeline; no Stream delivery.';}
  else reason='Create requested adaptive renditions in a Cloudflare Container and retain playback in R2.';
  spec.kind=kind;
  const quote=kind?await quoteJob(c,tid,spec):{reserveMicros:0,supplierEnvelopeMicros:0};
  if(quote.reserveMicros>policy.maxJobMicros)fail(403,'POLICY_JOB_BUDGET_EXCEEDED');
  const id=uid('plan_'),expires=now()+15*60000;
  await c.db.run('INSERT INTO processing_plans(id,tenant_id,video_id,source_updated_at,spec_json,quote_json,reason,provider,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,tid,v.id,v.updated_at,JSON.stringify(spec),JSON.stringify(quote),reason,provider,expires,now()]);
  return {id,provider,reason,spec,quote,expiresAt:expires,noSilentFallback:true};
}
export async function getPlan(c,tid,id){
 await tenantAuth(c,tid,'processing:write','editor');
 const p=await c.db.one('SELECT * FROM processing_plans WHERE id=? AND tenant_id=?',[id,tid]);if(!p)fail(404,'PLAN_NOT_FOUND');if(p.expires_at<now())fail(409,'PLAN_EXPIRED');
 const v=await requireVideo(c,p.video_id,'processing:write','editor');if(v.updated_at!==p.source_updated_at)fail(409,'PLAN_STALE');
 return {id:p.id,provider:p.provider,reason:p.reason,spec:JSON.parse(p.spec_json),quote:JSON.parse(p.quote_json),expiresAt:p.expires_at,noSilentFallback:true};
}
export async function executePlan(c,tid,id,b){
  const t=await tenantAuth(c,tid,'processing:write','editor'),p=await c.db.one('SELECT * FROM processing_plans WHERE id=? AND tenant_id=?',[id,tid]);if(!p||p.expires_at<now())fail(409,'PLAN_EXPIRED');
  const existing=await c.db.one('SELECT id FROM jobs WHERE tenant_id=? AND request_key=?',[tid,'plan:'+id]);if(existing){await requireVideo(c,p.video_id);if(agentOnly(c)&&!await c.db.one('SELECT id FROM jobs WHERE id=? AND agent_id=?',[existing.id,c.actor.agentId]))fail(404,'PLAN_NOT_FOUND');return {jobId:existing.id,idempotent:true};}
  const v=await requireVideo(c,p.video_id);if(v.updated_at!==p.source_updated_at)fail(409,'PLAN_STALE');
  if(b.approved!==true)fail(400,'PLAN_APPROVAL_REQUIRED');
  const q=JSON.parse(p.quote_json),spec=JSON.parse(p.spec_json),policy=JSON.parse(t.provider_policy_json);
  if(q.reserveMicros>policy.maxJobMicros||(p.provider==='stream'&&!policy.allowStream))fail(403,'POLICY_CHANGED');
  if(p.provider==='r2')return {provider:'r2',reused:true,videoId:v.id,processingChargeMicros:0};
  const budget=integer(b.budgetMicros,'budgetMicros',q.reserveMicros,policy.maxJobMicros);
  return createJob(c,tid,{...spec,requestKey:'plan:'+id,budgetMicros:budget});
}
