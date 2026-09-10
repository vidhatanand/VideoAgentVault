import {choice,text,fail} from '../util.js';
/** Share validation between credit previews and job creation. */
export function chatOptions(input){
 const options={};
 if(input.scope!==undefined)options.scope=choice(input.scope,['video','workspace'],'scope');
 if(options.scope==='video')options.videoId=text(input.videoId,'videoId',80);
 if(input.chatHistory!==undefined){
  if(!Array.isArray(input.chatHistory)||input.chatHistory.length>8)fail(400,'INVALID_CHAT_HISTORY');
  options.chatHistory=input.chatHistory.map(message=>{
   if(!message||typeof message!=='object')fail(400,'INVALID_CHAT_HISTORY');
   return {role:choice(message.role,['user','assistant'],'role'),content:text(message.content,'content',4000)};
  });
 }
 return options;
}
