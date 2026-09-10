import { uid, now } from './util.js';
export class DB {
  constructor(binding, meter) { this.binding=binding; this.meter=meter; }
  stmt(sql, args=[]) { return this.binding.prepare(sql).bind(...args); }
  capture(r){this.meter?.add('d1_read',Number(r.meta?.rows_read||0));this.meter?.add('d1_write',Number(r.meta?.rows_written||0));return r;}
  async run(sql,args=[]){return this.capture(await this.stmt(sql,args).run());}
  async all(sql,args=[]){return this.capture(await this.stmt(sql,args).all()).results||[];}
  async one(sql,args=[]){return (await this.all(sql,args))[0]||null;}
  async batch(items){const rs=await this.binding.batch(items.map(([sql,args])=>this.stmt(sql,args)));rs.forEach(r=>this.capture(r));return rs;}
  async audit(tenant,actor,action,resource,detail={}) { await this.run('INSERT INTO audit_log(id,tenant_id,actor,action,resource_id,detail_json,created_at) VALUES(?,?,?,?,?,?,?)',[uid('a_'),tenant,actor,action,resource,JSON.stringify(detail),now()]); }
}
