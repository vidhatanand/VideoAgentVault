/** Signed native/HLS playback. Quality, language tracks, seek-preview sprites and bounded telemetry. */
export async function mountPlayer(root,{videoId,shareToken,start=0,api,onError=()=>{}}){
 const session=await api('/api/playback/start',{method:'POST',body:{videoId,...(shareToken?{shareToken}:{})}});
 let current=session,closed=false,hls=null,seq=0,watch=0,buffer=0,waiting=false,last=performance.now(),startup=0,firstPlay=0;
 root.replaceChildren();const wrap=document.createElement('div');wrap.className='player-wrap';root.append(wrap);
 const isImage=session.kind==='image',media=document.createElement(isImage?'img':'video');wrap.append(media);
 const mark=document.createElement('div');mark.className='watermark';mark.textContent=session.watermark;wrap.append(mark);
 const tools=document.createElement('div');tools.className='player-tools';root.append(tools);
 const info=document.createElement('span');info.textContent=session.encrypted?'Protected playback':'Private viewing session';tools.append(info);
 function select(label,placeholder){const node=document.createElement('select');node.setAttribute('aria-label',label);const option=document.createElement('option');option.value='-1';option.textContent=placeholder;node.append(option);tools.append(node);return node;}
 const quality=select('Playback quality','Auto quality'),captions=select('Subtitle language','Subtitles off'),audio=select('Audio language','Original audio');
 const signed=url=>{const u=new URL(url,location.href);if(u.origin===location.origin&&u.pathname.startsWith('/media/'))u.searchParams.set('token',current.token);return u.href;};
 const option=(value,label)=>{const o=document.createElement('option');o.value=String(value);o.textContent=label;return o;};
 function captionData(){return current.captionTracks?.length?current.captionTracks:current.captions?[{id:'legacy',language:'und',label:'Transcript',url:current.captions,is_default:0}]:[];}
 function syncCaptions(refresh=false){
  if(isImage)return;const data=captionData(),selected=refresh?captions.value:String(data.findIndex(t=>t.is_default));
  for(const node of media.querySelectorAll('track'))node.remove();captions.replaceChildren(option(-1,'Subtitles off'));
  for(const [i,t]of data.entries()){const node=document.createElement('track');node.kind='captions';node.label=t.label;node.srclang=t.language||'und';node.src=signed(t.url);node.dataset.trackId=t.id;node.default=String(i)===selected;media.append(node);captions.append(option(i,t.label+' ('+(t.language||'und')+')'));}
  captions.value=selected;captions.hidden=!data.length;
  for(const [i,t]of Array.from(media.textTracks||[]).entries())t.mode=String(i)===selected?'showing':'disabled';
 }
 function audioOptions(){const tracks=hls?.audioTracks||Array.from(media.audioTracks||[]);audio.replaceChildren();for(const [i,t]of tracks.entries())audio.append(option(i,t.name||t.label||t.lang||t.language||'Audio '+(i+1)));audio.hidden=tracks.length<2;if(tracks.length)audio.value=String(hls?hls.audioTrack:tracks.findIndex(t=>t.enabled));}
 function preserveNativeSource(){const position=media.currentTime,playing=!media.paused;media.src=signed(current.url);media.addEventListener('loadedmetadata',()=>{if(Number.isFinite(position))media.currentTime=position;audioOptions();if(playing)media.play().catch(()=>{});},{once:true});}
 let previewSeek=null,previewThumb=null;
 function setupPreview(){
  const layout=current.spriteLayout;if(isImage||!current.sprite||!layout)return;
  const box=document.createElement('div');box.className='seek-preview';const label=document.createElement('label');label.textContent='Preview and seek';
  previewSeek=document.createElement('input');previewSeek.type='range';previewSeek.min='0';previewSeek.max=String(current.durationSeconds||layout.durationSeconds||1);previewSeek.step='0.1';previewSeek.value='0';previewSeek.setAttribute('aria-label','Preview and seek');label.append(previewSeek);
  previewThumb=document.createElement('div');previewThumb.className='seek-preview-thumb';previewThumb.setAttribute('aria-hidden','true');const stamp=document.createElement('output');box.append(label,previewThumb,stamp);root.append(box);
  const frameWidth=layout.frameWidth||layout.width||160,frameHeight=layout.frameHeight||layout.height||90,columns=layout.columns||6,frames=layout.frames||layout.count||12;
  const show=()=>{const t=Number(previewSeek.value),duration=current.durationSeconds||layout.durationSeconds||1,index=Math.min(frames-1,Math.floor(t/duration*frames));previewThumb.style.width=frameWidth+'px';previewThumb.style.height=frameHeight+'px';previewThumb.style.backgroundImage=`url("${signed(current.sprite)}")`;previewThumb.style.backgroundPosition=`-${index%columns*frameWidth}px -${Math.floor(index/columns)*frameHeight}px`;stamp.textContent=Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');};
  previewSeek.addEventListener('input',show);previewSeek.addEventListener('change',()=>{media.currentTime=Number(previewSeek.value);});show();
 }
 async function attach(url){
  if(isImage){media.src=signed(url);quality.hidden=captions.hidden=audio.hidden=true;return;}
  media.controls=true;media.playsInline=true;media.preload='metadata';media.controlsList='nodownload noremoteplayback';media.disablePictureInPicture=false;
  if(current.poster)media.poster=signed(current.poster);syncCaptions();
  if(current.kind==='hls'&&window.Hls?.isSupported()){
   const DefaultLoader=window.Hls.DefaultConfig.loader;
   class SignedLoader extends DefaultLoader{load(context,config,callbacks){context.url=signed(context.url);super.load(context,config,callbacks);}}
   hls=new window.Hls({loader:SignedLoader,capLevelToPlayerSize:true,startLevel:0,maxBufferLength:navigator.connection?.saveData?12:24,maxMaxBufferLength:40,backBufferLength:20,enableWorker:true});
   hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{quality.replaceChildren(option(-1,'Auto quality'));for(const[i,l]of hls.levels.entries())quality.append(option(i,l.height+'p'));audioOptions();if(start)media.currentTime=start;});
   hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED,audioOptions);
   hls.on(window.Hls.Events.ERROR,(_,d)=>{if(d.fatal){heartbeat(true).catch(()=>{});onError('Playback interrupted. Reopen the video to start a new authorized session.');}});
   hls.loadSource(signed(url));hls.attachMedia(media);
  }else if(current.kind==='hls'&&!media.canPlayType('application/vnd.apple.mpegurl'))throw new Error('HLS assets are missing. Run npm install and npm run vendor before deploying.');
  else{media.src=signed(url);quality.hidden=true;media.addEventListener('loadedmetadata',()=>{if(start)media.currentTime=start;audioOptions();},{once:true});}
  setupPreview();
 }
 if(!isImage){
  quality.addEventListener('change',()=>{if(hls)hls.currentLevel=Number(quality.value);});
  captions.addEventListener('change',()=>{for(const[i,t]of Array.from(media.textTracks).entries())t.mode=String(i)===captions.value?'showing':'disabled';});
  audio.addEventListener('change',()=>{if(hls)hls.audioTrack=Number(audio.value);else for(const[i,t]of Array.from(media.audioTracks||[]).entries())t.enabled=String(i)===audio.value;});
  media.addEventListener('play',()=>{if(!firstPlay)firstPlay=performance.now();});media.addEventListener('playing',()=>{waiting=false;if(!startup&&firstPlay)startup=performance.now()-firstPlay;});media.addEventListener('waiting',()=>{waiting=true;});media.addEventListener('ended',()=>heartbeat().catch(()=>{}));media.addEventListener('error',()=>heartbeat(true).catch(()=>{}));
 }
 async function heartbeat(error=false){if(closed||isImage)return;const payload={token:current.token,seq:++seq,watchSeconds:Math.min(watch,120),bufferSeconds:Math.min(buffer,120),position:Number.isFinite(media.currentTime)?media.currentTime:0,startupMs:Math.min(startup,120000),completed:media.ended,error};watch=0;buffer=0;await api('/api/playback/heartbeat',{method:'POST',body:payload});}
 try{await attach(session.url);}catch(e){hls?.destroy();await api('/api/playback/stop',{method:'POST',body:{token:current.token}}).catch(()=>{});throw e;}
 const tick=setInterval(()=>{const ts=performance.now(),dt=Math.min((ts-last)/1000,2);last=ts;if(!isImage&&!media.paused&&!media.ended){if(waiting)buffer+=dt;else watch+=dt;}},1000);
 const beat=setInterval(()=>heartbeat().catch(()=>{}),15000);
 const move=setInterval(()=>{mark.style.top=(12+Math.random()*57)+'%';mark.style.right=(5+Math.random()*25)+'%';},30000);
 const renew=setInterval(async()=>{try{if(closed)return;const next=await api('/api/playback/renew',{method:'POST',body:{token:current.token}});if(closed)return;current={...current,...next};if(isImage)media.src=signed(current.url);else{syncCaptions(true);if(!hls)preserveNativeSource();if(current.poster)media.poster=signed(current.poster);if(previewThumb&&current.sprite)previewThumb.style.backgroundImage=`url("${signed(current.sprite)}")`;}}catch{onError('Playback authorization expired or was revoked.');media.pause?.();}},Math.max(30,session.renewAfterSeconds)*1000);
 const visibility=()=>{if(document.hidden&&!isImage)media.pause();};document.addEventListener('visibilitychange',visibility);
 return {session,media,async close(){if(closed)return;await heartbeat().catch(()=>{});closed=true;clearInterval(tick);clearInterval(beat);clearInterval(move);clearInterval(renew);document.removeEventListener('visibilitychange',visibility);hls?.destroy();media.pause?.();media.removeAttribute('src');media.load?.();await api('/api/playback/stop',{method:'POST',body:{token:current.token}}).catch(()=>{});}};
}
