import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import app from '../standalone/index.js';
import {fixture} from './helpers.mjs';
import {invoke} from '../packages/cli/dist/commands/invoke.js';
import {operation,aliases} from '../packages/cli/dist/commands/catalogue.js';
import {Client,checkedEndpoint} from '../packages/cli/dist/transport/client.js';
import {CliError} from '../packages/cli/dist/errors/index.js';
const cli=process.env.VIDEOAGENTVAULT_TEST_CLI||path.resolve('packages/cli/dist/main.js');
async function run(args,env={},stdin=''){return new Promise(resolve=>{const p=spawn(process.execPath,[cli,...args],{env:{...process.env,VIDEOAGENTVAULT_API_KEY:'',...env},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',code=>resolve({code,out,err}));p.stdin.end(stdin);});}
async function serve(handler){const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};}
test('offline help, completion and aliases require no key or network',async()=>{
 assert.equal((await run(['--help'])).code,0);for(const shell of ['bash','zsh','powershell'])assert.equal((await run(['completion','--shell',shell])).code,0);
 for(const [name,target] of Object.entries(aliases))assert.ok(operation(target),name);
 assert.throws(()=>checkedEndpoint('http://example.com',true));assert.throws(()=>checkedEndpoint('http://localhost'));assert.throws(()=>checkedEndpoint('https://user:pass@example.com'));assert.equal(checkedEndpoint('http://localhost:8888',true),'http://localhost:8888');
 assert.equal((await run(['auth','check','--api-key','must-not-print'])).code,2);
});
test('redirects never forward credentials; mutations do not auto-retry',async()=>{
 let received=0,calls=0;const target=await serve((req,res)=>{received++;res.end('{}');});const redirect=await serve((req,res)=>{calls++;res.writeHead(302,{location:target.origin});res.end();});try{
 const client=new Client(redirect.origin,'er_test_secret','test');await assert.rejects(()=>client.request('/api/test'),/redirect rejected/);assert.equal(received,0);assert.equal(calls,1);
 }finally{await redirect.close();await target.close();}
});
test('matching paid intent retains one request key after unknown outcome and stores no raw prompt',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'er-cli-intent-')),old=process.env.VIDEOAGENTVAULT_CONFIG_DIR;process.env.VIDEOAGENTVAULT_CONFIG_DIR=root;const keys=[];const client={origin:'https://example.test',async call(t,n,args){keys.push(args.requestKey);if(keys.length===1)throw new CliError('TRANSPORT_UNKNOWN','Unknown',8);return {id:'job_one'};}};
 try{const args={kind:'summarize',videoId:'v_test',prompt:'private prompt never persisted'};await assert.rejects(()=>invoke(client,'t_test',operation('processing_start'),{...args},{yes:true,'max-usd':'1'}));await invoke(client,'t_test',operation('processing_start'),{...args},{yes:true,'max-usd':'1'});assert.equal(keys[0],keys[1]);for(const file of await fs.readdir(path.join(root,'requests')))assert.doesNotMatch(await fs.readFile(path.join(root,'requests',file),'utf8'),/private prompt/);
 }finally{if(old===undefined)delete process.env.VIDEOAGENTVAULT_CONFIG_DIR;else process.env.VIDEOAGENTVAULT_CONFIG_DIR=old;await fs.rm(root,{recursive:true,force:true});}
});
test('CLI command flow uploads and resumes once, searches imported captions, issues player and bridges MCP',async()=>{
 const f=await fixture();const server=await serve(async(req,res)=>{try{const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);const request=new Request(f.env.APP_ORIGIN+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body});const response=await app.fetch(request,f.env,f.ctx);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('{}');}});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'er-cli-media-')),file=path.join(dir,'a video.mp4'),captions=path.join(dir,'captions.srt');await fs.writeFile(file,Buffer.from('0000ftypisom0000testvideo'));await fs.writeFile(captions,'1\n00:00:00,000 --> 00:00:01,000\nHello launch\n');
 const env={VIDEOAGENTVAULT_API_KEY:f.key,VIDEOAGENTVAULT_WORKSPACE:f.tenant.id,VIDEOAGENTVAULT_ORIGIN:server.origin,VIDEOAGENTVAULT_CONFIG_DIR:path.join(dir,'config')},exec=(args,input)=>run([...args,'--dev','--json'],env,input);
 try{
  let r=await exec(['auth','check']);assert.equal(r.code,0,r.err);
  r=await exec(['videos','upload','--file',file,'--folder',f.folder.id,'--srt',captions]);assert.equal(r.code,0,r.err);const uploaded=JSON.parse(r.out);assert.equal(uploaded.status,'ready');
  r=await exec(['videos','upload','--file',file,'--folder',f.folder.id,'--srt',captions]);assert.equal(r.code,0,r.err);assert.equal(JSON.parse(r.out).videoId,uploaded.videoId);assert.equal(f.env.DB.sqlite.prepare('SELECT count(*) n FROM videos WHERE tenant_id=?').get(f.tenant.id).n,1);
  r=await exec(['call','transcript_import','--data','-'],JSON.stringify({videoId:uploaded.videoId,expectedRevision:(await f.request('/api/videos/'+uploaded.videoId)).data.revision,segments:[{start:0,end:1,text:'Hello launch'}]}));assert.equal(r.code,0,r.err);
  r=await exec(['call','search_keyword','--data',JSON.stringify({query:'launch'})]);assert.equal(r.code,0,r.err);assert.match(r.out,/Hello launch/);
  r=await exec(['players','create','--data',JSON.stringify({videoId:uploaded.videoId,viewerId:'fixture-viewer'})]);assert.equal(r.code,0,r.err);assert.ok(JSON.parse(r.out).url.includes('/media/'));
  r=await exec(['jobs','start','--data',JSON.stringify({kind:'index',videoId:uploaded.videoId})]);assert.equal(r.code,6);assert.equal(f.env.DB.sqlite.prepare('SELECT count(*) n FROM jobs').get().n,0);
  const mcp=await run(['mcp','serve','--dev'],env,JSON.stringify({jsonrpc:'2.0',id:42,method:'initialize',params:{protocolVersion:'2025-11-25'}})+'\n');assert.equal(mcp.code,0,mcp.err);assert.equal(JSON.parse(mcp.out).result.protocolVersion,'2025-11-25');assert.doesNotMatch(mcp.err,new RegExp(f.key));
  await fs.appendFile(file,'change');r=await exec(['videos','upload','--file',file,'--folder',f.folder.id,'--srt',captions]);assert.equal(r.code,5);
 }finally{await server.close();await f.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('watch reports terminal failures and timeout without cancellation',async()=>{
 let state='failed',cancelled=false;const server=await serve(async(req,res)=>{cancelled||=req.url.includes('cancel');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'j_watch',state,progress:{eta:null}}));});
 try{const r=await run(['jobs','watch','--id','j_watch','--dev','--json'],{VIDEOAGENTVAULT_ORIGIN:server.origin,VIDEOAGENTVAULT_WORKSPACE:'t_test',VIDEOAGENTVAULT_API_KEY:'er_watch'});assert.equal(r.code,7);assert.match(r.err,/JOB_FAILED/);state='queued';const timed=await run(['jobs','watch','--id','j_watch','--dev','--timeout','0.15','--interval','0.1'],{VIDEOAGENTVAULT_ORIGIN:server.origin,VIDEOAGENTVAULT_WORKSPACE:'t_test',VIDEOAGENTVAULT_API_KEY:'er_watch'});assert.equal(timed.code,9);assert.equal(cancelled,false);}finally{await server.close();}
});
test('download is atomic and refuses overwriting an existing file',async()=>{
 const {saveDownload}=await import('../packages/cli/dist/commands/download.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'er-download-'));const server=await serve((req,res)=>{assert.equal(req.headers.authorization,undefined);res.setHeader('Content-Length','5');res.end('video');});
 try{const out=path.join(root,'video.mp4');await saveDownload({url:server.origin+'/download/id'},server.origin,out);assert.equal(await fs.readFile(out,'utf8'),'video');await assert.rejects(()=>saveDownload({url:server.origin+'/download/id'},server.origin,out),/overwrite/);assert.deepEqual(await fs.readdir(root),['video.mp4']);await assert.rejects(()=>saveDownload({url:'https://other.test/download/id'},server.origin,out),/same-origin/);}finally{await server.close();await fs.rm(root,{recursive:true,force:true});}
});
