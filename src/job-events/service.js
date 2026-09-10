import {getJob} from '../jobs.js';
import {integer,now,fail} from '../util.js';
/** Cursor is a durable sequence, not a timestamp or a count of visible rows. */
export async function jobEvents(c,tid,b){
 const job=await getJob(c,b.jobId);if(job.tenant_id!==tid)fail(404,'JOB_NOT_FOUND');
 const cursor=integer(Number(b.cursor??0),'cursor',0,Number.MAX_SAFE_INTEGER),limit=integer(Number(b.limit??100),'limit',1,100);
 const items=await c.db.all('SELECT s.sequence,e.id,e.job_id AS jobId,e.state,e.created_at AS createdAt FROM job_event_sequence s JOIN job_events e ON e.id=s.event_id WHERE e.job_id=? AND s.sequence>? ORDER BY s.sequence LIMIT ?',[b.jobId,cursor,limit]);
 return {items,nextCursor:items.at(-1)?.sequence??cursor,terminal:['succeeded','failed','cancelled'].includes(job.state)};
}
export async function queueJobEvents(c){
 const rows=await c.db.all(`SELECT e.id,e.job_id,e.tenant_id,e.state,e.created_at,w.id AS webhook_id FROM job_events e JOIN webhooks w ON w.tenant_id=e.tenant_id AND w.enabled=1 AND e.created_at>=w.created_at WHERE EXISTS(SELECT 1 FROM json_each(w.topics_json) WHERE value='video.job') AND NOT EXISTS(SELECT 1 FROM webhook_deliveries d WHERE d.webhook_id=w.id AND d.event_id=e.id) ORDER BY e.created_at,e.id LIMIT 100`);
 for(const e of rows)await c.db.run("INSERT OR IGNORE INTO webhook_deliveries(id,tenant_id,webhook_id,event_id,payload_json,state,next_run_at,created_at) VALUES(?,?,?,?,?,'queued',?,?)",['wd_'+e.webhook_id+'_'+e.id,e.tenant_id,e.webhook_id,e.id,JSON.stringify({id:e.id,type:'video.job',jobId:e.job_id,state:e.state,createdAt:e.created_at}),now(),now()]);
 return rows.length;
}
