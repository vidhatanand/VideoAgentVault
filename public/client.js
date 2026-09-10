export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(url,{method='GET',body,raw=false}={}){
  const response=await fetch(url,{method,headers:body===undefined||raw?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:raw?body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error?.message||`Request failed (${response.status})`);return data;
}
export const op=(name,args={})=>api('/api/workspace/operations/'+name,{method:'POST',body:args});
export const usd=micros=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(Number(micros||0)/1e6);
export const bytes=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(n||0)/1e6)+' MB';
const drawer=document.querySelector('#drawer');
export function panel(title,html){document.querySelector('#drawer-title').textContent=title;document.querySelector('#drawer-content').innerHTML=html;if(!drawer.open)drawer.showModal();return document.querySelector('#drawer-content');}
export function error(root,e){let node=root.querySelector('.error');if(!node){node=document.createElement('p');node.className='error';node.setAttribute('role','alert');root.append(node);}node.textContent=e.message||String(e);}
export function form(root,handler){root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await handler(new FormData(e.target),e.target);}catch(ex){error(root,ex);}finally{button.disabled=false;}});}
document.querySelector('#close-drawer').onclick=()=>drawer.close();
