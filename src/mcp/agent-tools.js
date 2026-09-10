import * as A from '../agents/service.js';
import * as P from '../approvals/service.js';
import * as R from '../runs/service.js';
import * as C from '../runs/claims.js';
const str={type:'string'},int={type:'integer'},obj={type:'object'},inputs={type:'array',maxItems:30,items:{type:'object',properties:{videoId:str,revision:int},required:['videoId','revision'],additionalProperties:false}};
const tool=(name,description,properties,required,fn,readOnly=false)=>({name,description,scope:'videos:read',inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false,idempotentHint:readOnly},fn});
export const agentTools=[
 tool('agent_self','Read your stable identity, grants, operational limits and receipts.',{},[],(c,t)=>A.self(c,t),true),
 tool('access_explain','Check access without disclosing inaccessible resource metadata.',{videoId:str,folderId:str,access:{type:'string',enum:['read','write']}},[],(c,t,b)=>A.explain(c,t,b),true),
 tool('approval_request','Request human approval of exact video revision and publish/share/delete payload. Agents cannot approve.',{videoId:str,resourceType:{type:'string',enum:['video','folder','timeline','track']},resourceId:str,expectedRevision:int,action:{type:'string',enum:['publish','share','delete']},payload:obj,ttlSeconds:int},['expectedRevision','action'],(c,t,b)=>P.requestApproval(c,t,b)),
 tool('approvals_list','Read only approvals requested by your agent.',{},[],(c,t)=>P.listApprovals(c,t),true),
 tool('run_create','Record an external objective, input versions, output folder and budget ceiling.',{externalId:str,objective:str,outputFolderId:str,inputs,ceilingMicros:int},['externalId','objective','outputFolderId'],(c,t,b)=>R.createRun(c,t,b)),
 tool('runs_list','List runs owned by your agent.',{},[],(c,t)=>R.listRuns(c,t),true),
 tool('run_get','Read a run and its caller-supplied artifact and job receipts.',{runId:str},['runId'],(c,t,b)=>R.getRun(c,t,b.runId),true),
 tool('run_close','Complete or cancel an external run after its paid jobs finish.',{runId:str,expectedRevision:int,state:{type:'string',enum:['completed','cancelled']}},['runId','expectedRevision','state'],(c,t,b)=>R.closeRun(c,t,b.runId,b)),
 tool('artifact_submit','Submit a typed finding, transcript or edit draft with declared provenance; no hosted model charge.',{runId:str,requestKey:str,kind:{type:'string',enum:['finding','transcript','edit_draft']},inputs,data:obj},['runId','requestKey','kind','data'],(c,t,b)=>R.addReceipt(c,t,b.runId,b)),
 tool('work_claim','Claim a video work item with an expiring lease and increasing fencing token.',{videoId:str,expectedRevision:int,task:str,leaseSeconds:int},['videoId','expectedRevision','task'],(c,t,b)=>C.claim(c,b.videoId,b)),
 tool('work_claim_update','Renew or release your current fenced claim. Stale owners cannot change it.',{videoId:str,task:str,fence:int,leaseSeconds:int,release:{type:'boolean'}},['videoId','task','fence'],(c,t,b)=>C.renewClaim(c,b.videoId,b))
];
