import {fail,now,uid,integer} from '../util.js';
export const PERMISSIONS=['read','write','process','download','cancel','publish','share','delete','live_credentials'];
export const agentOnly=c=>!!c.actor?.agentId&&!c.actor.legacy;
export const accessMode=scope=>['videos:write','intelligence:write','timelines:write','folders:write','tags:write'].includes(scope)?'write':'read';
export function permission(c,name){if(agentOnly(c)&&!c.actor.permissions.includes(name)&&!(name==='read'&&c.actor.permissions.includes('write')))fail(403,'AGENT_PERMISSION_DENIED',`This agent requires the ${name} permission.`);}
export function humanOnly(c){if(c.actor?.type==='key')fail(403,'HUMAN_ADMIN_REQUIRED');}
export function videoFilter(c,alias='v',mode='read'){
 if(!agentOnly(c))return {sql:'1=1',args:[]};if(!c.actor.permissions.includes(mode)&&!(mode==='read'&&c.actor.permissions.includes('write')))return {sql:'0=1',args:[]};
 // Recursive lineage is also checked: an output never grants access to restricted inputs.
 return {sql:`EXISTS(SELECT 1 FROM agent_video_access av WHERE av.video_id=${alias}.id AND av.agent_id=? ${mode==='write'?"AND av.access='write'":''}) AND NOT EXISTS(WITH RECURSIVE deps(id) AS (SELECT source_video_id FROM video_dependencies WHERE video_id=${alias}.id UNION SELECT d.source_video_id FROM video_dependencies d JOIN deps ON d.video_id=deps.id) SELECT 1 FROM deps WHERE NOT EXISTS(SELECT 1 FROM agent_video_access ax WHERE ax.video_id=deps.id AND ax.agent_id=?))`,args:[c.actor.agentId,c.actor.agentId]};
}
export async function videoAccess(c,v,mode='read'){
 if(!agentOnly(c))return v;permission(c,mode);const f=videoFilter(c,'v',mode);
 if(!await c.db.one(`SELECT v.id FROM videos v WHERE v.id=? AND v.tenant_id=? AND ${f.sql}`,[v.id,c.actor.tenantId,...f.args]))fail(404,'VIDEO_NOT_FOUND');return v;
}
export async function folderAccess(c,tid,id,mode='read'){
 if(!agentOnly(c))return;permission(c,mode);
 if(!id||tid!==c.actor.tenantId||!await c.db.one(`SELECT 1 FROM agent_folder_access WHERE agent_id=? AND tenant_id=? AND folder_id=? ${mode==='write'?"AND access='write'":''}`,[c.actor.agentId,tid,id]))fail(403,'FOLDER_ACCESS_DENIED','Assign a folder grant; workspace root is not an agent folder.');
}
export function assertion(sql,args=[]){const id=uid('guard_');return [['INSERT INTO security_assertions(id,ok) SELECT ?,CASE WHEN ('+sql+') THEN 1 ELSE 0 END',[id,...args]],['DELETE FROM security_assertions WHERE id=?',[id]]];}
export function revisionOps(c,table,row,expected){
 if(!['videos','timelines','folders','media_tracks'].includes(table))throw new Error('Unsupported revision table');
 if(agentOnly(c)||expected!==undefined)integer(expected,'expectedRevision',1);
 expected??=row.revision;
 return assertion(`EXISTS(SELECT 1 FROM ${table} WHERE id=? AND revision=?)`,[row.id,expected]);
}
export async function checkRevision(c,row,expected){if(agentOnly(c)||expected!==undefined){integer(expected,'expectedRevision',1);if(row.revision!==expected)fail(409,'REVISION_CONFLICT','Read the latest version and review changes before retrying.');}}
export function policyOps(c){if(!agentOnly(c))return [];return assertion("EXISTS(SELECT 1 FROM agents a JOIN api_keys k ON k.agent_id=a.id WHERE a.id=? AND a.status='active' AND a.revision=? AND k.id=? AND k.revoked_at IS NULL AND k.expires_at>?)",[c.actor.agentId,c.actor.agentRevision,c.actor.keyId,now()]);}
export async function bindKey(c,keyId){
 const k=await c.db.one('SELECT k.*,a.legacy,a.status,a.permissions_json,a.revision agent_revision FROM api_keys k LEFT JOIN agents a ON a.id=k.agent_id WHERE k.id=? AND k.revoked_at IS NULL AND k.expires_at>?',[keyId,now()]);
 if(!k||k.agent_id&&k.status!=='active')fail(401,'AGENT_REVOKED');
 c.actor={type:'key',email:`key:${k.id}`,keyId:k.id,tenantId:k.tenant_id,agentId:k.agent_id,legacy:!k.agent_id||!!k.legacy,permissions:JSON.parse(k.permissions_json||'[]'),agentRevision:k.agent_revision,scopes:JSON.parse(k.scopes_json),super:false};return c.actor;
}
export async function checkJobAccess(c,j){if(!j.key_id)return;await bindKey(c,j.key_id);if(c.actor.agentId!==j.agent_id)fail(403,'JOB_AGENT_MISMATCH');const t=await c.db.one('SELECT status FROM tenants WHERE id=?',[j.tenant_id]);if(t?.status!=='active')fail(403,'TENANT_SUSPENDED');permission(c,j.kind==='delete'?'delete':'process');const v=await c.db.one('SELECT * FROM videos WHERE id=?',[j.video_id]);await videoAccess(c,v,'write');const p=JSON.parse(j.payload_json);if(p.agentInputVersions)for(const x of p.agentInputVersions){if(!await c.db.one('SELECT id FROM videos WHERE id=? AND revision=?',[x.videoId,x.revision]))fail(409,'JOB_SOURCE_VERSION_CHANGED');}for(const id of p.sourceVideoIds||[]){const src=await c.db.one('SELECT * FROM videos WHERE id=?',[id]);if(!src)fail(403,'SOURCE_REMOVED');await videoAccess(c,src);}return c.actor;}
