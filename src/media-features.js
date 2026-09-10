import {resourceDeleteOps} from './approvals/resources.js';
import {agentOnly,bindKey,videoAccess,permission,policyOps,checkRevision,revisionOps} from './access/policy.js';
import {claimOps} from './runs/claims.js';
/** Stored-video extensions. Immutable R2 objects, tenant-scoped metadata and explicit export grants. */
import {tenantAuth,authenticate,isSuper} from './auth.js';
import {requireVideo} from './library.js';
import {putObject,getObject} from './storage.js';
import {signToken,verifyToken} from './crypto.js';
import {fail,uid,now,text,integer,number,choice,parseRange} from './util.js';

export const ENCODING_PROFILES = Object.freeze({
  economy:{heights:[360,480],description:'Low data use; up to 480p'},
  balanced:{heights:[360,480,720],description:'Mobile-first; up to 720p'},
  fullhd:{heights:[360,480,720,1080],description:'Up to 1080p; no upscaling'}
});
export function languageTag(value='und') {
  const s=text(value,'language',35).toLowerCase();
  if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(s))fail(400,'INVALID_LANGUAGE_TAG');
  return s;
}
const stamp=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
function timestamp(s) {
  const m=/^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/.exec(s.trim());
  if(!m||Number(m[2])>59||Number(m[3])>59)fail(400,'INVALID_SUBTITLE_TIMESTAMP');
  return Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;
}
export function validateCues(cues,duration=0) {
  if(!Array.isArray(cues)||!cues.length||cues.length>3000)fail(400,'INVALID_SUBTITLE_CUES');
  let previous=-1;
  return cues.map(c=>{
    const start=number(c.start,'start',0,86400),end=number(c.end,'end',0,86400);
    if(end<=start||start<previous||(duration>0&&end>duration+1))fail(400,'INVALID_SUBTITLE_RANGE');
    previous=start;
    const line=text(c.text,'text',3000).replace(/\u0000/g,'');
    // Use plain text only. Do not interpret imported cue markup or CSS/REGION blocks.
    return {start,end,text:line};
  });
}
export function parseSubtitles(content,format='vtt',duration=0) {
  if(typeof content!=='string'||content.length>1024*1024)fail(400,'SUBTITLE_TOO_LARGE');
  choice(format,['vtt','srt'],'format');
  const normalized=content.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(format==='vtt'&&!/^WEBVTT(?:[ \t].*)?\n/.test(normalized))fail(400,'INVALID_WEBVTT');
  const blocks=normalized.replace(/^WEBVTT[^\n]*\n/,'').trim().split(/\n[ \t]*\n/),cues=[];
  for(const block of blocks) {
    const lines=block.split('\n'); if(/^NOTE(?:\s|$)/.test(lines[0]))continue;
    const i=lines.findIndex(l=>l.includes('-->'));
    if(i<0||i>1)fail(400,'UNSUPPORTED_SUBTITLE_BLOCK');
    const pair=lines[i].split(/\s+-->\s+/);
    if(pair.length!==2||/\s/.test(pair[1].trim()))fail(400,'SUBTITLE_SETTINGS_NOT_SUPPORTED');
    cues.push({start:timestamp(pair[0]),end:timestamp(pair[1]),text:lines.slice(i+1).join('\n')});
  }
  return validateCues(cues,duration);
}
export function cuesToVtt(cues) {
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return 'WEBVTT\n\n'+cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${esc(c.text)}`).join('\n\n')+'\n';
}
export async function trackList(c,vid) {
  await requireVideo(c,vid);return c.db.all("SELECT * FROM media_tracks WHERE video_id=? AND status='active' ORDER BY kind,is_default DESC,language",[vid]);
}
export async function saveCaptions(c,vid,b,trackId,extraOps=[]) {
  const v=await requireVideo(c,vid,'intelligence:write','editor');
  await checkRevision(c,v,b.expectedRevision);if(agentOnly(c)&&v.visibility!=='private')fail(403,'PUBLISHED_ASSET_REQUIRES_PRIVATE_DRAFT');if(await c.db.one('SELECT id FROM jobs WHERE video_id=? AND finished_at IS NULL',[vid]))fail(409,'VIDEO_HAS_ACTIVE_JOB');if(['deleting','deleted'].includes(v.status))fail(409,'VIDEO_UNAVAILABLE');
  const lang=languageTag(b.language),label=text(b.label||lang,'label',80);
  let old=null;
  if(trackId){old=await c.db.one("SELECT * FROM media_tracks WHERE id=? AND video_id=? AND kind='captions' AND status='active'",[trackId,vid]);if(!old)fail(404,'TRACK_NOT_FOUND');}
  const cues=b.cues?validateCues(b.cues,v.duration_seconds):parseSubtitles(b.content,b.format||'vtt',v.duration_seconds);
  const id=trackId||uid('tr_'),path=`tracks/${id}/${uid('r_')}.vtt`;
  await putObject(c,v,path,new TextEncoder().encode(cuesToVtt(cues)),'caption');
  const first=!await c.db.one("SELECT id FROM media_tracks WHERE video_id=? AND kind='captions' AND status='active'",[vid]);
  const def=b.default===undefined?(old?!!old.is_default:first):b.default===true;
  const ops=[...policyOps(c),...revisionOps(c,'videos',v,b.expectedRevision),...claimOps(c,vid,b),...extraOps];
  if(def)ops.push(["UPDATE media_tracks SET is_default=0 WHERE video_id=? AND kind='captions'",[vid]]);
  ops.push([`INSERT INTO media_tracks(id,tenant_id,video_id,kind,language,label,is_default,path,cues_json,created_at,updated_at)
    VALUES(?,?,?,'captions',?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET language=excluded.language,label=excluded.label,is_default=excluded.is_default,path=excluded.path,cues_json=excluded.cues_json,revision=media_tracks.revision+1,updated_at=excluded.updated_at`,
    [id,v.tenant_id,vid,lang,label,def?1:0,path,JSON.stringify(cues),old?.created_at||now(),now()]]);
  ops.push(['UPDATE videos SET revision=revision+1,updated_at=?,caption_path=CASE WHEN ?=1 OR caption_path IS NULL THEN ? ELSE caption_path END WHERE id=?',[now(),def?1:0,path,vid]]);
  await c.db.batch(ops);await c.db.audit(v.tenant_id,c.actor.email,'caption.save',id,{language:lang,cues:cues.length});
  return c.db.one('SELECT * FROM media_tracks WHERE id=?',[id]);
}
export async function attachAudio(c,vid,b) {
  const v=await requireVideo(c,vid,'processing:write','editor');
  await videoAccess(c,v,'write');await checkRevision(c,v,b.expectedRevision);const source=await requireVideo(c,b.sourceVideoId,'videos:read','viewer');
  if(source.tenant_id!==v.tenant_id)fail(403,'TENANT_MISMATCH');
  if(source.id===vid||source.kind!=='audio'||source.status!=='ready')fail(400,'READY_AUDIO_ASSET_REQUIRED');
  if(await c.db.one('SELECT id FROM jobs WHERE video_id=? AND finished_at IS NULL',[vid]))fail(409,'VIDEO_HAS_ACTIVE_JOB');
  const count=await c.db.one("SELECT COUNT(*) n FROM media_tracks WHERE video_id=? AND kind='audio' AND status='active'",[vid]);
  if(count.n>=8)fail(400,'MAX_EIGHT_AUDIO_TRACKS');
  const id=uid('tr_'),lang=languageTag(b.language),label=text(b.label||lang,'label',80),ops=[...policyOps(c),...revisionOps(c,'videos',v,b.expectedRevision),...claimOps(c,vid,b),['INSERT INTO video_dependencies(video_id,source_video_id) VALUES(?,?) ON CONFLICT DO NOTHING',[vid,source.id]]];
  if(b.default)ops.push(["UPDATE media_tracks SET is_default=0 WHERE video_id=? AND kind='audio'",[vid]]);
  ops.push(["INSERT INTO media_tracks(id,tenant_id,video_id,kind,language,label,is_default,source_video_id,created_at,updated_at) VALUES(?,?,?,'audio',?,?,?,?,?,?)",[id,v.tenant_id,vid,lang,label,b.default?1:0,source.id,now(),now()]],['UPDATE videos SET revision=revision+1,updated_at=? WHERE id=?',[now(),vid]]);
  await c.db.batch(ops);await c.db.audit(v.tenant_id,c.actor.email,'audio.attach',id);
  return {id,requiresTranscode:true,note:'Approve a transcode job to publish the updated HLS audio group. Source audio must match the video duration within two seconds.'};
}
export async function deleteTrack(c,vid,id,b={}) {
  const v=await requireVideo(c,vid,'intelligence:write','editor');
  const t=await c.db.one("SELECT * FROM media_tracks WHERE id=? AND video_id=? AND status='active'",[id,vid]);
  if(!t)fail(404,'TRACK_NOT_FOUND');
  if(await c.db.one('SELECT id FROM jobs WHERE video_id=? AND finished_at IS NULL',[vid]))fail(409,'VIDEO_HAS_ACTIVE_JOB');
  await c.db.batch([...await resourceDeleteOps(c,v.tenant_id,'track',id,b),...revisionOps(c,'videos',v,v.revision),...claimOps(c,vid,b),["UPDATE media_tracks SET status='deleted',is_default=0,updated_at=? WHERE id=?",[now(),id]],['UPDATE videos SET revision=revision+1,updated_at=?,caption_path=CASE WHEN caption_path=? THEN NULL ELSE caption_path END WHERE id=?',[now(),t.path,vid]]]);
  await c.db.audit(v.tenant_id,c.actor.email,'track.delete',id);
  return {ok:true,requiresTranscode:t.kind==='audio',note:t.kind==='audio'?'Existing HLS audio remains until a replacement transcode publishes.':null};
}
export async function exportList(c,vid) {
  await requireVideo(c,vid);return c.db.all('SELECT * FROM media_exports WHERE video_id=? ORDER BY created_at DESC',[vid]);
}
export async function issueDownload(c,vid,b) {
  const v=await requireVideo(c,vid,'downloads:create','viewer');
  if(!v.downloads_enabled)fail(403,'DOWNLOADS_DISABLED');
  const e=await c.db.one('SELECT * FROM media_exports WHERE id=? AND video_id=? AND revoked_at IS NULL',[b.exportId,vid]);
  if(!e)fail(404,'EXPORT_NOT_FOUND');
  const actor=await authenticate(c),id=uid('dg_'),ttl=integer(b.ttlSeconds??300,'ttlSeconds',30,900);
  await c.db.run('INSERT INTO download_grants(id,export_id,tenant_id,issuer_session_id,issuer_key_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',[id,e.id,v.tenant_id,actor.sessionId||null,actor.type==='key'?actor.email.slice(4):null,now()+ttl*1000,now()]);
  const token=await signToken({scope:'download',gid:id},c.env.SIGNING_SECRET,ttl);
  await c.db.audit(v.tenant_id,actor.email,'download.issue',e.id,{grantId:id});
  return {id,url:`${c.env.APP_ORIGIN}/download/${id}?token=${encodeURIComponent(token)}`,expiresAt:now()+ttl*1000};
}
export async function revokeExport(c,vid,eid) {
  const v=await requireVideo(c,vid,'videos:write','editor');
  permission(c,'publish');await c.db.run('UPDATE media_exports SET revoked_at=? WHERE id=? AND video_id=?',[now(),eid,vid]);
  await c.db.audit(v.tenant_id,c.actor.email,'export.revoke',eid);return {ok:true};
}
export async function serveDownload(c,id) {
  const p=await verifyToken(new URL(c.req.url).searchParams.get('token'),c.env.SIGNING_SECRET,'download');
  if(p.gid!==id)fail(403,'DOWNLOAD_RESOURCE_MISMATCH');
  const g=await c.db.one(`SELECT g.*,e.video_id,e.path,e.format,e.revoked_at export_revoked,v.downloads_enabled,v.status video_status,t.status tenant_status
    FROM download_grants g JOIN media_exports e ON e.id=g.export_id JOIN videos v ON v.id=e.video_id JOIN tenants t ON t.id=g.tenant_id WHERE g.id=?`,[id]);
  if(!g||g.revoked_at||g.export_revoked||g.expires_at<=now()||!g.downloads_enabled||g.tenant_status!=='active'||!['ready','processing'].includes(g.video_status))fail(403,'DOWNLOAD_REVOKED');
  if(g.issuer_session_id){const s=await c.db.one('SELECT * FROM sessions WHERE id=? AND revoked_at IS NULL AND expires_at>?',[g.issuer_session_id,now()]);if(!s||(!isSuper(c.env,s.email)&&!await c.db.one('SELECT role FROM members WHERE tenant_id=? AND email=?',[g.tenant_id,s.email])))fail(403,'DOWNLOAD_ISSUER_REVOKED');}
  if(g.issuer_key_id&&!await c.db.one('SELECT id FROM api_keys WHERE id=? AND tenant_id=? AND revoked_at IS NULL AND expires_at>?',[g.issuer_key_id,g.tenant_id,now()]))fail(403,'DOWNLOAD_ISSUER_REVOKED');
  if(g.issuer_key_id){await bindKey(c,g.issuer_key_id);permission(c,'download');await videoAccess(c,{id:g.video_id});}c.meter.tenantId=g.tenant_id;c.meter.videoId=g.video_id;c.meter.category='download';
  const o=await c.db.one("SELECT * FROM objects WHERE video_id=? AND path=? AND status='ready'",[g.video_id,g.path]);if(!o)fail(404,'EXPORT_REMOVED');
  const range=parseRange(c.req.headers.get('range'),o.size),headers={'Content-Type':o.content_type,'Content-Length':String(range?.length??o.size),'Content-Disposition':`attachment; filename="${g.video_id}.${g.format}"`,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
  if(range)headers['Content-Range']=`bytes ${range.offset}-${range.end}/${o.size}`;
  if(c.req.method==='HEAD')return new Response(null,{headers,status:range?206:200});
  const file=await getObject(c,o.object_key,range?{range:{offset:range.offset,length:range.length}}:undefined);if(!file)fail(404,'EXPORT_REMOVED');
  c.meter.add('bytes_offered',range?.length??o.size);return new Response(file.body,{headers,status:range?206:200});
}

export function mediaJobOptions(b) {
  const profile=choice(b.profile||(b.fullHD?'fullhd':'balanced'),Object.keys(ENCODING_PROFILES),'profile');
  const out={profile,heights:ENCODING_PROFILES[profile].heights,fullHD:profile==='fullhd'};
  if(b.kind==='preview')Object.assign(out,{timestampSeconds:number(b.timestampSeconds??0,'timestampSeconds',0,14400),previewSeconds:integer(b.previewSeconds??6,'previewSeconds',1,30),spriteFrames:integer(b.spriteFrames??12,'spriteFrames',1,36)});
  if(b.kind==='export')Object.assign(out,{format:choice(b.format||'mp4',['mp4','m4a'],'format'),startSeconds:number(b.startSeconds??0,'startSeconds',0,14400),endSeconds:b.endSeconds===undefined?null:number(b.endSeconds,'endSeconds',0,14400)});
  if(b.logoVideoId)Object.assign(out,{logoVideoId:text(b.logoVideoId,'logoVideoId',80),logoPosition:choice(b.logoPosition||'bottom-right',['top-left','top-right','bottom-left','bottom-right'],'logoPosition'),logoWidthPct:number(b.logoWidthPct??15,'logoWidthPct',5,30)});
  return out;
}
export async function prepareMediaSources(c,v,kind,p) {
  const ids=[...(p.sourceVideoIds||[v.id])];
  if(kind==='transcode') {
    p.audioTracks=await c.db.all("SELECT id,source_video_id sourceVideoId,language,label,is_default isDefault FROM media_tracks WHERE video_id=? AND kind='audio' AND status='active' ORDER BY created_at,id",[v.id]);
    for(const t of p.audioTracks)ids.push(t.sourceVideoId);
  }
  if(p.logoVideoId)ids.push(p.logoVideoId);
  p.sourceVideoIds=[...new Set(ids)];
  for(const id of p.sourceVideoIds) {
    if(id===v.id)continue;
    const s=await requireVideo(c,id);
    if(s.tenant_id!==v.tenant_id)fail(403,'TENANT_MISMATCH');
    if(s.status!=='ready')fail(409,'AUXILIARY_SOURCE_NOT_READY');
    if(id===p.logoVideoId&&(s.kind!=='image'||s.expected_bytes>5*1024*1024))fail(400,'LOGO_REQUIRES_IMAGE_UNDER_5MB');
  }
}
export function mediaResultOps(j,result) {
  const ops=[];
  if(result.videoCodec)ops.push(['UPDATE videos SET probe_json=? WHERE id=?',[JSON.stringify(result),j.video_id]]);
  if(result.previewPath||result.spritePath)ops.push(['UPDATE videos SET preview_path=COALESCE(?,preview_path),sprite_path=COALESCE(?,sprite_path),preview_meta_json=? WHERE id=?',[result.previewPath||null,result.spritePath||null,JSON.stringify(result.spriteLayout||null),j.video_id]]);
  if(result.exportPath)ops.push(['INSERT INTO media_exports(id,tenant_id,video_id,job_id,path,format,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(job_id,path) DO NOTHING',[uid('ex_'),j.tenant_id,j.video_id,j.id,result.exportPath,result.exportFormat,now()]]);
  for(const t of result.packagedTracks||[])ops.push(["UPDATE media_tracks SET path=?,updated_at=? WHERE id=? AND video_id=? AND status='active'",[t.path,now(),t.id,j.video_id]]);
  return ops;
}
export async function finishMediaJob(c,j,result){const ops=mediaResultOps(j,result);if(ops.length)await c.db.batch(ops);}
