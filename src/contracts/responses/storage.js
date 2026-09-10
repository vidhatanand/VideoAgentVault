import {string,integer,number,boolean,array,object,nullable,extend} from './types.js';
const strings=array(string);
const asset=object({id:string,title:string,revision:integer,kind:string,status:string,folderId:nullable(string),bytes:integer,sourceBytes:integer,derivedBytes:integer,fileCount:integer,estimatedMonthlyMicros:number,
 usage:object({windowDays:integer,observationDays:number,playbackSessions:integer,watchSeconds:number,mediaRequests:integer,agentJobs:integer,lastRecordedUse:nullable(integer),agentReads:string,fileLevelUsage:string}),
 review:object({priority:number,blockers:strings,reasons:strings,regenerationCost:string,retentionPolicy:string})});
export const storageResponses={
 storage_inventory:object({items:array(asset),totals:object({videos:integer,bytes:integer,sourceBytes:integer,derivedBytes:integer,estimatedMonthlyMicros:number}),nextOffset:nullable(integer),asOf:integer,days:integer,ranking:object({version:integer,label:string,weights:object({size:number,inactivity:number,lowObservedUse:number,derivedFraction:number}),description:string}),pricing:object({currency:string,basis:string,pricingVersion:string}),scope:string,usageNote:string}),
 storage_asset:extend(asset,{related:array(object({id:string,title:string,relationship:string})),moreRelated:boolean,files:array(object({id:string,path:string,role:string,size:integer,stored_at:nullable(integer),estimatedMonthlyMicros:number})),nextOffset:nullable(integer)}),
 storage_cleanup_preview:object({items:array(object({videoId:string,title:string,expectedRevision:integer,bytes:integer,estimatedMonthlyMicros:number,blockers:strings,approval:object({action:{type:'string',enum:['delete']},payload:object({confirmDelete:{type:'boolean',enum:[true]}})}),scope:string})),blocked:boolean,estimatedMonthlySavingsMicros:number,reclaimableBytes:integer,asOf:integer,expiresAt:integer,requiresHumanApproval:{type:'boolean',enum:[true]},notice:string})
};
