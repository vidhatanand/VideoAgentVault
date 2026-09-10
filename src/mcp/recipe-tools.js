import {reusableJob} from '../media-plans/reuse.js';
import {createRecipe,getRecipe,listRecipes} from '../media-plans/recipes.js';
import {startBatch,getBatch,stopBatch,listBatches} from '../media-plans/batches.js';
const str={type:'string'},int={type:'integer'},num={type:'number'},bool={type:'boolean'};
const tool=(name,description,properties,required,fn,read=false)=>({name,description,scope:read?'videos:read':'processing:write',inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:read,destructiveHint:false,idempotentHint:true,openWorldHint:false},fn});
const variant={type:'object',properties:{kind:{type:'string',enum:['probe','preview','export','transcode','index','render']},videoId:str,timelineId:str,title:str,folderId:str,profile:{type:'string',enum:['economy','balanced','fullhd']},maxWallSeconds:int,format:{type:'string',enum:['mp4','m4a']},startSeconds:num,endSeconds:num,timestampSeconds:num,previewSeconds:int,spriteFrames:int,audio:bool,visual:bool,encrypted:bool},required:['kind'],additionalProperties:false};
export const recipeTools=[
 tool('batch_list','List accessible batch progress and recorded charges.',{},[],listBatches,true),
 tool('processing_reuse','Reuse an exact authorized successful or in-flight operation, or create one bounded job. Unknown source fingerprints require explicit reuse:false.',{...variant.properties,requestKey:str,budgetMicros:int,expectedRevision:int,reuse:bool},['kind','videoId','requestKey','budgetMicros'],reusableJob),
 tool('recipe_create','Save an immutable version with exact source and track snapshots, and up to eight bounded variants. Does not start processing.',{name:str,requestKey:str,variants:{type:'array',items:variant,minItems:1,maxItems:8}},['name','requestKey','variants'],createRecipe),
 tool('recipe_list','List recipes whose inputs remain readable.',{},[],listRecipes,true),
 tool('recipe_get','Read a recipe and reauthorize every input.',{recipeId:str},['recipeId'],(c,t,b)=>getRecipe(c,t,b.recipeId),true),
 tool('batch_start','Run recipe variants serially within the total credit ceiling and current grants. Stops after a failed variant or changed input.',{recipeId:str,requestKey:str,budgetMicros:int,deadlineSeconds:int},['recipeId','requestKey','budgetMicros'],startBatch),
 tool('batch_get','Read actual completed variants, job references and settled credit charges.',{batchId:str},['batchId'],(c,t,b)=>getBatch(c,t,b.batchId),true),
 tool('batch_cancel','Stop future variants and request cancellation of active processing on the next recovery tick.',{batchId:str},['batchId'],(c,t,b)=>stopBatch(c,t,b.batchId))
];
