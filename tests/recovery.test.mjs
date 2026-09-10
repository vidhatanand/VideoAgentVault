import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {fixture} from './helpers.mjs';import {snapshotQuery,decodeSnapshot,schemaQuery,columnsQuery,applicationColumnsQuery} from '../scripts/recovery/snapshot-query.mjs';import {restoreSnapshot} from '../scripts/recovery/restore-snapshot.mjs';
test('single-statement snapshot restores the full application schema and FTS without copying shadows',async()=>{
 const f=await fixture();try{const db=f.env.DB.sqlite;const plan=snapshotQuery(db.prepare('PRAGMA table_list').all().map(r=>({...r})),db.prepare(schemaQuery).all().map(r=>({...r})),db.prepare(columnsQuery).all());
 const snapshot=decodeSnapshot(plan,db.prepare(plan.sql).all());assert.ok(!snapshot.tables.some(t=>t.name==='artifacts_fts_data'));assert.ok(snapshot.schema.some(t=>t.name==='artifacts_fts'));
 const result=restoreSnapshot(snapshot,':memory:');assert.ok(result.foreignKeys&&result.integrity&&result.ftsRebuilt);assert.equal(result.tableCounts.tenants,1);
 assert.throws(()=>decodeSnapshot(plan,db.prepare(plan.sql).all().slice(1)),/Schema receipt/);
 }finally{await f.close();}
});
test('recovery preserves AUTOINCREMENT high-water mark after deleted rows',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,value TEXT); INSERT INTO events VALUES(50,\'deleted\'); DELETE FROM events;');
 const plan=snapshotQuery(db.prepare('PRAGMA table_list').all().map(r=>({...r})),db.prepare(schemaQuery).all().map(r=>({...r})),db.prepare(columnsQuery).all());const snapshot=decodeSnapshot(plan,db.prepare(plan.sql).all());assert.equal(snapshot.tables.find(t=>t.name==='sqlite_sequence').rows[0].seq,50);const folder=fs.mkdtempSync(path.join(os.tmpdir(),'er-restore-sequence-')),file=path.join(folder,'restore.sqlite');
 try{const result=restoreSnapshot(snapshot,file);assert.equal(result.tableCounts.sqlite_sequence,1);const restored=new DatabaseSync(file);try{assert.equal(Number(restored.prepare("INSERT INTO events(value) VALUES('next')").run().lastInsertRowid),51);}finally{restored.close();}assert.throws(()=>restoreSnapshot(snapshot,file),/EEXIST/);}finally{fs.rmSync(folder,{recursive:true,force:true});}
 }finally{db.close();}
});

test('remote column introspection excludes provider internals and FTS shadow tables',()=>{
 const query=applicationColumnsQuery([{schema:'main',type:'table',name:'videos'},{schema:'main',type:'table',name:'_cf_KV'},{schema:'main',type:'shadow',name:'artifacts_fts_data'}]);
 assert.match(query,/pragma_table_xinfo\(names.value\)/);assert.ok(query.includes('videos'));assert.ok(!query.includes('_cf_KV'));assert.ok(!query.includes('artifacts_fts_data'));
});

test('snapshot remains one read with 80 application tables with compound SELECT disabled',()=>{
 const db=new DatabaseSync(':memory:');try{const ddl=Array.from({length:80},(_,i)=>`CREATE TABLE t${i}(id INTEGER PRIMARY KEY,value TEXT);`).join('');db.exec(ddl);const tables=db.prepare('PRAGMA table_list').all(),columns=db.prepare(columnsQuery).all(),schema=db.prepare(schemaQuery).all().map(r=>({...r}));const plan=snapshotQuery(tables,schema,columns);
 const python=spawnSync('python3',['-c',`import sys,json,sqlite3
p=json.load(sys.stdin); d=sqlite3.connect(':memory:'); d.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,1); d.executescript(p['ddl']); assert len(d.execute(p['sql']).fetchall())==81; assert len(d.execute(p['columns']).fetchall())==160`],{input:JSON.stringify({ddl,sql:plan.sql,columns:applicationColumnsQuery(tables)}),encoding:'utf8'});assert.equal(python.status,0,python.stderr);
 }finally{db.close();}
});

test('backup bundles reject altered bytes and preserve existing restore destinations',async()=>{
 const {writeBundle,readBundle}=await import('../scripts/recovery/bundle.mjs');
 const f=await fixture(),dir=path.join(f.root,'backup');try{
  const db=f.env.DB.sqlite,plan=snapshotQuery(db.prepare('PRAGMA table_list').all(),db.prepare(schemaQuery).all().map(x=>({...x})),db.prepare(columnsQuery).all());
  const snapshot=decodeSnapshot(plan,db.prepare(plan.sql).all());await writeBundle(dir,snapshot);
  assert.equal((await readBundle(dir)).snapshot.tables.find(t=>t.name==='tenants').rows.length,1);
  await assert.rejects(()=>writeBundle(dir,snapshot),/EEXIST/);
  fs.appendFileSync(path.join(dir,'snapshot.json'),' ');await assert.rejects(()=>readBundle(dir),/CHECKSUM_MISMATCH/);
 }finally{await f.close();}
});

test('fresh-database import restores the standalone schema and refuses an occupied target',async()=>{
 const {restoreSql}=await import('../scripts/recovery/restore-sql.mjs');const f=await fixture();const target=new DatabaseSync(':memory:');
 try{const db=f.env.DB.sqlite,plan=snapshotQuery(db.prepare('PRAGMA table_list').all(),db.prepare(schemaQuery).all().map(x=>({...x})),db.prepare(columnsQuery).all());const snapshot=decodeSnapshot(plan,db.prepare(plan.sql).all());
  const sql=restoreSql(snapshot);target.exec('BEGIN;'+sql+'COMMIT;');assert.equal(target.prepare('SELECT count(*) n FROM agents').get().n,1);assert.equal(target.prepare('SELECT count(*) n FROM agent_folder_access').get().n,1);assert.equal(target.prepare('SELECT count(*) n FROM agent_video_access').get().n,0);assert.equal(target.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(target.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.throws(()=>target.exec(sql),/already exists/);
 }finally{target.close();await f.close();}
});
