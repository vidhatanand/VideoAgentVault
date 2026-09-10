import {tenantAuth} from '../auth.js';
import {requireVideo} from '../library.js';
import {agentOnly,permission,folderAccess,humanOnly,assertion,policyOps,revisionOps} from '../access/policy.js';
import {fail,uid,now,integer,text,canonicalJSON} from '../util.js';

// Non-video deletions have their own exact snapshot. No recursive folder deletion.
export async function resourceSnapshot(c,tid,type,id){
 const table={folder:'folders',timeline:'timelines',track:'media_tracks'}[type];
 if(!table)fail(400,'INVALID_APPROVAL_RESOURCE');
 const r=await c.db.one(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`,[id,tid]);
 if(!r)fail(404,'RESOURCE_NOT_FOUND');
 const inputs=[];
 if(type==='folder')await folderAccess(c,tid,id,'write');
 if(type==='timeline'){
  if(agentOnly(c)&&r.agent_id!==c.actor.agentId)fail(403,'TIMELINE_OWNER_REQUIRED');
  for(const clip of JSON.parse(r.spec_json).clips){const v=await requireVideo(c,clip.videoId);inputs.push({id:v.id,revision:v.revision});}
 }
 if(type==='track'){
  if(r.status!=='active')fail(404,'TRACK_NOT_FOUND');
  const v=await requireVideo(c,r.video_id);inputs.push({id:v.id,revision:v.revision});
 }
 return {type,id,revision:r.revision,title:r.name||r.label,inputs,table};
}
function guards(s){return [...assertion(`EXISTS(SELECT 1 FROM ${s.table} WHERE id=? AND revision=?)`,[s.id,s.revision]),...s.inputs.flatMap(x=>assertion('EXISTS(SELECT 1 FROM videos WHERE id=? AND revision=?)',[x.id,x.revision]))];}
export async function requestResourceApproval(c,tid,b){
 await tenantAuth(c,tid);if(!agentOnly(c))fail(403,'NAMED_AGENT_REQUIRED');permission(c,'delete');permission(c,'write');
 if(b.action!=='delete')fail(400,'RESOURCE_DELETION_ONLY');
 const s=await resourceSnapshot(c,tid,b.resourceType,text(b.resourceId,'resourceId',80));
 if(integer(b.expectedRevision,'expectedRevision',1)!==s.revision)fail(409,'REVISION_CONFLICT');
 const id=uid('ap_');await c.db.batch([...policyOps(c),...guards(s),['INSERT INTO resource_approvals(id,tenant_id,agent_id,resource_type,resource_id,snapshot_json,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)',[id,tid,c.actor.agentId,s.type,s.id,canonicalJSON(s),now()+integer(b.ttlSeconds??3600,'ttlSeconds',60,86400)*1000,now()]]]);
 await c.db.audit(tid,c.actor.email,'approval.request',id,{action:'delete',resourceType:s.type,resourceId:s.id});return {id,state:'pending'};
}
export async function resourceApprovals(c,tid){
 const rows=await c.db.all(`SELECT p.*,a.name agent_name FROM resource_approvals p JOIN agents a ON a.id=p.agent_id WHERE p.tenant_id=? ${c.actor.type==='key'?'AND p.agent_id=?':''} ORDER BY p.created_at DESC LIMIT 100`,[tid,...(c.actor.type==='key'?[c.actor.agentId??'']:[])]);
 const result=[];for(const r of rows){try{await resourceSnapshot(c,tid,r.resource_type,r.resource_id);}catch(e){if([403,404].includes(e.status))continue;throw e;}const s=JSON.parse(r.snapshot_json);result.push({...r,action:'delete '+s.type,title:s.title,revision:s.revision,inputs_json:'[]',payload_json:JSON.stringify({resourceId:s.id,confirmDelete:true,maximumChargeMicros:0})});}return result;
}
export async function decideResourceApproval(c,tid,p,decision){
 humanOnly(c);const s=await resourceSnapshot(c,tid,p.resource_type,p.resource_id);
 if(p.expires_at<=now()||canonicalJSON(s)!==p.snapshot_json)fail(409,'APPROVAL_STALE');
 await c.db.batch([...guards(s),...assertion("EXISTS(SELECT 1 FROM resource_approvals WHERE id=? AND state='pending' AND expires_at>?)",[p.id,now()]),['UPDATE resource_approvals SET state=?,decided_by=?,decided_at=? WHERE id=?',[decision,c.actor.email,now(),p.id]]]);
 await c.db.audit(tid,c.actor.email,'approval.'+decision,p.id);return {id:p.id,state:decision};
}
export async function resourceDeleteOps(c,tid,type,id,b){
 if(!agentOnly(c))return [];permission(c,'delete');permission(c,'write');const s=await resourceSnapshot(c,tid,type,id);
 if(integer(b.expectedRevision,'expectedRevision',1)!==s.revision)fail(409,'REVISION_CONFLICT');
 const condition="id=? AND tenant_id=? AND agent_id=? AND resource_type=? AND resource_id=? AND snapshot_json=? AND state='approved' AND expires_at>?";
 const args=[text(b.approvalId,'approvalId',80),tid,c.actor.agentId,type,id,canonicalJSON(s),now()];
 if(!await c.db.one('SELECT id FROM resource_approvals WHERE '+condition,args))fail(403,'HUMAN_APPROVAL_REQUIRED');
 return [...policyOps(c),...guards(s),...assertion('EXISTS(SELECT 1 FROM resource_approvals WHERE '+condition+')',args),["UPDATE resource_approvals SET state='consumed',consumed_at=? WHERE id=?",[now(),b.approvalId]]];
}
export async function deleteTimeline(c,tid,id,b={}){
 await tenantAuth(c,tid,'timelines:write','editor');const s=await resourceSnapshot(c,tid,'timeline',id);
 await c.db.batch([...await resourceDeleteOps(c,tid,'timeline',id,b),...revisionOps(c,'timelines',s,b.expectedRevision),['DELETE FROM timelines WHERE id=? AND tenant_id=?',[id,tid]]]);
 await c.db.audit(tid,c.actor.email,'timeline.delete',id);return {ok:true};
}
