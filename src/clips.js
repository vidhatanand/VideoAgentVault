import {folderAccess,agentOnly} from './access/policy.js';
/** No-re-encode HLS composition. Whole independent segments only; never promises frame-accurate cuts. */
import {tenantAuth} from './auth.js';
import {requireVideo,verifyFolder,publicVideo,applyTags} from './library.js';
import {resolveHlsUri,getObject,putObject} from './storage.js';
import {fail,now,text,number,tagsInput,hash,canonicalJSON} from './util.js';

function attrs(line){return Object.fromEntries([...line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)].map(m=>[m[1],m[2].replace(/^"|"$/g,'')]));}
export function readMaster(value,path){
  if(!value.startsWith('#EXTM3U')||!value.includes('#EXT-X-INDEPENDENT-SEGMENTS'))fail(400,'INDEPENDENT_HLS_REQUIRED');
  if(value.includes('#EXT-X-MEDIA:'))fail(400,'CLIP_MULTITRACK_REQUIRES_RENDER','Instant composition currently accepts muxed-audio HLS. Render a multi-track timeline instead.');
  const lines=value.split(/\r?\n/).map(s=>s.trim()),variants=[];
  for(let i=0;i<lines.length;i++)if(lines[i].startsWith('#EXT-X-STREAM-INF:')){
    const a=attrs(lines[i]);if(!a.RESOLUTION||!lines[i+1]||lines[i+1].startsWith('#'))fail(400,'INVALID_VARIANT');
    variants.push({attrs:lines[i],resolution:a.RESOLUTION,codecs:a.CODECS||null,path:resolveHlsUri(path,lines[++i])});
  }
  if(!variants.length||variants.length>8)fail(400,'INVALID_VARIANT_COUNT');
  return variants;
}
export function readSegments(value,path){
  if(!value.startsWith('#EXTM3U')||!value.includes('#EXT-X-ENDLIST'))fail(400,'VOD_PLAYLIST_REQUIRED');
  if(/#EXT-X-(BYTERANGE|MAP|PART|GAP|DISCONTINUITY)/.test(value))fail(400,'UNSUPPORTED_INSTANT_CLIP_LAYOUT','Only continuous MPEG-TS independent-segment VOD is accepted. Use rendering for other layouts.');
  let cursor=0,duration=null,key=null,sequence=0;
  const segments=[];
  for(const raw of value.split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    if(line.startsWith('#EXT-X-MEDIA-SEQUENCE:'))sequence=Number(line.split(':')[1]);
    else if(line.startsWith('#EXT-X-KEY:')){const a=attrs(line);if(!['AES-128','NONE'].includes(a.METHOD))fail(400,'UNSUPPORTED_CLIP_ENCRYPTION');if(a.METHOD==='AES-128'&&!a.URI)fail(400,'CLIP_KEY_MISSING');key=a.METHOD==='NONE'?null:{uri:resolveHlsUri(path,a.URI),iv:a.IV||null};}
    else if(line.startsWith('#EXTINF:'))duration=Number(line.slice(8).split(',')[0]);
    else if(!line.startsWith('#')){
      if(!Number.isFinite(duration)||duration<=0||!Number.isSafeInteger(sequence)||sequence<0)fail(400,'INVALID_SEGMENT');
      const media=resolveHlsUri(path,line);if(!media.endsWith('.ts'))fail(400,'MPEG_TS_REQUIRED');
      const iv=key?(key.iv||'0x'+sequence.toString(16).padStart(32,'0')):null;
      if(iv&&!/^0x[0-9a-fA-F]{32}$/.test(iv))fail(400,'INVALID_HLS_IV');
      segments.push({path:media,start:cursor,end:cursor+duration,duration,key:key?{...key,iv}:null});
      cursor+=duration;duration=null;sequence++;
    }
  }
  if(!segments.length||segments.length>2400)fail(400,'INVALID_SEGMENT_COUNT');
  return segments;
}
async function object(c,v,path){const o=await c.db.one("SELECT * FROM objects WHERE video_id=? AND tenant_id=? AND path=? AND status='ready'",[v.id,v.tenant_id,path]);if(!o)fail(409,'CLIP_SOURCE_MISSING');return o;}
async function manifest(c,v,path){const o=await object(c,v,path);if(o.size>1024*1024)fail(400,'PLAYLIST_TOO_LARGE');const data=await getObject(c,o.object_key);if(!data)fail(409,'CLIP_SOURCE_MISSING');return data.text();}

export async function composeClips(c,tid,b){
  await tenantAuth(c,tid,'videos:write','editor');
  const requestKey=text(b.requestKey,'requestKey',120),digest=await hash(canonicalJSON(b));
  const prior=await c.db.one('SELECT id,probe_json FROM videos WHERE tenant_id=? AND id=?',[tid,'clip_'+(await hash(tid+':'+requestKey)).slice(0,28)]);
  if(prior){const metadata=JSON.parse(prior.probe_json||'{}');if(metadata.requestHash!==digest)fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return publicVideo(await requireVideo(c,prior.id));}
  if(!Array.isArray(b.clips)||!b.clips.length||b.clips.length>12)fail(400,'MAX_TWELVE_CLIPS');
  const folder=await verifyFolder(c,tid,b.folderId??null),title=text(b.title||'Instant composition','title',180),sources=[],effective=[];
  await folderAccess(c,tid,folder,'write');let signature=null,total=0;
  for(const spec of b.clips){
    const v=await requireVideo(c,spec.videoId);if(v.tenant_id!==tid)fail(403,'TENANT_MISMATCH');
    if(v.kind!=='hls'||v.status!=='ready')fail(400,'READY_HLS_REQUIRED');
    const variants=readMaster(await manifest(c,v,v.primary_path),v.primary_path).sort((a,b)=>a.resolution.localeCompare(b.resolution));
    const probe=JSON.parse(v.probe_json||'{}');
    if(!variants.every(x=>x.codecs)&&!probe.renditions)fail(400,'UNVERIFIED_CODEC_COMPATIBILITY','Transcode in VideoAgentVault first, or provide complete codec attributes in an independent-segment HLS master.');
    const sig=JSON.stringify(variants.map(x=>[x.resolution,x.codecs||'videoagentvault-h264-main30',probe.hasAudio??true]));
    if(signature&&sig!==signature)fail(400,'INCOMPATIBLE_LADDERS','Instant composition requires matching resolutions, codecs and audio presence. Render a timeline for different ladders.');signature=sig;
    const start=number(spec.start??0,'start',0,14400),end=number(spec.end,'end',0,14400);if(end<=start||end>v.duration_seconds+.1)fail(400,'INVALID_CLIP_RANGE');
    const ladders=[];let bounds=null;
    for(const variant of variants){
      const all=readSegments(await manifest(c,v,variant.path),variant.path);
      const selected=all.filter(s=>s.end>start+.0001&&s.start<end-.0001);
      if(!selected.length)fail(400,'EMPTY_CLIP');
      const range={start:selected[0].start,end:selected.at(-1).end};
      if(bounds&&(Math.abs(range.start-bounds.start)>.1||Math.abs(range.end-bounds.end)>.1))fail(400,'UNALIGNED_LADDER');bounds=range;
      ladders.push({variant,segments:selected});
    }
    total+=bounds.end-bounds.start;if(total>14400)fail(400,'COMPOSITION_TOO_LONG');
    effective.push({videoId:v.id,requested:{start,end},actual:bounds});sources.push({v,ladders});
  }
  if(sources.reduce((n,s)=>n+s.ladders.reduce((a,l)=>a+l.segments.length,0),0)>120)fail(400,'INSTANT_CLIP_SEGMENT_LIMIT','At most 120 referenced segments across all renditions per synchronous composition. Use a rendered timeline for longer edits.');
  const vid='clip_'+(await hash(tid+':'+requestKey)).slice(0,28),primary='composition/master.m3u8',ts=now();
  await c.db.run("INSERT INTO videos(id,tenant_id,folder_id,title,kind,status,primary_path,source_path,duration_seconds,encrypted,probe_json,created_at,updated_at,agent_id) VALUES(?,?,?,?,'hls','uploading',?,?,?,?,?,?,?,?)",[vid,tid,folder,title,primary,primary,total,sources.some(s=>s.v.encrypted)?1:0,JSON.stringify({requestHash:digest,instantComposition:true,effectiveRanges:effective}),ts,ts,agentOnly(c)?c.actor.agentId:null]);
  const v=await c.db.one('SELECT * FROM videos WHERE id=?',[vid]);
  try{
    await c.db.batch([...new Set(sources.map(s=>s.v.id))].map(id=>['INSERT INTO video_dependencies(video_id,source_video_id) VALUES(?,?)',[vid,id]]));
    const master=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-INDEPENDENT-SEGMENTS'];
    for(let r=0;r<sources[0].ladders.length;r++){
      const output=['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-PLAYLIST-TYPE:VOD','#EXT-X-MEDIA-SEQUENCE:0'];
      const max=Math.max(...sources.flatMap(s=>s.ladders[r].segments.map(x=>x.duration)));
      output.push('#EXT-X-TARGETDURATION:'+Math.ceil(max));let segmentNumber=0;
      for(let ci=0;ci<sources.length;ci++){
        if(ci)output.push('#EXT-X-DISCONTINUITY');
        const {v:sv,ladders}=sources[ci];
        for(const seg of ladders[r].segments){
          const aliases=[],media=await object(c,sv,seg.path),target=`composition/ref/r${r}-s${segmentNumber++}.ts`;
          aliases.push(['INSERT INTO media_aliases(video_id,path,source_object_id,tenant_id) VALUES(?,?,?,?)',[vid,target,media.id,tid]]);
          if(seg.key){const key=await object(c,sv,seg.key.uri),kp=`composition/ref/key-${key.id}.key`;
            aliases.push(['INSERT OR IGNORE INTO media_aliases(video_id,path,source_object_id,tenant_id) VALUES(?,?,?,?)',[vid,kp,key.id,tid]]);
            output.push(`#EXT-X-KEY:METHOD=AES-128,URI="ref/key-${key.id}.key",IV=${seg.key.iv}`);
          }else output.push('#EXT-X-KEY:METHOD=NONE');
          await c.db.batch(aliases);output.push(`#EXTINF:${seg.duration.toFixed(6)},`,target.slice('composition/'.length));
        }
      }
      output.push('#EXT-X-ENDLIST');const playlist=`composition/r${r}.m3u8`;
      await putObject(c,v,playlist,new TextEncoder().encode(output.join('\n')+'\n'),'playback');
      master.push(sources[0].ladders[r].variant.attrs,`r${r}.m3u8`);
    }
    await putObject(c,v,primary,new TextEncoder().encode(master.join('\n')+'\n'),'playback');
    if(b.tags)await applyTags(c,vid,tid,tagsInput(b.tags));
    await c.db.run("UPDATE videos SET status='ready',uploaded_at=?,updated_at=? WHERE id=?",[now(),now(),vid]);
    await c.db.audit(tid,c.actor.email,'video.instant_compose',vid,{effectiveRanges:effective,duration:total});
    return {...publicVideo(await c.db.one('SELECT * FROM videos WHERE id=?',[vid])),effectiveRanges:effective,note:'Whole independent segments reused without re-encoding. Boundary expansion is disclosed. Source deletion is blocked until dependent clips are removed. R2 playlist storage, reads and D1 operations still cost money.'};
  }catch(e){await c.db.run("UPDATE videos SET status='failed',last_error=?,updated_at=? WHERE id=?",[e.code||'CLIP_COMPOSITION_FAILED',now(),vid]);throw e;}
}
