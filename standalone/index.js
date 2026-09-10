import {router} from './router.js';
import {register} from './routes.js';
import {DB} from '../src/db.js';
import {Meter,flush} from '../src/meter.js';
import {json,fail,safeError,bodyJSON} from '../src/util.js';
import {isLocal,csrf,login,logout} from '../src/auth.js';
import {mcp} from '../src/mcp.js';
import * as P from '../src/playback.js';
import * as F from '../src/media-features.js';
import * as IO from '../src/job-io.js';
import * as J from '../src/jobs.js';
import {recoverBatches} from '../src/media-plans/batches.js';
import {queueJobEvents} from '../src/job-events/service.js';
import {deliverWebhooks} from '../src/workspace.js';
import {playerCsp,workspaceCsp} from '../src/security-headers.js';
export {MediaContainer} from '../src/container.js';
const routes=router();register(routes);
export const ROUTE_CATALOG=routes.routes.map(({method,path})=>({method,path}));
export function context(req,env,ctx){const meter=new Meter();meter.tenantId=env.WORKSPACE_ID;return {req,env,ctx,meter,db:new DB(env.DB,meter)};}
async function installation(c){
  if(!/^t_[A-Za-z0-9_-]{1,100}$/.test(c.env.WORKSPACE_ID||''))fail(503,'INSTALLATION_REQUIRED');
  const rows=await c.db.all('SELECT id FROM tenants LIMIT 2');
  if(rows.length!==1||rows[0].id!==c.env.WORKSPACE_ID)fail(503,'INSTALLATION_WORKSPACE_MISMATCH');
}
async function dispatch(c){
  await installation(c);
  const u=new URL(c.req.url),p=u.pathname,m=c.req.method;
  if(p==='/healthz')return json({ok:true,edition:'single-workspace',release:c.env.RELEASE_SHA||null,sourceUrl:c.env.SOURCE_URL||null});
  if(p==='/source-code')return json({license:'AGPL-3.0-only',sourceUrl:c.env.SOURCE_URL||null,release:c.env.RELEASE_SHA||null});
  if(p==='/auth/access'&&m==='GET')return login(c);
  if(p==='/auth/dev'&&m==='POST'){if(!isLocal(c.env,c.req))fail(404,'NOT_FOUND');csrf(c);return login(c,(await bodyJSON(c.req)).email);}
  if(p==='/auth/logout'&&m==='POST'){csrf(c);return logout(c);}
  if(p==='/mcp')return mcp(c);
  const media=/^\/media\/([^/]+)\/(.+)$/.exec(p);
  if(media&&['GET','HEAD'].includes(m))return P.media(c,media[1],media[2]);
  const download=/^\/download\/([^/]+)$/.exec(p);
  if(download&&['GET','HEAD'].includes(m))return F.serveDownload(c,download[1]);
  const source=/^\/source\/([^/]+)\/([^/]+)\/(.+)$/.exec(p);
  if(source&&['GET','HEAD'].includes(m))return IO.sourceFile(c,await IO.jobAuth(c,source[1]),source[2],source[3]);
  if(p.startsWith('/api/')){if(!p.startsWith('/api/internal/')&&!p.startsWith('/api/playback/'))csrf(c);const value=await routes.dispatch(c);return value instanceof Response?value:json(value);}
  if(['/auth/','/media/','/download/','/source/','/__internal_cache/'].some(x=>p.startsWith(x)))fail(404,'NOT_FOUND');
  const headers=new Headers();headers.set('Cache-Control','no-store');
  if(p.startsWith('/watch/')){
    const v=await c.db.one("SELECT allowed_origins_json FROM videos WHERE id=? AND tenant_id=? AND status NOT IN ('deleted','deleting')",[p.slice(7),c.env.WORKSPACE_ID]);
    if(!v)fail(404,'VIDEO_NOT_FOUND');headers.set('Content-Security-Policy',playerCsp(JSON.parse(v.allowed_origins_json)));
  }else headers.set('Content-Security-Policy',workspaceCsp());
  const asset=await c.env.ASSETS.fetch(c.req);for(const [k,v]of asset.headers)if(!headers.has(k))headers.set(k,v);
  return new Response(asset.body,{status:asset.status,headers});
}
export default {
  async fetch(req,env,ctx){const c=context(req,env,ctx);let response;try{response=await dispatch(c);}catch(error){const e=safeError(error);response=json({error:{code:e.code,message:e.message,requestId:c.meter.id}},e.status);}
    ctx.waitUntil(flush(c,response.status).catch(()=>console.error('METER_PERSIST_FAILED')));
    const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');h.set('X-Request-Id',c.meter.id);if(!h.has('Cache-Control'))h.set('Cache-Control','no-store');
    return new Response(response.body,{status:response.status,headers:h});
  },
  async queue(batch,env,ctx){for(const message of batch.messages){const c=context(new Request(env.APP_ORIGIN+'/internal/queue'),env,ctx);try{await installation(c);if(!message.body?.jobId)fail(400,'UNKNOWN_QUEUE_MESSAGE');await J.stepJob(c,message.body.jobId);message.ack();}catch{message.retry({delaySeconds:60});}finally{await flush(c,200);}}},
  async scheduled(event,env,ctx){const c=context(new Request(env.APP_ORIGIN+'/internal/cron'),env,ctx);await installation(c);await J.recoverJobs(c);await recoverBatches(c);await queueJobEvents(c);await deliverWebhooks(c);await flush(c,200);}
};
