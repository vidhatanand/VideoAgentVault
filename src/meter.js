import {uid,now} from './util.js';
export class Meter {
 constructor(category='api'){this.id=uid('req_');this.tenantId='__platform__';this.videoId=null;this.category=category;this.createdAt=now();this.counters={workers_requests:1};}
 add(metric,quantity=1){if(!Number.isFinite(quantity)||quantity<0)throw new Error('Invalid usage quantity');this.counters[metric]=(this.counters[metric]||0)+quantity;}
 event(status=200){return {id:this.id,tenantId:this.tenantId,videoId:this.videoId,category:this.category,createdAt:this.createdAt,status,counters:this.counters};}
}
/** All increments and the unique receipt commit in one D1 transaction. A retry cannot double-charge. */
export async function persistMeter(binding,e,{sampleRate=.01}={}){
 if(!e||typeof e.id!=='string'||!e.counters)return;
 if(e.createdAt<now()-48*3600000)return; // Dedupe retention window; stale retries never increment again.
 const day=new Date(e.createdAt).toISOString().slice(0,10),statements=[binding.prepare('INSERT INTO meter_receipts(id,created_at) VALUES(?,?)').bind(e.id,e.createdAt)];
 for(const [key,value] of Object.entries(e.counters)){if(!/^[a-z0-9_]+$/.test(key)||!Number.isFinite(value)||value<0)continue;statements.push(binding.prepare('INSERT INTO meter_daily(day,tenant_id,metric,quantity) VALUES(?,?,?,?) ON CONFLICT(day,tenant_id,metric) DO UPDATE SET quantity=quantity+excluded.quantity').bind(day,e.tenantId,key,value));}
 // Aggregate every media request. Detailed media traces are sampled, control-plane traces are not.
 if(e.videoId)statements.push(binding.prepare('INSERT INTO video_usage_daily(day,tenant_id,video_id,requests,bytes_offered,cache_hits) VALUES(?,?,?,?,?,?) ON CONFLICT(day,tenant_id,video_id) DO UPDATE SET requests=requests+excluded.requests,bytes_offered=bytes_offered+excluded.bytes_offered,cache_hits=cache_hits+excluded.cache_hits').bind(day,e.tenantId,e.videoId,1,e.counters.bytes_offered||0,e.counters.cache_hit||0));
 const sample=parseInt(e.id.slice(-6),16)/0xffffff<sampleRate;
 if(e.category!=='media'||sample)statements.push(binding.prepare('INSERT INTO request_traces(id,tenant_id,category,status,counters_json,cpu_ms,measurement_source,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(e.id,e.tenantId,e.category,e.status,JSON.stringify(e.counters),null,'application-counters; CPU not observed',e.createdAt));
 try{const results=await binding.batch(statements);const reads=results.reduce((a,r)=>a+Number(r.meta?.rows_read||0),0),writes=results.reduce((a,r)=>a+Number(r.meta?.rows_written||0),0);
 // Meter the measured write/read overhead. These two final accounting writes remain invoice-allocated overhead.
 await binding.batch([binding.prepare("INSERT INTO meter_daily(day,tenant_id,metric,quantity) VALUES(?,?,'d1_read',?) ON CONFLICT(day,tenant_id,metric) DO UPDATE SET quantity=quantity+excluded.quantity").bind(day,e.tenantId,reads),binding.prepare("INSERT INTO meter_daily(day,tenant_id,metric,quantity) VALUES(?,?,'d1_write',?) ON CONFLICT(day,tenant_id,metric) DO UPDATE SET quantity=quantity+excluded.quantity").bind(day,e.tenantId,writes)]);
 }catch(error){if(String(error.message).includes('UNIQUE constraint failed: meter_receipts'))return;throw error;}
}
export async function flush(c,status){const e=c.meter.event(status);if(c.env.METERING_MODE==='tail'){console.log('ER_METER',JSON.stringify(e));return;}await persistMeter(c.env.DB,e,{sampleRate:Number(c.env.TRACE_MEDIA_SAMPLE_RATE||.01)});}
export async function costEvent(c,{id:receipt=uid('cost_'),jobId=null,metric,quantity,unitUsd,quality='measured',providerRequestId=null}){
 if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(unitUsd)||unitUsd<0)throw new Error('Invalid cost event');
 const r=await c.db.run('INSERT INTO cost_events(id,tenant_id,job_id,metric,quantity,unit_usd,quality,provider_request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',[receipt,c.meter.tenantId,jobId,metric,quantity,unitUsd,quality,providerRequestId,now()]);
 return r.meta.changes?quantity*unitUsd:0;
}
