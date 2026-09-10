import {requireVideo} from './library.js';
import {saveCaptions} from './media-features.js';
import {choice,fail} from './util.js';

export const MAX_CAPTION_BYTES=1024*1024;

/** Raw UTF-8 SRT/WebVTT upload, bounded even without Content-Length. */
export async function uploadCaptionFile(c,vid,q,trackId){
 await requireVideo(c,vid,'intelligence:write','editor');
 const format=choice(q.format||'srt',['srt','vtt'],'format');
 if(q.default!==undefined&&!['true','false'].includes(q.default))fail(400,'INVALID_CAPTION_DEFAULT');
 const type=(c.req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['application/x-subrip','text/plain','text/vtt','application/octet-stream'].includes(type))fail(415,'SUBTITLE_CONTENT_TYPE_REQUIRED');
 if(Number(c.req.headers.get('content-length')||0)>MAX_CAPTION_BYTES)fail(413,'SUBTITLE_TOO_LARGE');
 const reader=c.req.body?.getReader();if(!reader)fail(400,'EMPTY_SUBTITLE_FILE');
 const chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_CAPTION_BYTES){await reader.cancel();fail(413,'SUBTITLE_TOO_LARGE');}chunks.push(value);}
 if(!size)fail(400,'EMPTY_SUBTITLE_FILE');
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 let content;try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail(400,'SUBTITLE_UTF8_REQUIRED');}
 return saveCaptions(c,vid,{content,format,expectedRevision:q.expectedRevision===undefined?undefined:Number(q.expectedRevision),claim:q.claimTask?{task:q.claimTask,fence:Number(q.claimFence)}:undefined,language:q.language||'und',label:q.label,...(q.default===undefined?{}:{default:q.default==='true'})},trackId);
}
