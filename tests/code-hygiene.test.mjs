import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {unusedImports} from '../scripts/quality/imports.mjs';
test('unused import checks preserve reexports, aliases and template references',()=>{
 assert.deepEqual(unusedImports("import {unused, value as used} from './x.js'; export {used};"),['unused']);
 assert.deepEqual(unusedImports("import * as ns from './x.js'; console.log(`${ns.value}`);"),[]);
 assert.deepEqual(unusedImports("import Default from './x.js'; const text='Default';"),['Default']);
});
test('application and tooling have no definitely unused import bindings',async()=>{
 const failures=[];
 async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(entry.name!=='vendor')await visit(file);}
  else if(/\.(m?js)$/.test(file)){const names=unusedImports(await fs.readFile(file,'utf8'),file);if(names.length)failures.push({file,names});}
 }}
 for(const root of ['src','standalone','public','scripts'])await visit(root);
 assert.deepEqual(failures,[]);
});
