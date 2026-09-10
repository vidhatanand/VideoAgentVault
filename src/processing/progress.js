const STAGES=new Set(['downloading','probing','encoding','uploading','indexing','cleanup']);
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
export function safeProgress(p){
 if(!p||!STAGES.has(p.stage))return null;
 return {stage:p.stage,completed:finite(p.completed)?p.completed:0,total:finite(p.total)&&p.total>0?p.total:null,unit:['bytes','seconds','units'].includes(p.unit)?p.unit:null,elapsedSeconds:finite(p.elapsedSeconds)?p.elapsedSeconds:0,etaSeconds:finite(p.etaSeconds)&&p.etaSeconds<=86400?p.etaSeconds:null,updatedAt:finite(p.updatedAt)?p.updatedAt:null};
}
export function readProgress(j){let p;try{p=JSON.parse(j.progress_json||'null');}catch{}return safeProgress(p);}
export async function recordProgress(c,j,p){const clean=safeProgress(p);if(clean)await c.db.run('UPDATE jobs SET progress_json=? WHERE id=? AND finished_at IS NULL',[JSON.stringify(clean),j.id]);}
export async function indexProgress(c,j,completed,total){
 const previous=readProgress(await c.db.one('SELECT progress_json FROM jobs WHERE id=?',[j.id])),ts=Date.now();
 const elapsed=previous?.stage==='indexing'?previous.elapsedSeconds+(ts-previous.updatedAt)/1000:0;
 await recordProgress(c,j,{stage:'indexing',completed,total,unit:'units',elapsedSeconds:elapsed,etaSeconds:completed>=2&&elapsed>=3?(total-completed)*elapsed/completed:null,updatedAt:ts});
}
