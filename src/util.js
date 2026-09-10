/** Dependency-free Worker utilities. Values bound to SQL are never interpolated. */
export class AppError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new AppError(status, code, message); };
export const now = () => Date.now();
export const uid = (prefix = '') => prefix + crypto.randomUUID().replaceAll('-', '');
export const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: {'Cache-Control':'no-store', ...headers} });
export const enc = new TextEncoder();
export const utf8 = new TextDecoder();
export function b64url(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
export function unb64url(s) { if (!/^[A-Za-z0-9_-]+$/.test(s)) fail(401,'BAD_TOKEN'); const a = atob(s.replaceAll('-','+').replaceAll('_','/') + '='.repeat((4-s.length%4)%4)); return Uint8Array.from(a, c=>c.charCodeAt(0)); }
export async function hash(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(36)));
export function text(v, name, max=200, min=1) { if (typeof v !== 'string' || v.trim().length < min || v.length>max) fail(400,'INVALID_INPUT',`${name} must be ${min}–${max} characters.`); return v.trim(); }
export function integer(v, name, min=0, max=Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(v) || v<min || v>max) fail(400,'INVALID_INPUT',`${name} must be an integer from ${min} to ${max}.`); return v; }
export function number(v, name, min=0, max=Number.MAX_SAFE_INTEGER) { if (typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max) fail(400,'INVALID_INPUT',`${name} is out of range.`); return v; }
export function choice(v, choices, name) { if (!choices.includes(v)) fail(400,'INVALID_INPUT',`Invalid ${name}.`); return v; }
export function email(v) { v=text(v,'email',254).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(400,'INVALID_EMAIL'); return v; }
export function id(v) { if (!/^[a-zA-Z0-9_-]{1,80}$/.test(v||'')) fail(400,'INVALID_ID'); return v; }
export async function bodyJSON(req, max=131072) {
  const ct=req.headers.get('content-type')||'';
  if(!ct.toLowerCase().startsWith('application/json')) fail(415,'JSON_REQUIRED');
  if(Number(req.headers.get('content-length')||0)>max) fail(413,'BODY_TOO_LARGE');
  // Stream-cap the body; trusting Content-Length alone permits unbounded memory use.
  const reader=req.body?.getReader(); if(!reader) return {};
  let size=0, chunks=[];
  while(true){ const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>max){ await reader.cancel(); fail(413,'BODY_TOO_LARGE'); } chunks.push(value); }
  const all=new Uint8Array(size); let p=0; for(const c of chunks){all.set(c,p);p+=c.length;}
  try { const b=JSON.parse(utf8.decode(all)); if(!b || typeof b!=='object' || Array.isArray(b)) fail(400,'INVALID_JSON'); return b; } catch { fail(400,'INVALID_JSON'); }
}
export function periodBounds(period) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) fail(400,'INVALID_PERIOD','Use YYYY-MM in UTC.');
  const [y,m]=period.split('-').map(Number); return [Date.UTC(y,m-1,1), Date.UTC(y,m,1)];
}
export const currentPeriod = () => new Date().toISOString().slice(0,7);
export function assetPath(path) {
  if(typeof path!=='string' || path.length>250 || path.startsWith('/') || path.includes('\\') || path.includes('%') || path.includes('?') || path.includes('#') || path.includes(':') || path.split('/').some(p=>!p || p==='.' || p==='..') || !/^[A-Za-z0-9_./-]+$/.test(path)) fail(400,'INVALID_ASSET_PATH');
  return path;
}
export function objectKey(tenantId, videoId, path) { return `tenants/${id(tenantId)}/videos/${id(videoId)}/${assetPath(path)}`; }
export function contentType(path) {
  const ext=path.split('.').pop().toLowerCase(); return ({mp4:'video/mp4',m4s:'video/iso.segment',ts:'video/mp2t',m3u8:'application/vnd.apple.mpegurl',vtt:'text/vtt',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webm:'video/webm',mov:'video/quicktime',key:'application/octet-stream',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',json:'application/json',srt:'application/x-subrip'})[ext]||fail(400,'UNSUPPORTED_ASSET');
}
export function parseRange(value,size) {
  if(!value) return null;
  const m=/^bytes=(\d*)-(\d*)$/.exec(value);
  if(!m || (!m[1]&&!m[2]) || size<=0) fail(416,'INVALID_RANGE');
  let start, end;
  if(!m[1]){ const n=Number(m[2]); if(!Number.isSafeInteger(n)||n<=0)fail(416,'INVALID_RANGE'); start=Math.max(0,size-n);end=size-1; }
  else {start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start<0||end<start) fail(416,'INVALID_RANGE');
  return {offset:start,length:end-start+1,end};
}
export function safeError(err) {
  if(err instanceof AppError) return err;
  const s=String(err?.message||'');if(s.includes('CHECK constraint failed: ok=1'))return new AppError(409,'SECURITY_PRECONDITION_CHANGED','A version, permission, approval or claim changed. Refresh before retrying.');
  for(const [code,status] of [['DEPENDENCY_CYCLE',409],['FOLDER_CYCLE',400],['FOLDER_TENANT_MISMATCH',400],['AGENT_BUDGET_EXCEEDED',402],['RUN_BUDGET_EXCEEDED',402],['AGENT_STORAGE_QUOTA_EXCEEDED',413],['CHECK constraint failed: ok=1',409],['VIDEO_HAS_DEPENDENT_CLIPS',409],['DEPENDENCY_NOT_READY_OR_TENANT_MISMATCH',409],['STORAGE_QUOTA_EXCEEDED',413],['INSUFFICIENT_CREDITS',402],['IMMUTABLE',409],['UNIQUE constraint',409]]) if(s.includes(code)) return new AppError(status,code.replace(/\W/g,'_'));
  return new AppError(500,'INTERNAL_ERROR','The request could not be completed. Use the request ID when contacting your administrator.');
}
export function csv(rows, fields) { const q=v=>'"'+String(v??'').replaceAll('"','""')+'"'; return [fields.map(q).join(','),...rows.map(r=>fields.map(f=>q(r[f])).join(','))].join('\r\n'); }
export async function bodyBytes(req,max=8*1024*1024){
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail(413,'BODY_TOO_LARGE');}parts.push(value);}
 const out=new Uint8Array(size);let p=0;for(const part of parts){out.set(part,p);p+=part.length;}return out;
}
export function origins(value){if(!Array.isArray(value)||value.length>20)fail(400,'INVALID_ORIGINS');return [...new Set(value.map(v=>{let u;try{u=new URL(v);}catch{fail(400,'INVALID_ORIGIN');}if(u.protocol!=='https:'||u.origin!==v||u.username||u.password)fail(400,'INVALID_ORIGIN');return u.origin;}))];}
export function allowedExternal(raw,env,purpose='INGEST_HOSTS'){
 let u;try{u=new URL(raw);}catch{fail(400,'INVALID_URL');}
 if(!['https:','rtsp:','rtsps:'].includes(u.protocol)||u.hash)fail(400,'INVALID_SOURCE_URL');
 const allow=(env[purpose]||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allow.includes(u.hostname.toLowerCase()))fail(403,'SOURCE_HOST_NOT_ALLOWLISTED','A super administrator must allow this exact source hostname.');
 if(purpose==='WEBHOOK_HOSTS'&&(u.protocol!=='https:'||u.username||u.password))fail(400,'INVALID_WEBHOOK_URL');return u;
}
export function tagsInput(value){if(!Array.isArray(value)||value.length>30)fail(400,'INVALID_TAGS');return [...new Set(value.map(v=>text(v,'tag',48).toLowerCase()))];}
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
/** Deterministic nested JSON for idempotency digests, never a signature by itself. */
export function canonicalJSON(value){if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';return JSON.stringify(value);}
