import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await fs.mkdir('public/vendor',{recursive:true});await fs.copyFile('node_modules/hls.js/dist/hls.min.js','public/vendor/hls.min.js');
const binary=process.platform==='win32'?'node_modules/.bin/wrangler.cmd':'node_modules/.bin/wrangler';
const result=spawnSync(binary,['deploy','--dry-run','--outdir','.build'],{stdio:'inherit'});process.exitCode=result.status??1;
