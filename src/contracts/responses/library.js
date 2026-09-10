import videos from './rows/videos.js';
import folders from './rows/folders.js';
import tags from './rows/tags.js';
import tracks from './rows/media_tracks.js';
import exports from './rows/media_exports.js';
import artifacts from './rows/artifacts.js';
import versions from './rows/source_versions.js';
import manifests from './rows/artifact_manifests.js';
import {string,integer,array,object,nullable} from './types.js';
const extend=(row,add={},omit=[])=>object({...Object.fromEntries(Object.entries(row.properties).filter(([k])=>!omit.includes(k))),...add});
const video=extend(videos,{tags:array(string),allowedOrigins:array(string)},['upload_id','upload_key']);
const details=extend(video,{objects:array(object({path:string,size:integer,role:string,content_type:string,status:string}))});
export const libraryResponses={
 videos_list:object({items:array(extend(video,{stored_bytes:integer})),nextOffset:nullable(integer)}),
 video_get:details,video_update:details,
 upload_create:extend(video,{partSize:integer,parts:integer}),upload_complete:video,
 upload_status:object({id:string,status:string,expectedBytes:integer,partSize:integer,parts:array(object({part_number:integer,etag:string,sha256:nullable(string),size:integer}))}),
 folders_list:array(extend(folders,{shared_agents:integer,video_count:integer})),folder_create:folders,folder_update:folders,
 tags_list:array(extend(tags,{video_count:integer})),
 media_tracks_list:array(tracks),captions_save:tracks,exports_list:array(exports),transcript_get:array(artifacts),
 transcript_import:object({captionTrackId:string,count:integer,indexed:{type:'string',enum:['keyword']},semantic:string}),
 source_versions:object({items:array(versions),currentSourcePath:string}),media_result_import:manifests,finding_import:manifests
};
