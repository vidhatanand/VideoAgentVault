import agents from './rows/agents.js';
import grants from './rows/agent_grants.js';
import reservations from './rows/agent_reservations.js';
import runs from './rows/agent_runs.js';
import receipts from './rows/agent_artifacts.js';
import approvals from './rows/agent_approvals.js';
import resourceApprovals from './rows/resource_approvals.js';
import {string,integer,boolean,array,object,nullable,extend,pick,union} from './types.js';
const run=extend(runs,{jobs:array(object({id:string,state:string,kind:string,key_id:nullable(string),video_id:string,reserved_micros:nullable(integer),charged_micros:nullable(integer),settled_at:nullable(integer)})),receipts:array(receipts)});
export const agentResponses={
 agent_self:union(object({legacy:boolean,message:string}),extend(agents,{keyId:string,grants:array(grants),usage:array(reservations),upload:object({method:string,path:string,status:string}),approvals:string})),
 approval_request:object({id:string,state:{type:'string',enum:['pending']}}),
 approvals_list:array(union(extend(approvals,{agent_name:string,title:string}),extend(resourceApprovals,{agent_name:string,title:string,action:string,revision:integer,inputs_json:string,payload_json:string}))),
 run_create:union(runs,run),run_get:run,run_close:run,
 runs_list:array(pick(runs,['id','external_id','objective','state','revision','created_at'])),
 artifact_submit:union(receipts,object({id:string,origin:{type:'string',enum:['caller_supplied']},hostedInferenceChargeMicros:integer}))
};
