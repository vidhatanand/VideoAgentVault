import {deleteTimeline} from '../approvals/resources.js';
import {customerView,customerRates} from '../customer-pricing.js';
import * as F from '../media-features.js';
import * as C from '../clips.js';
import * as R from '../provider-policy.js';
/** Stateless MCP Streamable HTTP. Same domain services and tenant authorization as REST. */
import * as L from '../library.js';
import * as S from '../storage.js';
import * as J from '../jobs.js';
import * as P from '../playback.js';
import * as I from '../intelligence.js';
import * as W from '../workspace.js';
import * as B from '../billing.js';
import {authenticate,tenantAuth} from '../auth.js';
import {json,fail,bodyJSON,text,now} from '../util.js';
import {RATES,RATE_VERSION} from '../rates.js';
const str={type:'string'},num={type:'number'},bool={type:'boolean'},int={type:'integer'},arr={type:'array',items:str};
const tool=(name,description,scope,properties,required,fn,destructive=false)=>({name,description,scope,inputSchema:{type:'object',properties:{...properties,expectedRevision:{type:'integer'},approvalId:{type:'string'},runId:{type:'string'},claim:{type:'object',properties:{task:{type:'string'},fence:{type:'integer'}},required:['task','fence'],additionalProperties:false}},required,additionalProperties:false},annotations:{readOnlyHint:/(_list|_get|_quote|_report)$/.test(name)&&!name.includes('credentials'),destructiveHint:destructive,idempotentHint:name.includes('list')||name.includes('get'),openWorldHint:false},fn});
export const STORED_TOOLS=[
 tool('timeline_delete','Delete an owned timeline after exact human approval.','timelines:write',{timelineId:str},['timelineId'],(c,t,a)=>deleteTimeline(c,t,a.timelineId,a),true),
 tool('videos_list','List videos, including folder/tag filters. Tenant is fixed by the API key.','videos:read',{folder:str,tag:str,q:str,limit:int,offset:int},[],(c,t,a)=>L.listVideos(c,t,a)),
 tool('video_get','Read metadata, tags, object sizes and processing status. Does not expose source bytes.','videos:read',{videoId:str},['videoId'],(c,t,a)=>L.getVideo(c,a.videoId)),
 tool('video_update','Rename, describe, move, tag or change visibility. Privacy changes revoke existing playback tokens.','videos:write',{videoId:str,title:str,description:str,folderId:{type:['string','null']},tags:arr,visibility:{type:'string',enum:['private','public','unlisted']},allowedOrigins:arr,watermarkText:str,maxSessions:int,downloadsEnabled:bool},['videoId'],(c,t,a)=>L.updateVideo(c,a.videoId,a)),
 tool('videos_bulk_move_tag','Move/tag up to 50 videos belonging to the key tenant.','videos:write',{ids:arr,folderId:{type:['string','null']},addTags:arr},['ids'],(c,t,a)=>L.bulkVideos(c,t,a)),
 tool('upload_create','Create a resumable MP4/WebM/MOV/audio/image or HLS upload. Return video ID; upload binary via REST, then upload_complete.','videos:write',{title:str,size:int,kind:{type:'string',enum:['mp4','webm','mov','audio','image','hls']},extension:str,folderId:{type:['string','null']},tags:arr,primaryPath:str,durationSeconds:num},['title','kind','size'],(c,t,a)=>S.createVideo(c,t,a)),
 tool('upload_status','Return acknowledged parts for resuming a binary upload.','videos:write',{videoId:str},['videoId'],(c,t,a)=>S.uploadStatus(c,a.videoId)),
 tool('upload_complete','Validate all parts or every local HLS reference before publishing.','videos:write',{videoId:str},['videoId'],(c,t,a)=>S.completeUpload(c,a.videoId)),
 tool('video_delete','Revoke playback immediately and queue irreversible storage/index deletion. Requires confirmDelete=true.','videos:write',{videoId:str,requestKey:str,confirmDelete:bool},['videoId','requestKey','confirmDelete'],(c,t,a)=>J.createJob(c,t,{...a,kind:'delete'}),true),
 tool('folders_list','List hierarchical folders and counts.','videos:read',{},[],(c,t)=>L.folderList(c,t)),
 tool('folder_create','Create a folder; parent must be inside this tenant.','folders:write',{name:str,parentId:{type:['string','null']}},['name'],(c,t,a)=>L.folderWrite(c,t,a)),
 tool('folder_update','Rename/move a folder. Cycles and cross-tenant parents are rejected.','folders:write',{folderId:str,name:str,parentId:{type:['string','null']}},['folderId','name'],(c,t,a)=>L.folderWrite(c,t,a,a.folderId)),
 tool('folder_delete','Delete an empty folder only.','folders:write',{folderId:str},['folderId'],(c,t,a)=>L.folderDelete(c,t,a.folderId,a),true),
 tool('tags_list','List tags and video counts.','videos:read',{},[],(c,t)=>L.tagList(c,t)),
 tool('tag_create','Create a reusable tenant tag.','tags:write',{name:str},['name'],(c,t,a)=>L.tagWrite(c,t,a)),
 tool('tag_rename','Rename a tag and update affected video metadata.','tags:write',{tagId:str,name:str},['tagId','name'],(c,t,a)=>L.tagWrite(c,t,a,a.tagId)),
 tool('tag_delete','Remove a tag without deleting videos.','tags:write',{tagId:str},['tagId'],(c,t,a)=>L.tagDelete(c,t,a.tagId),true),
 tool('playback_create','Create a short-lived, revocable viewing session. viewerId must be a stable pseudonymous end-user ID when using an app key. Tokens are sensitive.','playback:create',{videoId:str,viewerId:str},['videoId'],(c,t,a)=>P.startPlayback(c,a)),
 tool('playback_revoke','Revoke all playback sessions/tokens for a video.','videos:write',{videoId:str},['videoId'],(c,t,a)=>P.revokePlayback(c,a.videoId),true),
 tool('share_create','Create an expiring secret share URL for a video. Treat it as a password.','videos:write',{videoId:str,days:int},['videoId'],(c,t,a)=>P.createShare(c,a.videoId,a)),
 tool('share_revoke','Revoke a share link and its ability to authorize playback.','videos:write',{videoId:str,shareId:str},['videoId','shareId'],(c,t,a)=>P.revokeShare(c,a.videoId,a.shareId),true),
 tool('jobs_list','List job states, results and provisional cost summaries.','videos:read',{},[],(c,t)=>J.jobList(c,t)),
 tool('job_get','Get full job state/events and separately labeled cost receipts.','videos:read',{jobId:str},['jobId'],(c,t,a)=>J.getJob(c,a.jobId)),
 tool('processing_quote','Read a conservative credit hold, with no paid work started.','processing:write',{kind:{type:'string',enum:J.JOB_KINDS},videoId:str,durationSeconds:num,maxWallSeconds:int,profile:{type:'string',enum:['economy','balanced','fullhd']},recordingId:str,liveId:str,prompt:str},['kind'],(c,t,a)=>J.quoteJob(c,t,a)),
 tool('processing_start','Start a budget-authorized job. Paid calls are not automatically enabled by upload. requestKey is idempotent.','processing:write',{kind:{type:'string',enum:J.JOB_KINDS.filter(x=>x!=='delete')},videoId:str,title:str,requestKey:str,budgetMicros:int,maxWallSeconds:int,timelineId:str,sourceId:str,captureSeconds:int,prompt:str,query:str,visual:bool,audio:bool,encrypted:bool,visualPrompt:str,folderId:str,tag:str,layer:str,limit:int,profile:{type:'string',enum:['economy','balanced','fullhd']},fullHD:bool,timestampSeconds:num,previewSeconds:num,spriteFrames:int,format:{type:'string',enum:['mp4','m4a']},startSeconds:num,endSeconds:num,logoVideoId:str,logoPosition:{type:'string',enum:['top-left','top-right','bottom-left','bottom-right']},logoWidthPct:num,recordingId:str,liveId:str},['kind','requestKey','budgetMicros'],(c,t,a)=>J.createJob(c,t,a)),
 tool('job_cancel','Cancel queued/running work; already incurred provider costs are retained.','processing:write',{jobId:str},['jobId'],(c,t,a)=>J.cancelJob(c,a.jobId),true),
 tool('search_keyword','Search indexed text with timestamp citations and folder/tag filters. Semantic search uses a budgeted processing job.','search:read',{query:str,folderId:str,tag:str,layer:str,videoId:str,limit:int},['query'],(c,t,a)=>I.search(c,t,a)),
 tool('transcript_get','Read timestamped index artifacts.','search:read',{videoId:str,start:num,end:num,limit:int,offset:int},['videoId'],(c,t,a)=>I.artifactList(c,a.videoId,a)),
 tool('transcript_import','Import caller-supplied timestamped transcript segments; indexed for keyword search without a model call.','intelligence:write',{videoId:str,segments:{type:'array',maxItems:1000,items:{type:'object',properties:{start:num,end:num,text:str},required:['start','end','text'],additionalProperties:false}}},['videoId','segments'],(c,t,a)=>I.importTranscript(c,a.videoId,a)),
 tool('timelines_list','List saved edit timelines.','videos:read',{},[],(c,t)=>W.timelines(c,t)),
 tool('timeline_save','Save exact cuts/concatenation, crop/contain, fade and text overlays. Rendering is a separate budgeted job.','timelines:write',{timelineId:str,name:str,spec:{type:'object',properties:{clips:{type:'array',items:{type:'object',properties:{videoId:str,start:num,end:num},required:['videoId','end']}},textOverlays:{type:'array',items:{type:'object',properties:{text:str,start:num,end:num,position:{type:'string',enum:['top','center','bottom']}},required:['text','start','end']}},width:int,height:int,fit:{type:'string',enum:['crop','contain']},fade:bool,encrypted:bool},required:['clips']}},['name','spec'],(c,t,a)=>W.saveTimeline(c,t,a,a.timelineId)),
 tool('analytics_report','Read watch hours, buffering, startup, completion, country and server delivery counters. Client telemetry is not a supplier invoice.','analytics:read',{days:int,videoId:str},[],(c,t,a)=>P.analytics(c,t,a)),
 tool('billing_report','Read workspace credit activity and provisional versus finalized charges.','billing:read',{period:str},[],(c,t,a)=>B.billingReport(c,t,a.period)),
 tool('events_list','Read indexed-text detection rules, detections and webhook delivery state.','videos:read',{},[],(c,t)=>W.eventSettings(c,t)),
 tool('rule_save','Create/update comma-separated keyword rules applied to new indexed text. Not real-time safety-certified vision.','events:write',{id:str,name:str,query:str,enabled:bool},['name','query'],(c,t,a)=>W.saveRule(c,t,a)),
 tool('webhook_create','Create an exact-host-allowlisted HTTPS event destination; signing secret is returned once.','events:write',{url:str,topics:arr},['url'],(c,t,a)=>W.addWebhook(c,t,a)),
 tool('webhook_disable','Disable a webhook.','events:write',{webhookId:str},['webhookId'],(c,t,a)=>W.disableWebhook(c,t,a.webhookId),true),
 tool('sources_list','List source metadata without decrypting ingestion credentials.','videos:read',{},[],(c,t)=>W.sourceList(c,t)),
 tool('source_create','Register an administrator-allowlisted HTTPS source; ingestion/capture requires a separate processing job.','sources:write',{name:str,url:str,folderId:str},['name','url'],(c,t,a)=>W.addSource(c,t,a)),

 tool('media_tracks_list','List caption and alternate audio tracks including language and defaults.','videos:read',{videoId:str},['videoId'],(c,t,a)=>F.trackList(c,a.videoId)),
 tool('captions_save','Create or replace a plain-text VTT/SRT caption track. No model call; also refreshes playable captions.','intelligence:write',{videoId:str,trackId:str,language:str,label:str,default:bool,format:{type:'string',enum:['vtt','srt']},content:str},['videoId','content'],(c,t,a)=>F.saveCaptions(c,a.videoId,a,a.trackId)),
 tool('audio_track_attach','Attach an already uploaded same-tenant audio asset. A subsequent approved transcode packages it into HLS.','processing:write',{videoId:str,sourceVideoId:str,language:str,label:str,default:bool},['videoId','sourceVideoId','language','label'],(c,t,a)=>F.attachAudio(c,a.videoId,a)),
 tool('media_track_delete','Tombstone a track. Audio already embedded in an old HLS generation needs a new transcode to disappear.','intelligence:write',{videoId:str,trackId:str},['videoId','trackId'],(c,t,a)=>F.deleteTrack(c,a.videoId,a.trackId,a),true),
 tool('exports_list','List generated MP4/M4A exports and revocation state.','videos:read',{videoId:str},['videoId'],(c,t,a)=>F.exportList(c,a.videoId)),
 tool('download_create','Issue a short-lived export URL, only when downloads are enabled. Treat URL as a secret; already copied data cannot be recalled.','downloads:create',{videoId:str,exportId:str,ttlSeconds:int},['videoId','exportId'],(c,t,a)=>F.issueDownload(c,a.videoId,a)),
 tool('export_revoke','Revoke an export and its download grants.','videos:write',{videoId:str,exportId:str},['videoId','exportId'],(c,t,a)=>F.revokeExport(c,a.videoId,a.exportId),true),
 tool('provider_policy_get','Read owner-controlled Stream permission, default quality and per-job budget ceiling. MCP keys cannot change provider policy.','videos:read',{},[],(c,t)=>R.getPolicy(c,t)),
 tool('processing_plan','Choose R2 reuse, FFmpeg, AI or explicitly requested Stream. Returns expiring plan with source snapshot and quote; no paid work.','processing:write',{videoId:str,need:{type:'string',enum:['playback','adaptive','preview','export','index','managed_conversion']},profile:{type:'string',enum:['economy','balanced','fullhd']},maxWallSeconds:int,timestampSeconds:num,previewSeconds:num,spriteFrames:int,format:{type:'string',enum:['mp4','m4a']},startSeconds:num,endSeconds:num,logoVideoId:str},['videoId','need'],(c,t,a)=>R.planProcessing(c,t,a)),
 tool('processing_plan_get','Read the exact saved plan and server quote; reject expired or changed source snapshots.','processing:write',{planId:str},['planId'],(c,t,a)=>R.getPlan(c,t,a.planId)),
 tool('processing_plan_execute','Execute the exact approved plan once. Rejects expired/stale plans and insufficient credit approval. Never silently falls back.','processing:write',{planId:str,approved:bool,budgetMicros:int},['planId','approved','budgetMicros'],(c,t,a)=>R.executePlan(c,t,a.planId,a)),
 tool('clips_compose','Reuse independent muxed HLS segments without re-encoding. Compatible ladders only, bounded segment count; returns expanded actual boundaries. Sources cannot be deleted while clips reference them.','videos:write',{title:str,requestKey:str,folderId:{type:['string','null']},tags:arr,clips:{type:'array',maxItems:12,items:{type:'object',properties:{videoId:str,start:num,end:num},required:['videoId','end'],additionalProperties:false}}},['requestKey','clips'],(c,t,a)=>C.composeClips(c,t,a)),
];
