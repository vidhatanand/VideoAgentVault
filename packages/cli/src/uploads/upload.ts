import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {atomicJSON} from '../config/profile.js';
import {CliError} from '../errors/index.js';
async function digest(file: string){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
export async function upload(client: any,workspace: string,flags: any,folder?: string){
 if(!flags.file)throw new CliError('FILE_REQUIRED','Use --file and optionally --srt.');
 const file=path.resolve(flags.file),stat=await fs.stat(file),extension=path.extname(file).slice(1).toLowerCase(),kind=['mp4','mov','webm'].includes(extension)?extension:['mp3','m4a','wav'].includes(extension)?'audio':['jpg','png'].includes(extension)?'image':null;
 if(!kind||!stat.isFile()||!stat.size)throw new CliError('UPLOAD_FILE','Choose a nonempty MP4, MOV, WebM, MP3, M4A, WAV, JPG or PNG.');
 const checkpoint=path.resolve(flags.checkpoint||file+'.videoagentvault-upload.json'),lock=checkpoint+'.lock';await fs.mkdir(path.dirname(checkpoint),{recursive:true});let guard;
 try{guard=await fs.open(lock,'wx',0o600);}catch{throw new CliError('UPLOAD_LOCKED','Another uploader holds this checkpoint. After a crash, confirm it has stopped before removing the .lock file.',5);}
 try{
  const sha256=await digest(file),srt=flags.srt?await fs.readFile(flags.srt,'utf8'):null;
  if(srt&&Buffer.byteLength(JSON.stringify(srt))>120000)throw new CliError('CAPTIONS_TOO_LARGE','Caption JSON must fit the API input limit.');
  const identity={origin:client.origin,workspace,file,sha256,size:stat.size,folder:folder??null,title:flags.title||path.basename(file),captionsSha256:srt?createHash('sha256').update(srt).digest('hex'):null};
  let state;try{state=JSON.parse(await fs.readFile(checkpoint,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(state&&JSON.stringify(state.identity)!==JSON.stringify(identity))throw new CliError('SOURCE_CHANGED','Checkpoint does not match the source, captions, destination or metadata.',5);
  if(!state){state={identity,stage:'creating'};await atomicJSON(checkpoint,state);const v=await client.call(workspace,'upload_create',{title:identity.title,kind,extension,size:stat.size,folderId:folder??null});state={...state,videoId:v.id,stage:'parts'};await atomicJSON(checkpoint,state);}
  if(!state.videoId)throw new CliError('UPLOAD_CREATE_UNKNOWN','Creation outcome is unknown. Inspect videos list; attach the verified videoId to this checkpoint before resuming. No second video was created.',8);
  const status=await client.call(workspace,'upload_status',{videoId:state.videoId},true);
  if(status.expectedBytes!==stat.size)throw new CliError('UPLOAD_SIZE_MISMATCH','Server upload size differs from the checkpoint.',5);
  if(status.status!=='ready'){
   if(status.status!=='uploading')throw new CliError('UPLOAD_NOT_RESUMABLE','Server upload is not in an uploadable state.',5);
   const handle=await fs.open(file,'r');try{for(let n=1,offset=0;offset<stat.size;n++,offset+=status.partSize){
    if(!Number.isSafeInteger(status.partSize)||status.partSize<=0||status.partSize>33554432)throw new CliError('PART_SIZE_INVALID','Invalid server part size.',8);
    const buffer=Buffer.alloc(Math.min(status.partSize,stat.size-offset));let count=0;while(count<buffer.length){const r=await handle.read(buffer,count,buffer.length-count,offset+count);if(!r.bytesRead)throw new CliError('SOURCE_CHANGED','The source changed during upload.',5);count+=r.bytesRead;}
    const hash=createHash('sha256').update(buffer).digest('hex');if(status.parts.find(p=>p.part_number===n)?.sha256!==hash)await client.request(`/api/videos/${encodeURIComponent(state.videoId)}/parts/${n}`,{method:'PUT',raw:true,body:buffer});
    process.stderr.write(`Upload verified ${offset+buffer.length}/${stat.size} bytes\n`);
   }}finally{await handle.close();}
   if(await digest(file)!==sha256)throw new CliError('SOURCE_CHANGED','Source changed; completion was not submitted.',5);
   await client.call(workspace,'upload_complete',{videoId:state.videoId});
  }
  if(srt&&state.stage!=='complete'){
   if(state.stage==='captions-submitting')throw new CliError('CAPTIONS_OUTCOME_UNKNOWN','Inspect captions list before retrying; a duplicate caption track was not created.',8);
   const video=await client.call(workspace,'video_get',{videoId:state.videoId},true);
   state.stage='captions-submitting';await atomicJSON(checkpoint,state);
   const track=await client.call(workspace,'captions_save',{videoId:state.videoId,content:srt,format:'srt',language:'en',label:'English',expectedRevision:video.revision});state.captionTrackId=track.id;
  }
  state.stage='complete';await atomicJSON(checkpoint,state);return {videoId:state.videoId,captionTrackId:state.captionTrackId??null,status:'ready',sourceSha256:sha256,checkpoint};
 }finally{await guard.close();await fs.rm(lock,{force:true});}
}
