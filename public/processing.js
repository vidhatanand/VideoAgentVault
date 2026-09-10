import {op,panel,escape,form,error,usd} from './client.js';
export async function processVideo(video,kind){
  const titles={index:'Understand speech',summarize:'Summarize this video',transcode:'Prepare adaptive streaming',export:'Export an MP4',ask:'Ask this video'};
  const root=panel(titles[kind],`<p>${kind==='ask'?'Ask a question grounded in the indexed video. Index the video first.':'Review the estimated spending hold before starting. Jobs continue when you close this drawer.'}</p><form>${kind==='ask'?'<label>Your question<textarea name="query" required placeholder="What are the main findings?"></textarea></label>':''}<button type="submit">Get estimate</button></form>`);
  form(root,async data=>{
    const current=await op('video_get',{videoId:video.id});
    const args={kind,videoId:video.id,maxWallSeconds:900,...(kind==='transcode'?{profile:'economy'}:{}),...(kind==='ask'?{query:String(data.get('query')),scope:'video'}:{})};
    const quote=await op('processing_quote',{kind,videoId:video.id,maxWallSeconds:900,...(kind==='transcode'?{profile:'economy'}:{})});
    const key=crypto.randomUUID();root.innerHTML=`<h3>Approve estimated usage</h3><p>Up to <strong>${usd(quote.reserveMicros)}</strong> will be reserved from your workspace's provider-spend budget. Actual usage is settled after processing. This is an estimate, not your Cloudflare invoice.</p><button class="primary" id="approve">Approve and start</button>`;
    root.querySelector('#approve').onclick=async e=>{e.target.disabled=true;try{const job=await op('processing_start',{...args,requestKey:key,approved:true,budgetMicros:quote.reserveMicros,expectedRevision:current.revision});watchJob(job.id,root);}catch(ex){error(root,ex);}};
  });
}
export async function watchJob(id,root){
  let cancelled=false;document.querySelector('#drawer').addEventListener('close',()=>{cancelled=true;},{once:true});
  while(!cancelled){
    try{const job=await op('job_get',{jobId:id});const p=job.progress;
      root.innerHTML=`<h3>${escape(job.kind)} · ${escape(job.state)}</h3><p>Job ${escape(id)}</p>${p?`<p>${escape(p.stage)} ${p.etaSeconds?`· estimated ${Math.ceil(p.etaSeconds/60)} minutes remaining`:''}</p><progress max="${Number(p.total)||1}" value="${Number(p.completed)||0}"></progress>`:'<p>Waiting for the next processing update…</p>'}`;
      if(job.finished_at){const result=job.result?.summary||job.result?.answer||job.result?.text;if(result)root.innerHTML+=`<div class="chat-answer">${escape(typeof result==='string'?result:JSON.stringify(result))}</div>`;if(job.last_error)error(root,new Error(job.last_error));root.innerHTML+='<p>Results remain in your workspace. You can reopen them from Activity.</p>';break;}
    }catch(ex){error(root,ex);break;}
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
}
