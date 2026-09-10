import {agentOnly,policyOps} from '../access/policy.js';
import {now} from '../util.js';
export function reserveAgent(c,jobId,tid,amount,runId){if(!agentOnly(c))return [];const date=new Date().toISOString();return [...policyOps(c),['INSERT INTO agent_reservations(job_id,agent_id,tenant_id,run_id,amount_micros,day,month,created_at) VALUES(?,?,?,?,?,?,?,?)',[jobId,c.actor.agentId,tid,runId??null,amount,date.slice(0,10),date.slice(0,7),now()]]];}
export function settleAgent(j,charged){return j.agent_id?[['UPDATE agent_reservations SET charged_micros=?,settled_at=? WHERE job_id=? AND settled_at IS NULL',[charged,now(),j.id]]]:[];}
