import fs from 'node:fs/promises';
import {featureCatalogue} from './feature-catalogue.mjs';
const file='README.md',source=await fs.readFile(file,'utf8');
const pattern=/<!-- feature-catalogue:start -->[\s\S]*?<!-- feature-catalogue:end -->/;
if(!pattern.test(source))throw new Error('README_FEATURE_MARKERS_MISSING');
const next=source.replace(pattern,()=>featureCatalogue());
if(process.argv.includes('--check')){if(source!==next)throw new Error('README_FEATURE_CATALOGUE_DRIFT');}
else await fs.writeFile(file,next);
console.log('README feature catalogue matches runtime contracts.');
