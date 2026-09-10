import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createEnvironment} from './support.mjs';

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'vav-runtime-test-'));
const output=process.cwd();
const {default:app}=await import(pathToFileURL(path.join(output,'standalone/index.js')));
const {operationCatalogue}=await import(pathToFileURL(path.join(output,'src/contracts/catalogue.js')));
test.after(async()=>fs.rm(temp,{recursive:true,force:true}));
async function fixture(fn){
  const root=await fs.mkdtemp(path.join(temp,'data-'));
  const local=await createEnvironment({root,migrate:false});const env={...local.env,WORKSPACE_ID:'t_workspace',SUPER_ADMIN_EMAILS:'owner@example.com'};
  env.DB.sqlite.exec(await fs.readFile(path.join(output,'migrations/0001_workspace.sql'),'utf8'));
  env.DB.sqlite.exec("INSERT INTO tenants(id,name,slug,quota_bytes,created_at,agent_security_version) VALUES('t_workspace','My videos','workspace',1000000000,1,1); INSERT INTO members VALUES('t_workspace','owner@example.com','owner',1);");
  const pending=[];let cookie='';const ctx={waitUntil:p=>pending.push(p)};
  async function request(url,{method='GET',body,raw=false,key,anonymous=false}={}){
    const headers={Origin:env.APP_ORIGIN};if(!anonymous&&cookie)headers.Cookie=cookie;if(key)headers.Authorization='Bearer '+key;
    if(body!==undefined&&!raw)headers['Content-Type']='application/json';
    const response=await app.fetch(new Request(env.APP_ORIGIN+url,{method,headers,body:body===undefined?undefined:raw?body:JSON.stringify(body)}),env,ctx);
    await Promise.all(pending.splice(0));const data=response.headers.get('Content-Type')?.includes('json')?await response.clone().json():null;
    return {response,data};
  }
  try{
    const login=await request('/auth/dev',{method:'POST',body:{email:'owner@example.com'},anonymous:true});assert.equal(login.response.status,302,JSON.stringify(login.data));cookie=login.response.headers.get('set-cookie').split(';')[0];
    await fn({request,env});
  }finally{local.close();}
}
test('exported runtime has stored-video contracts and no private administration surface',()=>fixture(async({request,env})=>{
  const caps=await request('/api/capabilities');assert.equal(caps.data.operations.length,78);assert.equal(operationCatalogue().length,78);
  assert.ok(!caps.data.operations.some(x=>x.name.startsWith('live_')||x.name==='billing_report'));
  for(const url of ['/api/admin/billing','/api/admin/tenants/t_workspace/credits','/auth/magic/request'])assert.equal((await request(url,{method:'POST',body:{}})).response.status,404);
  assert.equal((await request('/api/tenants',{method:'POST',body:{name:'other'}})).response.status,404);
  assert.throws(()=>env.DB.sqlite.exec("INSERT INTO tenants(id,name,slug,created_at) VALUES('t_other','Other','other',1)"),/SINGLE_WORKSPACE_ONLY/);
}));
test('multiple named agents get independent keys; uploads, captions, search and revocation work in exported application',()=>fixture(async({request})=>{
  const folder=await request('/api/tenants/t_workspace/folders',{method:'POST',body:{name:'Shared'}});assert.equal(folder.response.status,200,JSON.stringify(folder.data));
  const keys=[];
  for(const name of ['Research','Editor']){
    const agent=await request('/api/tenants/t_workspace/agents',{method:'POST',body:{name,permissions:['read','write','process'],operation_micros:1000000,run_micros:1000000,daily_micros:1000000,monthly_micros:1000000,concurrent_jobs:1,retained_bytes:10000000,upload_bytes_daily:10000000}});
    assert.equal(agent.response.status,200,JSON.stringify(agent.data));
    const grant=await request(`/api/tenants/t_workspace/agents/${agent.data.id}/grants`,{method:'PUT',body:{expectedRevision:agent.data.revision,grants:[{resourceType:'folder',resourceId:folder.data.id,access:'write',inherit:true}]}});
    assert.equal(grant.response.status,200,JSON.stringify(grant.data));
    const key=await request(`/api/tenants/t_workspace/agents/${agent.data.id}/keys`,{method:'POST',body:{label:name,days:1,scopes:['videos:read','videos:write','intelligence:write','search:read','playback:create']}});
    assert.equal(key.response.status,200,JSON.stringify(key.data));keys.push({token:key.data.token,agent:agent.data.id});
  }
  assert.notEqual(keys[0].token,keys[1].token);
  const op=(name,args,key=keys[0].token)=>request('/api/tenants/t_workspace/operations/'+name,{method:'POST',body:args,key});
  const bytes=Buffer.from('0000ftypisom0000testvideo');
  const video=await op('upload_create',{title:'Fixture',kind:'mp4',size:bytes.length,folderId:folder.data.id});assert.equal(video.response.status,200,JSON.stringify(video.data));
  assert.equal((await request(`/api/videos/${video.data.id}/parts/1`,{method:'PUT',body:bytes,raw:true,key:keys[0].token})).response.status,200);
  assert.equal((await op('upload_complete',{videoId:video.data.id})).response.status,200);
  const current=await op('video_get',{videoId:video.data.id});
  const transcript=await op('transcript_import',{videoId:video.data.id,expectedRevision:current.data.revision,segments:[{start:0,end:2,text:'A lighthouse guides ships safely.'}]});assert.equal(transcript.response.status,200,JSON.stringify(transcript.data));
  const search=await op('search_keyword',{query:'lighthouse'},keys[1].token);assert.equal(search.response.status,200,JSON.stringify(search.data));
  const self=await op('agent_self',{},keys[1].token);assert.equal(self.response.status,200);
  const privateFolder=await request('/api/tenants/t_workspace/folders',{method:'POST',body:{name:'Owner only'}});
  const forbidden=await op('upload_create',{title:'Denied',kind:'mp4',size:bytes.length,folderId:privateFolder.data.id});
  assert.equal(forbidden.response.status,403,'Agent cannot upload outside assigned folders');
  const initialize=await request('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'offline-contract-test',version:'1.0.0'},capabilities:{}}},key:keys[1].token});
  assert.equal(initialize.response.status,200);assert.equal(initialize.data.result.serverInfo.name,'videoagentvault');
  const list=await request('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:2,method:'tools/list'},key:keys[1].token});
  assert.ok(list.data.result.tools.some(tool=>tool.name==='search_keyword'));
  assert.ok(!list.data.result.tools.some(tool=>tool.name==='billing_report'||tool.name.startsWith('live_')));
  const call=await request('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'search_keyword',arguments:{query:'lighthouse'}}},key:keys[1].token});
  assert.equal(call.data.result.isError,false);

  const deny=await request('/api/tenants/t_other/operations/videos_list',{method:'POST',body:{},key:keys[1].token});assert.equal(deny.response.status,403);
  const suspended=await request(`/api/tenants/t_workspace/agents/${keys[0].agent}`,{method:'GET'});
  assert.equal((await request(`/api/tenants/t_workspace/agents/${keys[0].agent}`,{method:'PATCH',body:{expectedRevision:suspended.data.revision,status:'suspended'}})).response.status,200);
  assert.equal((await op('agent_self',{},keys[0].token)).response.status,401);
  assert.equal((await op('agent_self',{},keys[1].token)).response.status,200);
}));
