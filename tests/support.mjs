import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
export class LocalD1 {
 constructor(filename=':memory:'){this.sqlite=new DatabaseSync(filename);this.sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');}
 prepare(sql){return new LocalStatement(this,sql);}
 exec(sql){this.sqlite.exec(sql);return {count:1,duration:0};}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>s.execute());this.sqlite.exec('COMMIT');return out;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
 close(){this.sqlite.close();}
}
class LocalStatement{
 constructor(db,sql,params=[]){this.db=db;this.sql=sql;this.params=params;}
 bind(...params){return new LocalStatement(this.db,this.sql,params);}
 execute(){const stmt=this.db.sqlite.prepare(this.sql);const isRead=stmt.columns().length>0;let results=[],changes=0,lastRowId=0;const before=this.db.sqlite.prepare('SELECT total_changes() n').get().n;
 if(isRead)results=stmt.all(...this.params).map(r=>({...r}));else{const r=stmt.run(...this.params);changes=Number(r.changes);lastRowId=Number(r.lastInsertRowid);}
 const after=this.db.sqlite.prepare('SELECT total_changes() n').get().n;
 return {success:true,results,meta:{changes,last_row_id:lastRowId,rows_read:results.length,rows_written:after-before,duration:0,local_rows_read_is_approximate:true}};}
 async run(){return this.execute();}async all(){return this.execute();}async first(column){const row=this.execute().results[0]||null;return column&&row?row[column]:row;}
}
export class LocalR2{
 constructor(root){this.root=root;}
 name(key){return createHash('sha256').update(key).digest('hex');}
 async init(){await fs.mkdir(path.join(this.root,'objects'),{recursive:true});await fs.mkdir(path.join(this.root,'multipart'),{recursive:true});return this;}
 async put(key,value,options={}){const file=path.join(this.root,'objects',this.name(key));const data=value instanceof ReadableStream?Buffer.from(await new Response(value).arrayBuffer()):Buffer.from(value);await fs.writeFile(file+'.bin',data);const meta={key,size:data.length,etag:createHash('sha256').update(data).digest('hex'),httpMetadata:options.httpMetadata||{},uploaded:new Date().toISOString()};await fs.writeFile(file+'.json',JSON.stringify(meta));return meta;}
 async head(key){try{return JSON.parse(await fs.readFile(path.join(this.root,'objects',this.name(key)+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async get(key,options={}){const m=await this.head(key);if(!m)return null;const range=options?.range;const start=range?.offset??0,end=range?Math.min(m.size-1,start+range.length-1):m.size-1;const filename=path.join(this.root,'objects',this.name(key)+'.bin');const stream=m.size?Readable.toWeb(createReadStream(filename,{start,end})):new ReadableStream({start(c){c.close();}});return {...m,body:stream,range,async arrayBuffer(){const b=await fs.readFile(filename);const s=b.subarray(start,end+1);return s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength);},async text(){return new TextDecoder().decode(await this.arrayBuffer());}};}
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys]){const file=path.join(this.root,'objects',this.name(key));await fs.rm(file+'.bin',{force:true});await fs.rm(file+'.json',{force:true});}}
 async createMultipartUpload(key,options={}){const id=randomUUID();const dir=path.join(this.root,'multipart',id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'meta.json'),JSON.stringify({key,options}));return this.resumeMultipartUpload(key,id);}
 resumeMultipartUpload(key,uploadId){const bucket=this,dir=path.join(this.root,'multipart',uploadId);return {key,uploadId,async uploadPart(partNumber,value){const meta=JSON.parse(await fs.readFile(path.join(dir,'meta.json'),'utf8'));if(meta.key!==key)throw new Error('Multipart key mismatch');const bytes=Buffer.from(value),etag=createHash('sha256').update(bytes).digest('hex');await fs.writeFile(path.join(dir,String(partNumber)+'.part'),bytes);return {partNumber,etag};},async complete(parts){const meta=JSON.parse(await fs.readFile(path.join(dir,'meta.json'),'utf8'));if(meta.key!==key)throw new Error('Multipart key mismatch');const dest=path.join(bucket.root,'objects',bucket.name(key)),handle=await fs.open(dest+'.bin','w');const digest=createHash('sha256');let size=0;try{for(const p of parts){const bytes=await fs.readFile(path.join(dir,String(p.partNumber)+'.part'));if(createHash('sha256').update(bytes).digest('hex')!==p.etag)throw new Error('Part ETag mismatch');await handle.write(bytes);digest.update(bytes);size+=bytes.length;}}finally{await handle.close();}const result={key,size,etag:digest.digest('hex'),httpMetadata:meta.options.httpMetadata||{},uploaded:new Date().toISOString()};await fs.writeFile(dest+'.json',JSON.stringify(result));await fs.rm(dir,{recursive:true,force:true});return result;},async abort(){await fs.rm(dir,{recursive:true,force:true});}};}
}

export async function createEnvironment({root,origin='http://localhost:8787'}={}) {
  await fs.mkdir(root,{recursive:true});
  const DB=new LocalD1(path.join(root,'test.sqlite'));
  const VIDEOS=await new LocalR2(path.join(root,'objects')).init();
  const env={DB,VIDEOS,ENVIRONMENT:'development',APP_ORIGIN:origin,
    SIGNING_SECRET:'test-only-signing-secret-DO-NOT-DEPLOY-CHANGE-THIS',
    ENCRYPTION_SECRET:'test-only-encryption-secret-DO-NOT-DEPLOY-CHANGE-THIS',
    METERING_MODE:'direct',AI_ENABLED:'false',STREAM_ENABLED:'false',
    PLAYBACK_TTL_SECONDS:'900',MAX_VIDEO_BYTES:'4294967296',DEFAULT_QUOTA_BYTES:'107374182400',
    JOBS:{async send(){throw new Error('HOSTED_PROCESSING_NOT_AVAILABLE_IN_OFFLINE_TEST');}},
    ASSETS:{async fetch(){return new Response('Offline test asset');}}};
  return {env,close(){DB.close();}};
}
