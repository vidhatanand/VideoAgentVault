import {DB} from '../db.js';
import {Meter,flush} from '../meter.js';
/** Scheduled work gets its own tenant meter; never mutate the parent cron's attribution. */
export function scopedContext(parent,category){const meter=new Meter(category);return {...parent,actor:undefined,meter,db:new DB(parent.env.DB,meter)};}
export async function flushScoped(c){await flush(c,200);}
