import {requireVersion} from '../evidence/versions.js';
import {timelineSnapshot} from './timelines.js';
import {tenantAuth} from '../auth.js';
import {requireVideo} from '../library.js';
import {inputSnapshot} from './reuse.js';
import {mediaJobOptions} from '../media-features.js';
import {hash,canonicalJSON,text,integer,fail,now,uid} from '../util.js';
import {policyOps} from '../access/policy.js';
export async function getRecipe(c,tid,id){await tenantAuth(c,tid,'videos:read');const r=await c.db.one('SELECT * FROM media_recipes WHERE id=? AND tenant_id=?',[id,tid]);if(!r)fail(404,'RECIPE_NOT_FOUND');const inputs=JSON.parse(r.inputs_json);for(const x of inputs){await requireVideo(c,x.videoId);for(const version of x.auxiliary||[])await requireVersion(c,version);}return {...r,inputs,variants:JSON.parse(r.variants_json)};}
export async function createRecipe(c,tid,b){
 await tenantAuth(c,tid,'processing:write','editor');const name=text(b.name,'name',120),requestKey=text(b.requestKey,'requestKey',160),bodyHash=await hash(canonicalJSON(b));
 const old=await c.db.one('SELECT id,payload_hash FROM media_recipes WHERE tenant_id=? AND request_key=?',[tid,requestKey]);if(old){if(old.payload_hash!==bodyHash)fail(409,'IDEMPOTENCY_PAYLOAD_MISMATCH');return getRecipe(c,tid,old.id);}
 if(!Array.isArray(b.variants)||!b.variants.length||b.variants.length>8)fail(400,'RECIPE_VARIANTS_LIMIT');
 const inputs=[],variants=[];
 for(const spec of b.variants){
  if(spec.kind==='render'){const snapshot=await timelineSnapshot(c,tid,spec.timelineId);for(const clip of snapshot.timelineSnapshot.clips)if(!inputs.some(x=>x.videoId===clip.videoId))inputs.push(await inputSnapshot(c,clip.videoId));variants.push({kind:'render',...snapshot,title:text(spec.title||name,'title',180),folderId:spec.folderId??null,maxWallSeconds:integer(spec.maxWallSeconds??900,'maxWallSeconds',30,3600),...mediaJobOptions(spec)});continue;}
  if(!['export','preview','transcode','index','probe'].includes(spec.kind))fail(400,'RECIPE_OPERATION_NOT_SUPPORTED');
  const v=await requireVideo(c,spec.videoId,'processing:write','editor');if(v.tenant_id!==tid)fail(404,'VIDEO_NOT_FOUND');
  if(!inputs.some(x=>x.videoId===v.id))inputs.push(await inputSnapshot(c,v.id));
  const options={kind:spec.kind,videoId:v.id,...mediaJobOptions(spec),maxWallSeconds:integer(spec.maxWallSeconds??900,'maxWallSeconds',30,3600)};
  if(spec.kind==='index'){options.visual=spec.visual!==false;options.audio=spec.audio!==false;}
  if(spec.kind==='export'&&(options.endSeconds===null||options.endSeconds<=options.startSeconds||options.endSeconds>v.duration_seconds))fail(400,'RECIPE_EXPLICIT_INTERVAL_REQUIRED');
  if(spec.kind==='preview'&&options.timestampSeconds+options.previewSeconds>v.duration_seconds)fail(400,'RECIPE_PREVIEW_OUT_OF_BOUNDS');
  variants.push(options);
 }
 const version=(await c.db.one('SELECT COALESCE(MAX(version),0)+1 n FROM media_recipes WHERE tenant_id=? AND name=?',[tid,name])).n,id=uid('recipe_');
 await c.db.batch([...policyOps(c),['INSERT INTO media_recipes(id,tenant_id,name,version,created_by,agent_id,inputs_json,variants_json,payload_hash,request_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,tid,name,version,c.actor.email,c.actor.agentId||null,canonicalJSON(inputs),canonicalJSON(variants),bodyHash,requestKey,now()]]]);return getRecipe(c,tid,id);
}
export async function listRecipes(c,tid){await tenantAuth(c,tid);const rows=await c.db.all('SELECT id FROM media_recipes WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',[tid]),items=[];for(const r of rows){try{items.push(await getRecipe(c,tid,r.id));}catch(e){if(e.status!==404&&e.status!==403)throw e;}}return {items};}
