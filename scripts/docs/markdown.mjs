export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages = {'README.md':'index.html','docs/INSTALL_AGENT.md':'installation.html','INSTALL_AGENT.md':'installation.html','AGENT_WORKFLOWS.md':'agents.html','docs/AGENT_WORKFLOWS.md':'agents.html','CONTRIBUTING.md':'contributing.html','LICENSING.md':'licensing.html','RELEASE_STATUS.md':'status.html','docs/RELEASE_STATUS.md':'status.html','SECURITY.md':'security.html','docs/SECURITY.md':'security.html','../LICENSE':'LICENSE.txt','LICENSE':'LICENSE.txt'};
function link(value) {
  const target=pages[value] || value;
  if (/^(?:https:\/\/|#)/.test(target)) return target;
  if (/^[\w./-]+(?:#[\w-]+)?$/.test(target) && !target.startsWith('//')) {
    if (target.startsWith('../licenses/')) return target.slice(3);
    return target;
  }
  return null;
}
function inline(text) {
  const tokens=/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g;
  let result='',at=0;
  for (const match of text.matchAll(tokens)) {
    result+=escape(text.slice(at,match.index)); const token=match[0];
    if(token.startsWith('`'))result+='<code>'+escape(token.slice(1,-1))+'</code>';
    else if(token.startsWith('**'))result+='<strong>'+escape(token.slice(2,-2))+'</strong>';
    else {const m=/^\[([^\]]+)\]\(([^)]+)\)$/.exec(token),href=link(m[2]);result+=href?`<a href="${escape(href)}">${escape(m[1])}</a>`:escape(m[1]);}
    at=match.index+token.length;
  }
  return result+escape(text.slice(at));
}
export function markdown(source) {
  let code=false,list=null,output=[];
  const close=()=>{if(list){output.push(`</${list}>`);list=null;}};
  for(const line of source.split('\n')) {
    if(line.startsWith('```')){close();output.push(code?'</code></pre>':'<pre><code>');code=!code;continue;}
    if(code){output.push(escape(line)+'\n');continue;}
    const item=/^(?:([-*]) |(\d+)\. )(.*)$/.exec(line);
    if(item){const kind=item[1]?'ul':'ol';if(list!==kind){close();list=kind;output.push(`<${kind}>`);}output.push(`<li>${inline(item[3])}</li>`);continue;}
    close();if(!line.trim())continue;
    const heading=/^(#{1,6}) (.*)$/.exec(line);
    output.push(heading?`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`:`<p>${inline(line)}</p>`);
  }
  close();if(code)throw new Error('UNCLOSED_MARKDOWN_CODE_FENCE');
  return output.join('\n');
}
