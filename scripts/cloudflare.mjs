export function cloudflare(account,token){
  if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw new Error('Cloudflare account and API token are required.');
  return async function call(endpoint,{method='GET',body}={}){
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(60000)});
    const result=await response.json();if(!response.ok||result.success!==true)throw new Error(`Cloudflare ${method} ${endpoint.split('?')[0]} failed (HTTP ${response.status}). Check permissions; provider body is redacted.`);
    return result.result;
  };
}
