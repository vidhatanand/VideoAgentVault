import jobs from './rows/jobs.js';
import {string,integer,number,boolean,array,object,nullable,jsonValue,extend,union} from './types.js';
import {coreResponses} from './core.js';
const progress=nullable(object({stage:{type:'string',enum:['downloading','probing','encoding','uploading','indexing','cleanup']},completed:number,total:nullable(number),unit:nullable(string),elapsedSeconds:number,etaSeconds:nullable(number),updatedAt:nullable(number)}));
export const job=extend(jobs,{result:jsonValue,progress},['payload_json','result_json','progress_json']);
export const jobDetail=extend(job,{events:array(object({state:string,detail:string,created_at:integer})),costs:array(object({metric:string,quantity:number,quality:string,created_at:integer}))});
const reused=object({reused:boolean,job:union(job,jobDetail),processingChargeMicros:integer,originalReceiptRetained:boolean,inFlight:boolean},['reused','job']);
export const jobResponses={
 jobs_list:array(extend(job,{title:string})),job_get:jobDetail,processing_start:job,video_delete:job,
 job_cancel:union(job,object({id:string,state:{type:'string',enum:['cancelling']}})),processing_reuse:reused,
 processing_plan:object({id:string,provider:string,reason:string,spec:jsonValue,quote:union(coreResponses.processing_quote,object({reserveMicros:integer})),expiresAt:integer,noSilentFallback:{type:'boolean',enum:[true]}}),
 processing_plan_execute:union(job,object({jobId:string,idempotent:{type:'boolean',enum:[true]}}),object({provider:{type:'string',enum:['r2']},reused:{type:'boolean',enum:[true]},videoId:string,processingChargeMicros:integer}))
};
