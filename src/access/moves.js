import {tenantAuth} from '../auth.js';
import {humanOnly,agentOnly,assertion} from './policy.js';
import {fail,hash,canonicalJSON} from '../util.js';
/** Moves can change inherited grants. A human administrator reviews a policy snapshot first. */
export async function moveImpact(c,tid,{type,id,destination}){
 await tenantAuth(c,tid,'videos:write','admin');humanOnly(c);
 if(!['video','folder'].includes(type))fail(400,'INVALID_MOVE_TYPE');
 const table=type==='video'?'videos':'folders',r=await c.db.one(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`,[id,tid]);if(!r)fail(404,'MOVE_RESOURCE_NOT_FOUND');
 if(destination&&!await c.db.one('SELECT id FROM folders WHERE id=? AND tenant_id=?',[destination,tid]))fail(400,'FOLDER_NOT_IN_TENANT');
 const agents=await c.db.all('SELECT id,name,revision FROM agents WHERE tenant_id=? AND legacy=0 ORDER BY id',[tid]);
 const grants=await c.db.all('SELECT * FROM agent_grants WHERE tenant_id=? ORDER BY id',[tid]);
 const folders=await c.db.all('SELECT id,parent_id,revision FROM folders WHERE tenant_id=? ORDER BY id',[tid]);
 const current=await c.db.all(`SELECT DISTINCT agent_id,access FROM ${type==='video'?'agent_video_access':'agent_folder_access'} WHERE ${type==='video'?'video_id':'folder_id'}=? ORDER BY agent_id,access`,[id]);
 const proposed=destination?await c.db.all('SELECT DISTINCT agent_id,access FROM agent_folder_access WHERE folder_id=? ORDER BY agent_id,access',[destination]):[];
 const snapshot={type,id,destination:destination??null,revision:r.revision,agents,grants,folders};return {resourceId:id,destination:destination??null,currentFolderAccess:current,destinationFolderAccess:proposed,agents,warning:'Inherited access may change for this resource and its descendants. Individual grants remain in force.',reviewHash:await hash(canonicalJSON(snapshot))};
}
export async function moveGuard(c,tid,type,id,destination,reviewHash){
 const exists=await c.db.one('SELECT id FROM agent_grants WHERE tenant_id=? LIMIT 1',[tid]);if(!exists)return [];
 if(agentOnly(c))fail(403,'ADMIN_MOVE_REVIEW_REQUIRED');
 const impact=await moveImpact(c,tid,{type,id,destination});if(reviewHash!==impact.reviewHash)fail(409,'MOVE_REVIEW_REQUIRED','An administrator must preview and approve the current access impact.');
 // Changing folder inheritance invalidates concurrent policy snapshots and queued authorization caches.
 return [...impact.agents.flatMap(a=>assertion('EXISTS(SELECT 1 FROM agents WHERE id=? AND revision=?)',[a.id,a.revision])),['UPDATE agents SET revision=revision+1 WHERE tenant_id=?',[tid]]];
}
