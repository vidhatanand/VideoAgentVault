import {bodyJSON,fail} from '../src/util.js';
export function router(){
  const routes=[];
  function route(method,path,fn){
    const names=[];const pattern=path.split('/').map(p=>p.startsWith(':')?(names.push(p.slice(1)),'([^/]+)'):p==='*'?(names.push('path'),'(.+)'):p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/');
    routes.push({method,path,re:new RegExp('^'+pattern+'$'),names,fn});
  }
  async function dispatch(c){const u=new URL(c.req.url);
    for(const r of routes){if(r.method!==c.req.method)continue;const m=r.re.exec(u.pathname);if(m)return r.fn(c,Object.fromEntries(r.names.map((k,i)=>[k,m[i+1]])),Object.fromEntries(u.searchParams));}
    fail(404,'API_NOT_FOUND');
  }
  return {route,dispatch,routes,body:c=>bodyJSON(c.req)};
}
