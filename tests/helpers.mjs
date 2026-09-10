import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import app from '../standalone/index.js';import {createEnvironment} from './support.mjs';
export async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vault-cli-test-'));const local=await createEnvironment({root});const {env}=local;env.WORKSPACE_ID='t_workspace';
 env.DB.sqlite.exec(await fs.readFile('migrations/0001_workspace.sql','utf8'));
 env.DB.sqlite.exec("INSERT INTO tenants(id,name,slug,quota_bytes,created_at,agent_security_version) VALUES('t_workspace','Test workspace','workspace',1000000000,1,1); INSERT INTO members VALUES('t_workspace','owner@example.com','owner',1);");
 const pending=[];const ctx={waitUntil:p=>pending.push(p)};let cookie='';
 async function request(url,{method='GET',body,headers={},raw=false}={}){
  const h={Origin:env.APP_ORIGIN,...headers};if(cookie&&!h.Authorization)h.Cookie=cookie;if(body!==undefined&&!raw)h['Content-Type']='application/json';
  const r=await app.fetch(new Request(env.APP_ORIGIN+url,{method,headers:h,body:body===undefined?undefined:raw?body:JSON.stringify(body)}),env,ctx);
  await Promise.all(pending.splice(0));const data=r.headers.get('Content-Type')?.includes('json')?await r.clone().json():null;return {r,data};
 }
 const logged=await request('/auth/dev',{method:'POST',body:{email:'owner@example.com'}});cookie=logged.r.headers.get('set-cookie').split(';')[0];
 async function checked(url,options){const result=await request(url,options);if(!result.r.ok)throw new Error(JSON.stringify(result.data));return result.data;}
 const tid=env.WORKSPACE_ID;
 const folder=await checked(`/api/tenants/${tid}/folders`,{method:'POST',body:{name:'Agent media'}});
 const agent=await checked(`/api/tenants/${tid}/agents`,{method:'POST',body:{name:'Fixture agent',permissions:['read','write','process','download'],operation_micros:1000000,run_micros:1000000,daily_micros:1000000,monthly_micros:1000000,concurrent_jobs:1,retained_bytes:100000000,upload_bytes_daily:100000000}});
 await checked(`/api/tenants/${tid}/agents/${agent.id}/grants`,{method:'PUT',body:{expectedRevision:agent.revision,grants:[{resourceType:'folder',resourceId:folder.id,access:'write',inherit:true}]}});
 const key=await checked(`/api/tenants/${tid}/agents/${agent.id}/keys`,{method:'POST',body:{label:'Fixture',days:1,scopes:['videos:read','videos:write','processing:write','playback:create','search:read','intelligence:write','downloads:create']}});
 return {root,env,ctx,request,tenant:{id:tid},folder,key:key.token,async close(){await Promise.all(pending.splice(0));local.close();await fs.rm(root,{recursive:true,force:true});}};
}
