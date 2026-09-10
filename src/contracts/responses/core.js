import {string,integer,number,boolean,array,object,nullable,ok,identifier} from './types.js';
const grant=object({id:string,url:string,expiresAt:integer});
/** Strict known DTOs. Missing operations remain explicitly untyped, never generic fake schemas. */
export const coreResponses={
 tag_create:object({id:string,name:string}),tag_rename:object({id:string,name:string}),tag_delete:ok,
 playback_revoke:ok,share_revoke:ok,share_create:grant,download_create:grant,export_revoke:ok,
 source_create:identifier,rule_save:identifier,work_claim_update:ok,
 videos_bulk_move_tag:object({updated:array(string)}),
 access_explain:object({allowed:boolean,reason:string},['allowed']),
 provider_policy_get:object({allowStream:boolean,defaultProfile:{type:'string',enum:['economy','balanced','fullhd']},maxJobMicros:integer}),
 processing_quote:object({kind:string,profile:string,renditionHeights:array(integer),maxWallSeconds:integer,sourceBytes:integer,durationSeconds:number,reserveMicros:integer,quality:string,note:string}),
 job_events:object({items:array(object({sequence:integer,id:string,jobId:string,state:string,createdAt:integer})),nextCursor:integer,terminal:boolean}),
 work_claim:object({tenant_id:string,video_id:string,task:string,agent_id:string,fence:integer,lease_until:integer}),
 media_track_delete:object({ok:{type:'boolean',enum:[true]},requiresTranscode:boolean,note:nullable(string)}),
 audio_track_attach:object({id:string,requiresTranscode:{type:'boolean',enum:[true]},note:string})
};
