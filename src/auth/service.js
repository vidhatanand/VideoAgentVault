import {bindKey,agentOnly,permission} from '../access/policy.js';
import {verifyToken,signToken,verifyAccess} from '../crypto.js';
import {fail,hash,email,uid,now,randomToken,integer,text,json} from '../util.js';
export const SCOPES=['videos:read','videos:write','playback:create','analytics:read','billing:read','processing:write','folders:write','tags:write','search:read','intelligence:write','timelines:write','events:write','sources:write','downloads:create','live:read','live:write','live:playback','live:credentials','policy:write'];
export const roles={viewer:0,editor:1,admin:2,owner:3};

export function createAuth({superUser=()=>false,beforeAuth=async()=>{},authorizeWorkspace=async()=>{}}={}){
function isLocal(env,request){const h=new URL(request.url).hostname;return env.ENVIRONMENT==='development'&&['localhost','127.0.0.1','[::1]'].includes(h);}
function isSuper(env,address){return Boolean(superUser(env,address));}
async function authenticate(c){
  await beforeAuth(c);
  if(c.actor)return c.actor;
  const bearer=c.req.headers.get('authorization');
  if(bearer){
    const m=/^Bearer (er_[A-Za-z0-9_-]+)$/.exec(bearer);if(!m)fail(401,'INVALID_API_KEY');
    const key=await c.db.one('SELECT * FROM api_keys WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?',[await hash(m[1]),now()]);
    if(!key)fail(401,'INVALID_API_KEY');
    await bindKey(c,key.id);if(c.actor.agentId)await c.db.run('UPDATE agents SET last_active_at=? WHERE id=?',[now(),c.actor.agentId]);return c.actor;
  }
  const cookie=(c.req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('er_session='))?.slice(11);
  if(!cookie)fail(401,'LOGIN_REQUIRED');
  const p=await verifyToken(cookie,c.env.SIGNING_SECRET,'session');
  const s=await c.db.one('SELECT email FROM sessions WHERE id=? AND revoked_at IS NULL AND expires_at>?',[p.sid,now()]);
  if(!s||s.email!==p.email)fail(401,'SESSION_REVOKED');
  return c.actor={type:'session',email:s.email,sessionId:p.sid,super:isSuper(c.env,s.email)};
}
async function tenantAuth(c,tenantId,scope='videos:read',minimum='viewer'){
  await authorizeWorkspace(c,tenantId);
  const a=await authenticate(c);
  const t=await c.db.one('SELECT * FROM tenants WHERE id=?',[tenantId]);if(!t)fail(404,'TENANT_NOT_FOUND');if(t.agent_security_version>1)fail(503,'SECURITY_VERSION_UNSUPPORTED');
  if(a.type==='key'){
    if(a.tenantId!==tenantId||!a.scopes.includes(scope))fail(403,'INSUFFICIENT_SCOPE');
    if(t.agent_security_version>0&&a.legacy)fail(403,'LEGACY_KEY_RETIRED');
    if(agentOnly(c)){if(['billing:read','policy:write','events:write','sources:write','live:read','live:write','live:playback'].includes(scope))fail(403,'HUMAN_MANAGED_CAPABILITY');if(['videos:write','intelligence:write','timelines:write','folders:write','tags:write'].includes(scope))permission(c,'write');if(scope==='processing:write')permission(c,'process');if(scope==='downloads:create')permission(c,'download');if(scope==='live:credentials')permission(c,'live_credentials');}
  }else if(!a.super){
    const m=await c.db.one('SELECT role FROM members WHERE tenant_id=? AND email=?',[tenantId,a.email]);
    if(!m||roles[m.role]<roles[minimum])fail(403,'FORBIDDEN');a.role=m.role;
  }
  if(t.status!=='active'&&!a.super)fail(403,'TENANT_SUSPENDED');
  c.meter.tenantId=tenantId;c.tenant=t;return t;
}
async function superAuth(c){const a=await authenticate(c);if(!a.super||a.type!=='session')fail(403,'SUPER_ADMIN_REQUIRED');return a;}
function csrf(c){
  if(['GET','HEAD','OPTIONS'].includes(c.req.method)||c.req.headers.has('authorization'))return;
  const origin=c.req.headers.get('origin');
  if(origin!==c.env.APP_ORIGIN)fail(403,'CSRF_ORIGIN_REJECTED');
}
async function login(c,devEmail){
  await beforeAuth(c);
  let address;
  if(devEmail){if(!isLocal(c.env,c.req))fail(404,'NOT_FOUND');address=email(devEmail);}
  else{const p=await verifyAccess(c.req.headers.get('Cf-Access-Jwt-Assertion'),c.env);address=email(p.email);}
  if(!isSuper(c.env,address)&&!await c.db.one('SELECT tenant_id FROM members WHERE email=? LIMIT 1',[address]))fail(403,'INVITATION_REQUIRED','Ask the workspace owner to add your email first.');
  const sid=uid('s_'),expires=now()+8*3600000;
  await c.db.run('INSERT INTO sessions(id,email,created_at,expires_at) VALUES(?,?,?,?)',[sid,address,now(),expires]);
  const token=await signToken({scope:'session',sid,email:address},c.env.SIGNING_SECRET,8*3600);
  const secure=new URL(c.req.url).protocol==='https:'?'; Secure':'';
  return new Response(null,{status:302,headers:{Location:'/', 'Cache-Control':'no-store','Set-Cookie':`er_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`}});
}
async function logout(c){const a=await authenticate(c);if(a.sessionId)await c.db.run('UPDATE sessions SET revoked_at=? WHERE id=?',[now(),a.sessionId]);return json({ok:true},200,{'Set-Cookie':'er_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'});}
async function createKey(c,tenantId,b){
  await tenantAuth(c,tenantId,'videos:write','admin');if(c.actor.type==='key')fail(403,'SESSION_REQUIRED');
  if(c.tenant.agent_security_version>0&&!b.agentId)fail(400,'NAMED_AGENT_REQUIRED');
  if(b.agentId&&!await c.db.one("SELECT id FROM agents WHERE id=? AND tenant_id=? AND status='active' AND legacy=0",[b.agentId,tenantId]))fail(404,'AGENT_NOT_FOUND');
  const label=text(b.label,'label',80), scopes=b.scopes;
  if(!Array.isArray(scopes)||!scopes.length||scopes.some(x=>!SCOPES.includes(x)))fail(400,'INVALID_SCOPES');
  const days=integer(b.days??90,'days',1,365),token='er_'+randomToken(),kid=uid('k_');
  const aid=b.agentId??uid('legacy_');if(!b.agentId)await c.db.run('INSERT INTO agents(id,tenant_id,name,purpose,legacy,created_by,created_at) VALUES(?,?,?,?,1,?,?)',[aid,tenantId,label+' ['+kid+']','Legacy workspace-wide credential; owner review required',c.actor.email,now()]);
  await c.db.run('INSERT INTO api_keys(id,tenant_id,token_hash,label,scopes_json,created_at,expires_at,agent_id) VALUES(?,?,?,?,?,?,?,?)',[kid,tenantId,await hash(token),label,JSON.stringify([...new Set(scopes)]),now(),now()+days*86400000,aid]);
  await c.db.audit(tenantId,c.actor.email,'key.create',kid,{label,scopes});return {id:kid,token,scopes,expiresAt:now()+days*86400000};
}
return {isLocal,isSuper,authenticate,tenantAuth,superAuth,csrf,login,logout,createKey};
}
