import {inventory,detail,preview} from '../storage-impact/service.js';
const str={type:'string'},int={type:'integer'};
const tool=(name,description,properties,required,fn)=>({name,description,scope:'videos:read',inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true},fn});
export const storageTools=[
 tool('storage_inventory','Rank accessible media by estimated customer storage charges, recorded usage and explainable review priority. Unknown use is not evidence of disuse.',{sort:{type:'string',enum:['priority','cost','size','last_use']},days:int,limit:int,offset:int},[],inventory),
 tool('storage_asset','Inspect source and derived files, usage confidence and cleanup blockers. Files are paginated.',{videoId:str,days:int,limit:int,offset:int},['videoId'],(c,t,b)=>detail(c,t,b.videoId,b)),
 tool('storage_cleanup_preview','Preview removal of whole videos at exact revisions. No deletion occurs. Resolve blockers and request human approval through approval_request before video_delete.',{items:{type:'array',minItems:1,maxItems:50,items:{type:'object',properties:{videoId:str,expectedRevision:int},required:['videoId','expectedRevision'],additionalProperties:false}}},['items'],preview)
];
