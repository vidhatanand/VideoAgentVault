import {importMediaResult} from '../artifacts/import-media.js';
import {versions} from '../evidence/versions.js';
import {evidenceSearch,evidenceBundle} from '../evidence/query.js';
import {importFinding} from '../artifacts/manifests.js';
const str={type:'string'},num={type:'number'},int={type:'integer'},claim={type:'object',properties:{task:str,fence:int},required:['task','fence'],additionalProperties:false};
const tool=(name,description,scope,properties,required,fn,read=true)=>({name,description,scope,inputSchema:{type:'object',properties,required,additionalProperties:false},annotations:{readOnlyHint:read,destructiveHint:false,openWorldHint:false,idempotentHint:true},fn});
export const evidenceTools=[
 tool('media_result_import','Bind a probed, uploaded local audio or rendered video to its immutable input source and declared time interval. Enforces lineage access; producer claims remain caller-supplied.','intelligence:write',{videoId:str,sourceVersionId:str,expectedRevision:int,claim,requestKey:str,producer:str,start:num,end:num},['videoId','sourceVersionId','expectedRevision','requestKey','producer','start','end'],(c,t,b)=>importMediaResult(c,b.videoId,b),false),
 tool('source_versions','List immutable source identities and measured or unknown content fingerprints. Legacy unknown hashes cannot establish content equality.','videos:read',{videoId:str},['videoId'],(c,t,b)=>versions(c,b.videoId)),
 tool('evidence_search','Search authorized immutable evidence by text, source, interval, layer and language. Visual descriptions are sampled; legacy provenance is explicitly unknown.','search:read',{videoId:str,sourceVersionId:str,query:str,kind:str,language:str,start:num,end:num,limit:int,cursor:str},[],evidenceSearch),
 tool('evidence_bundle','Reauthorize up to fifty source-linked evidence references as a comparison or citation bundle. Fails if any reference is inaccessible.','search:read',{ids:{type:'array',items:str,minItems:1,maxItems:50}},['ids'],evidenceBundle),
 tool('finding_import','Append caller-produced findings with an immutable source version and interval. Caller/model claims are not certified by the platform.','intelligence:write',{videoId:str,sourceVersionId:str,expectedRevision:int,claim,requestKey:str,producer:str,kind:{type:'string',enum:['finding','transcript','visual','translation','quality']},start:num,end:num,text:str,language:str},['videoId','sourceVersionId','expectedRevision','requestKey','producer','start','end','text'],(c,t,b)=>importFinding(c,b.videoId,b),false)
];
