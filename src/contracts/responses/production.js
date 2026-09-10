import recipes from './rows/media_recipes.js';
import timelines from './rows/timelines.js';
import manifests from './rows/artifact_manifests.js';
import {string,integer,number,boolean,array,object,nullable,jsonValue,extend,ok} from './types.js';
const recipe=extend(recipes,{inputs:array(jsonValue),variants:array(jsonValue)});
const batch=object({id:string,recipeId:string,state:string,budgetMicros:integer,spentMicros:integer,deadlineAt:integer,lastError:nullable(string),completed:integer,total:integer,items:array(object({ordinal:integer,state:string,job_id:nullable(string),charge_micros:integer,reused:integer}))});
const evidence=extend(manifests,{method:jsonValue,coverage:jsonValue,payload:jsonValue,watch:object({videoId:string,start:number,end:number})},['method_json','coverage_json','payload_json']);
export const productionResponses={
 recipe_create:recipe,recipe_get:recipe,recipe_list:object({items:array(recipe)}),batch_start:batch,batch_get:batch,batch_cancel:batch,batch_list:object({items:array(batch)}),
 timeline_delete:ok,timeline_save:object({id:string,name:string,spec:jsonValue,revision:integer,durationSeconds:number}),timelines_list:array(extend(timelines,{spec:jsonValue})),
 evidence_search:object({items:array(extend(evidence,{title:string})),nextCursor:nullable(string),ordering:string,note:string}),
 evidence_bundle:object({items:array(evidence),sourceVideos:array(string),complete:{type:'boolean',enum:[true]},scope:string})
};
