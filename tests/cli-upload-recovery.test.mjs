import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import app from '../standalone/index.js';
import {fixture} from './helpers.mjs';
const main=process.env.VIDEOAGENTVAULT_TEST_CLI||path.resolve('packages/cli/dist/main.js');
async function scenario(drop,verify){
 const f=await fixture(),root=await fs.mkdtemp(path.join(os.tmpdir(),'er-upload-recovery-')),file=path.join(root,'retained fixture.mp4');
 await fs.writeFile(file,Buffer.concat([Buffer.from('0000ftypisom'),Buffer.alloc(8*1024*1024+10)]));
 const captions=path.join(root,'captions.srt');await fs.writeFile(captions,'1\n00:00:00,000 --> 00:00:01,000\nFixture captions\n');
 let dropped=false,creates=0,puts=0,metadataReads=0;
 const server=http.createServer(async(req,res)=>{try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  if(drop==='captions-read'&&req.url.endsWith('/video_get')&&metadataReads++<3){res.writeHead(503,{'Content-Type':'application/json','Retry-After':'0'});res.end(JSON.stringify({error:{code:'TEMPORARY_READ_FAILURE'}}));return;}
  const response=await app.fetch(new Request(f.env.APP_ORIGIN+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),f.env,f.ctx);
  const body=Buffer.from(await response.arrayBuffer());if(req.url.endsWith('/upload_create'))creates++;if(req.method==='PUT')puts++;
  if(!dropped&&((drop==='part'&&req.method==='PUT')||(drop==='create'&&req.url.endsWith('/upload_create'))||(drop==='captions-write'&&req.url.endsWith('/captions_save')))){dropped=true;req.socket.destroy();return;}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const env={...process.env,VIDEOAGENTVAULT_API_KEY:f.key,VIDEOAGENTVAULT_WORKSPACE:f.tenant.id,VIDEOAGENTVAULT_ORIGIN:`http://127.0.0.1:${server.address().port}`,VIDEOAGENTVAULT_CONFIG_DIR:path.join(root,'config')};
 const run=()=>new Promise(resolve=>{const child=spawn(process.execPath,[main,'videos','upload','--file',file,'--folder',f.folder.id,...(drop.startsWith('captions-')?['--srt',captions]:[]),'--dev','--json'],{env,stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('close',code=>resolve({code,out,err}));});
 try{return await verify({run,get counts(){return {creates,puts};},f});}
 finally{await new Promise(resolve=>server.close(resolve));await f.close();await fs.rm(root,{recursive:true,force:true});}
}

test('lost part acknowledgement resumes the same upload without transferring that part twice',async()=>{
 await scenario('part',async s=>{const first=await s.run();assert.equal(first.code,8,first.err);assert.equal(s.counts.puts,1);
 const resumed=await s.run();assert.equal(resumed.code,0,resumed.err);assert.equal(JSON.parse(resumed.out).status,'ready');assert.equal(s.counts.creates,1);assert.equal(s.counts.puts,2);assert.equal(s.f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM videos').get().n,1);
 });
});
test('lost upload-creation acknowledgement stops reconciliation instead of creating duplicate media',async()=>{
 await scenario('create',async s=>{assert.equal((await s.run()).code,8);const resumed=await s.run();assert.equal(resumed.code,8,resumed.err);assert.match(resumed.err,/UPLOAD_CREATE_UNKNOWN/);assert.equal(s.counts.creates,1);assert.equal(s.counts.puts,0);});
});

test('a failed caption metadata read remains resumable without a false unknown-write checkpoint',async()=>{
 await scenario('captions-read',async s=>{assert.equal((await s.run()).code,8);const resumed=await s.run();assert.equal(resumed.code,0,resumed.err);assert.equal(s.counts.creates,1);assert.equal(s.f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM media_tracks').get().n,1);});
});
test('lost caption acknowledgement never creates a second track on resume',async()=>{
 await scenario('captions-write',async s=>{assert.equal((await s.run()).code,8);const resumed=await s.run();assert.equal(resumed.code,8,resumed.err);assert.match(resumed.err,/CAPTIONS_OUTCOME_UNKNOWN/);assert.equal(s.f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM media_tracks').get().n,1);});
});
