import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {operationCatalogue} from '../src/contracts/catalogue.js';
import {validate} from '../src/mcp/validate.js';
import {parse,input} from '../packages/cli/dist/commands/arguments.js';
import {aliases} from '../packages/cli/dist/commands/catalogue.js';
import {featureCatalogue} from '../scripts/docs/feature-catalogue.mjs';
const readme=await fs.readFile('README.md','utf8');
const gallery=await fs.readFile('docs/GALLERY.md','utf8');
const operations=operationCatalogue();

test('README and gallery navigation resolve to real files and section anchors',async()=>{
 const headings=new Set([...readme.matchAll(/^#{1,6} (.+)$/gm)].map(([,s])=>s.toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s/g,'-')));
 for(const [source,base] of [[readme,'.'],[gallery,'docs']]){
  const urls=[...[...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(m=>m[1]),...[...source.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1])];
  for(const url of urls){if(url.startsWith('https://'))continue;if(url.startsWith('#')){assert.ok(headings.has(url.slice(1)),url);continue;}
   assert.ok(!url.includes('://'),'Unexpected link protocol');await assert.doesNotReject(fs.access(path.resolve(base,url.split('#')[0])),url);
  }
 }
 assert.match(readme,new RegExp(`\\*\\*${operations.length} stored-video operations\\*\\*`));
});

test('README CLI examples use accepted commands, flags and operation inputs',async()=>{
 const blocks=[...readme.matchAll(/```sh\n([\s\S]*?)```/g)].map(m=>m[1].replace(/\\\n\s*/g,' '));let checked=0;
 for(const block of blocks)for(const line of block.split('\n')){
  if(!line.startsWith('videoagentvault '))continue;
  const words=line.match(/'[^']*'|"[^"]*"|\S+/g).map(w=>w.replace(/^(['"])(.*)\1$/,'$2'));
  const {values,positionals}=parse(words.slice(1));if(values.help){checked++;continue;}
  const name=positionals[0]==='call'?positionals[1]:aliases[positionals.slice(0,2).join(' ')];
  if(positionals.join(' ')==='videos upload'){assert.ok(values.file&&values.srt&&values.folder&&values.checkpoint);checked++;continue;}
  const operation=operations.find(op=>op.name===name);assert.ok(operation,'Unknown example operation: '+line);validate(operation.inputSchema,await input(values.data));checked++;
 }
 assert.ok(checked>=5);
 const pkg=JSON.parse(await fs.readFile('package.json','utf8'));for(const [,script]of readme.matchAll(/npm run ([\w:]+)/g))assert.ok(pkg.scripts[script],script);
 const mcp=JSON.parse([...readme.matchAll(/```json\n([\s\S]*?)```/g)][0][1]).mcpServers.videoagentvault;
 assert.equal(mcp.command,'videoagentvault');assert.deepEqual(parse(mcp.args).positionals,['mcp','serve']);assert.ok(parse(mcp.args).values['key-file']);assert.equal(new URL(mcp.env.VIDEOAGENTVAULT_ORIGIN).protocol,'https:');
});

test('all six gallery captures are valid, bounded JPEGs with descriptive alternative text',async()=>{
 const captures=[...readme.matchAll(/<img src="(docs\/assets\/gallery\/[^" ]+)" alt="([^"]+)"/g)];assert.equal(captures.length,6);let total=0;
 for(const [,file,alt]of captures){assert.ok(alt.length>35);const bytes=await fs.readFile(file);assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');assert.equal(bytes.subarray(-2).toString('hex'),'ffd9');let width=0,height=0;for(let pos=2;pos<bytes.length;){assert.equal(bytes[pos],255);const marker=bytes[pos+1],length=bytes.readUInt16BE(pos+2);if([192,193,194].includes(marker)){height=bytes.readUInt16BE(pos+5);width=bytes.readUInt16BE(pos+7);break;}assert.ok(length>=2);pos+=length+2;}assert.ok(width>=1000&&height>=600&&height<=1800,file);assert.ok(bytes.length<500000,file);total+=bytes.length;}
 assert.ok(total<2000000,'Keep the public screenshot gallery lightweight');
 assert.match(gallery,/synthetic/i);assert.match(gallery,/Hosted processing was disabled/);
});

test('README tables contain all runtime operations exactly once and stay generated',()=>{
 const block=readme.match(/<!-- feature-catalogue:start -->[\s\S]*?<!-- feature-catalogue:end -->/)[0];
 assert.equal(block,featureCatalogue());
 const names=[...block.matchAll(/\| \[\`([^`]+)\`\]\(/g)].map(m=>m[1]);
 assert.deepEqual([...names].sort(),operations.map(op=>op.name).sort());
});
