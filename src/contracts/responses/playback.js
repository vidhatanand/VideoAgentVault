import {string,integer,number,boolean,array,object,nullable,jsonValue,extend,ok} from './types.js';
import artifacts from './rows/artifacts.js';
import {libraryResponses} from './library.js';
const range=object({start:number,end:number});
export const playbackResponses={
 folder_delete:ok,
 playback_create:object({captionTracks:array(object({id:string,language:string,label:string,is_default:integer,path:string,url:string})),preview:nullable(string),sprite:nullable(string),spriteLayout:jsonValue,sessionId:string,videoId:string,title:string,kind:string,encrypted:boolean,token:string,expiresAt:integer,renewAfterSeconds:integer,url:string,poster:nullable(string),captions:nullable(string),watermark:string,durationSeconds:number,protection:string}),
 search_keyword:object({mode:{type:'string',enum:['keyword']},items:array(extend(artifacts,{evidenceId:nullable(string),source_version_id:nullable(string),title:string,rank:number,data:jsonValue,watchUrl:string}))}),
 clips_compose:extend(libraryResponses.upload_complete,{effectiveRanges:array(object({videoId:string,requested:range,actual:range})),note:string},[],['effectiveRanges','note'])
};
