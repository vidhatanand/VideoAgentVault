import {resourceDeleteOps} from '../approvals/resources.js';
import {tenantAuth} from '../auth.js';
import {agentOnly,folderAccess,checkRevision,revisionOps,policyOps,assertion} from './policy.js';
import {moveGuard} from './moves.js';
import {fail,uid,now,text} from '../util.js';
async function existing(c,tid,id){const f=await c.db.one('SELECT * FROM folders WHERE id=? AND tenant_id=?',[id,tid]);if(!f)fail(404,'FOLDER_NOT_FOUND');return f;}
export async function folderWrite(c,tid,b,id){
 await tenantAuth(c,tid,'folders:write','editor');const old=id?await existing(c,tid,id):null;
 const parent=b.parentId===undefined?old?.parent_id??null:b.parentId,name=text(b.name,'name',80);
 if(parent&&!await c.db.one('SELECT id FROM folders WHERE id=? AND tenant_id=?',[parent,tid]))fail(400,'FOLDER_NOT_IN_TENANT');if(old){await folderAccess(c,tid,id,'write');await checkRevision(c,old,b.expectedRevision);}else{
  await folderAccess(c,tid,parent,'write');
  if(agentOnly(c)&&!await c.db.one("WITH RECURSIVE ancestors(id,parent_id) AS (SELECT id,parent_id FROM folders WHERE id=? UNION SELECT f.id,f.parent_id FROM folders f JOIN ancestors a ON f.id=a.parent_id) SELECT 1 FROM agent_grants g JOIN ancestors a ON a.id=g.resource_id WHERE g.agent_id=? AND g.resource_type='folder' AND g.inherit=1 AND g.access='write'",[parent,c.actor.agentId]))fail(403,'INHERITED_WRITE_GRANT_REQUIRED');
 }
 const ops=[...policyOps(c)];
 if(old){ops.push(...revisionOps(c,'folders',old,b.expectedRevision));if(parent!==old.parent_id)ops.push(...await moveGuard(c,tid,'folder',id,parent,b.moveReviewHash));ops.push(['UPDATE folders SET name=?,parent_id=?,revision=revision+1 WHERE id=?',[name,parent,id]]);}
 else{id=uid('f_');ops.push(['INSERT INTO folders(id,tenant_id,parent_id,name,created_at) VALUES(?,?,?,?,?)',[id,tid,parent,name,now()]]);}
 await c.db.batch(ops);await c.db.audit(tid,c.actor.email,'folder.save',id,{name,parent});return existing(c,tid,id);
}
export async function folderDelete(c,tid,id,b={}){await tenantAuth(c,tid,'folders:write','editor');const f=await existing(c,tid,id);await checkRevision(c,f,b.expectedRevision);
 if(await c.db.one("SELECT id FROM folders WHERE parent_id=? UNION SELECT id FROM videos WHERE folder_id=? AND status!='deleted' LIMIT 1",[id,id]))fail(409,'FOLDER_NOT_EMPTY');const r=await c.db.batch([...await resourceDeleteOps(c,tid,'folder',id,b),...revisionOps(c,'folders',f,b.expectedRevision),...assertion("NOT EXISTS(SELECT 1 FROM folders WHERE parent_id=?) AND NOT EXISTS(SELECT 1 FROM videos WHERE folder_id=? AND status!='deleted')",[id,id]),["UPDATE videos SET folder_id=NULL WHERE folder_id=? AND tenant_id=? AND status='deleted'",[id,tid]],['DELETE FROM agent_grants WHERE resource_type=? AND resource_id=? AND tenant_id=?',['folder',id,tid]],['DELETE FROM folders WHERE id=? AND tenant_id=? AND NOT EXISTS(SELECT 1 FROM folders WHERE parent_id=?) AND NOT EXISTS(SELECT 1 FROM videos WHERE folder_id=?)',[id,tid,id,id]]]);if(!r.at(-1).meta.changes)fail(409,'FOLDER_NOT_EMPTY');await c.db.audit(tid,c.actor.email,'folder.delete',id);return {ok:true};}
