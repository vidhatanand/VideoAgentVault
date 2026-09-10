import readline from 'node:readline';
export async function serveMcp(client: any){
 const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
 for await(const line of lines){if(!line.trim())continue;let req;try{
  if(line.length>1048576)throw new Error('Too large');req=JSON.parse(line);
  const r=await fetch(client.origin+'/mcp',{method:'POST',redirect:'manual',headers:{Authorization:`Bearer ${client.key}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify(req),signal:AbortSignal.timeout(120000)});
  if([202,204].includes(r.status)){await r.body?.cancel();continue;}if(!r.ok)throw new Error('Rejected');const b=await r.json();if(!b || typeof b !== 'object' || !('jsonrpc' in b) || b.jsonrpc !== '2.0')throw new Error('Wrong protocol');if(req.id!==undefined)process.stdout.write(JSON.stringify(b)+'\n');
 }catch{if(req?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,error:{code:-32000,message:'MCP transport failed. No automatic mutation retry.'}})+'\n');else process.stderr.write('Invalid MCP input or transport error.\n');}}
}
