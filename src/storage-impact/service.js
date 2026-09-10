import {tenantAuth} from '../auth.js';
import {videoFilter,videoAccess,checkRevision} from '../access/policy.js';
import {customerRates} from '../customer-pricing.js';
import {fail,integer,choice,now} from '../util.js';
import {inventoryQuery} from './query.js';
const DAY=86400000;
export const RANKING={version:1,label:'Review priority',weights:{size:40,inactivity:30,lowObservedUse:20,derivedFraction:10},description:'A review aid, not a deletion recommendation. Size saturates at 10 GB, inactivity at 90 days; upload age is used when last use is unknown. Dependencies, active work and shared/public videos are excluded. Unknown usage is not proof of inactivity.'};
function blocked(row){return [row.status!=='ready'&&'Media is not ready',row.visibility!=='private'&&'Video is published',row.active_jobs>0&&'Processing is active',row.active_claims>0&&'An agent holds a work claim',row.dependents>0&&'Other media depends on this video',row.timelines>0&&'An edit timeline uses this video',row.open_runs>0&&'An agent run still uses this video',row.shares>0&&'A viewing link is active'].filter(Boolean);}
function present(row,ts,days){
 const monthlyMicros=row.bytes/1e9*customerRates().rates.r2_storage_gb_month.usd*1e6;
 return {id:row.id,title:row.title,revision:row.revision,kind:row.kind,status:row.status,folderId:row.folder_id,bytes:row.bytes,sourceBytes:row.source_bytes,derivedBytes:row.bytes-row.source_bytes,fileCount:row.files,estimatedMonthlyMicros:monthlyMicros,
 usage:{windowDays:days,observationDays:Math.min(days,Math.max(0,(ts-row.created_at)/DAY)),playbackSessions:row.plays,watchSeconds:row.watch_seconds,mediaRequests:row.requests,agentJobs:row.agent_jobs,lastRecordedUse:row.last_used||null,agentReads:'not_available',fileLevelUsage:'not_available'},
 review:{priority:row.priority,blockers:blocked(row),reasons:[`${row.files} stored files`,row.plays?`${row.plays} playback sessions in this window`:'No playback recorded in this window',row.agent_jobs?`${row.agent_jobs} agent processing jobs recorded`:'No agent processing jobs recorded',row.last_used?'Recent usage is based on recorded events':'Last use is unknown'],regenerationCost:'unknown',retentionPolicy:'Owner must confirm retention requirements before deletion'}};
}
async function query(c,tid,q={},extra='',extraArgs=[]){
 await tenantAuth(c,tid,'videos:read','viewer');
 const days=integer(Number(q.days??30),'days',1,90),ts=now(),start=ts-days*DAY,day=new Date(start).toISOString().slice(0,10),f=videoFilter(c);
 return {sql:inventoryQuery(f.sql,extra),args:[start,start,start,day,day,start,start,ts,ts,tid,...f.args,...extraArgs,ts],ts,days};
}
export async function inventory(c,tid,q={}){
 const sort=choice(q.sort??'priority',['priority','cost','size','last_use'],'sort'),limit=integer(Number(q.limit??50),'limit',1,100),offset=integer(Number(q.offset??0),'offset',0,1000000);
 const {sql,args,ts,days}=await query(c,tid,q);
 const order={priority:'priority DESC,bytes DESC',cost:'bytes DESC',size:'bytes DESC',last_use:'last_used ASC'}[sort];
 const totals=await c.db.one(sql+'SELECT COUNT(*) videos,COALESCE(SUM(bytes),0) bytes,COALESCE(SUM(source_bytes),0) sourceBytes,COALESCE(SUM(bytes-source_bytes),0) derivedBytes FROM ranked',args);
 const rows=await c.db.all(sql+`SELECT * FROM ranked ORDER BY ${order},id LIMIT ? OFFSET ?`,[...args,limit,offset]);
 return {items:rows.map(r=>present(r,ts,days)),totals:{...totals,estimatedMonthlyMicros:totals.bytes/1e9*customerRates().rates.r2_storage_gb_month.usd*1e6},nextOffset:offset+rows.length<totals.videos?offset+rows.length:null,asOf:ts,days,ranking:RANKING,pricing:{currency:'USD',basis:'Estimated 30-day charge at current workspace storage price; processing and requests excluded.',...{pricingVersion:customerRates().pricingVersion}},scope:'Only media accessible to the current identity',usageNote:'Playback is client-reported and capped. Requests indicate data offered, not confirmed viewing. Agent job counts exclude reads and externally executed work. Per-file usage and regeneration estimates are unavailable.'};
}
export async function detail(c,tid,id,q={}){
 const {sql,args,ts,days}=await query(c,tid,q,'AND v.id=?',[id]);
 const row=await c.db.one(sql+'SELECT * FROM ranked',args);if(!row)fail(404,'VIDEO_NOT_FOUND');
 const limit=integer(Number(q.limit??100),'limit',1,200),offset=integer(Number(q.offset??0),'offset',0,1000000);
 const files=await c.db.all("SELECT id,path,role,size,stored_at FROM objects WHERE video_id=? AND status='ready' ORDER BY size DESC,id LIMIT ? OFFSET ?",[id,limit,offset]);
 const filter=videoFilter(c);
 const related=await c.db.all(`SELECT v.id,v.title,CASE WHEN d.source_video_id=? THEN 'derived' ELSE 'source' END relationship FROM video_dependencies d JOIN videos v ON v.id=CASE WHEN d.source_video_id=? THEN d.video_id ELSE d.source_video_id END WHERE (d.source_video_id=? OR d.video_id=?) AND v.tenant_id=? AND v.status!='deleted' AND ${filter.sql} ORDER BY v.id LIMIT 51`,[id,id,id,id,tid,...filter.args]);
 return {...present(row,ts,days),related:related.slice(0,50),moreRelated:related.length>50,files:files.map(f=>({...f,estimatedMonthlyMicros:f.size/1e9*customerRates().rates.r2_storage_gb_month.usd*1e6})),nextOffset:offset+files.length<row.files?offset+files.length:null};
}
export async function preview(c,tid,b){
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>50||new Set(b.items.map(x=>x.videoId)).size!==b.items.length)fail(400,'INVALID_SELECTION');
 const items=[];
 for(const item of b.items){const current=await detail(c,tid,item.videoId);await checkRevision(c,current,integer(item.expectedRevision,'expectedRevision',1));await videoAccess(c,current,'write');
  items.push({videoId:current.id,title:current.title,expectedRevision:current.revision,bytes:current.bytes,estimatedMonthlyMicros:current.estimatedMonthlyMicros,blockers:current.review.blockers,approval:{action:'delete',payload:{confirmDelete:true}},scope:'Entire video and all its stored files; individual file deletion is not offered'});
 }
 return {items,blocked:items.some(x=>x.blockers.length),estimatedMonthlySavingsMicros:items.filter(x=>!x.blockers.length).reduce((s,x)=>s+x.estimatedMonthlyMicros,0),reclaimableBytes:items.filter(x=>!x.blockers.length).reduce((s,x)=>s+x.bytes,0),asOf:now(),expiresAt:now()+300000,requiresHumanApproval:true,notice:'Preview only. No data changed. Recheck before approval; dependencies and usage can change. Retention requirements and external usage need owner review. Removing an original is permanent.'};
}
