import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {markdown} from '../scripts/docs/markdown.mjs';
import {operationCatalogue} from '../src/contracts/catalogue.js';

test('documentation escapes untrusted content and creates safe links and lists',()=>{
  const html=markdown('# Guide\n\n- [Install](docs/INSTALL_AGENT.md)\n- **Safe** `code`\n\n<script>alert(1)</script>\n[bad](javascript:alert)');
  assert.match(html,/<ul>/);assert.match(html,/href="installation.html"/);
  assert.match(html,/<strong>Safe<\/strong>/);assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/href="javascript:/);assert.throws(()=>markdown('```\nunclosed'),/UNCLOSED/);
});
test('generated documentation matches runtime operations and has no broken local page links',async()=>{
  const build=spawnSync(process.execPath,['scripts/docs.mjs'],{encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const contracts=JSON.parse(await fs.readFile('.site/contracts.json','utf8'));
  assert.deepEqual(contracts.operations.map(x=>x.name),operationCatalogue().map(x=>x.name));
  const openapi=JSON.parse(await fs.readFile('.site/openapi.json','utf8'));
  assert.equal(Object.keys(openapi.paths).length,contracts.operations.length);
  for(const name of (await fs.readdir('.site')).filter(x=>x.endsWith('.html'))){
    const html=await fs.readFile('.site/'+name,'utf8');
    for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if(url.startsWith('https://')||url.startsWith('#'))continue;
      const target=path.resolve('.site',url.split('#')[0]);
      assert.ok(target.startsWith(path.resolve('.site')+path.sep),url);
      await assert.doesNotReject(fs.access(target),name+' → '+url);
    }
  }
});
