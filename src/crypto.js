import {enc,utf8,b64url,unb64url,fail,now} from './util.js';
function secretKey(secret){if(typeof secret!=='string'||secret.length<32)fail(503,'SIGNING_NOT_CONFIGURED');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signToken(payload,secret,ttl=900){const t=Math.floor(now()/1000);const h=b64url(enc.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));const b=b64url(enc.encode(JSON.stringify({...payload,iat:t,exp:t+ttl,iss:'videoagentvault'})));const input=`${h}.${b}`;return input+'.'+b64url(await crypto.subtle.sign('HMAC',await secretKey(secret),enc.encode(input)));}
export async function verifyToken(token,secret,scope){
  try{
    if(typeof token!=='string'||token.length>8192)fail(401,'BAD_TOKEN');
    const parts=token.split('.');if(parts.length!==3)fail(401,'BAD_TOKEN');
    const [h,b,s]=parts;const head=JSON.parse(utf8.decode(unb64url(h)));if(head.alg!=='HS256'||head.typ!=='JWT')fail(401,'BAD_TOKEN');
    if(!await crypto.subtle.verify('HMAC',await secretKey(secret),unb64url(s),enc.encode(`${h}.${b}`)))fail(401,'BAD_TOKEN');
    const p=JSON.parse(utf8.decode(unb64url(b))),ts=Math.floor(now()/1000);
    if(p.iss!=='videoagentvault'||p.scope!==scope||!Number.isSafeInteger(p.exp)||p.exp<=ts||!Number.isSafeInteger(p.iat)||p.iat>ts+30||p.exp-p.iat>86400)fail(401,'EXPIRED_OR_INVALID_TOKEN');
    return p;
  }catch(e){if(e.code==='SIGNING_NOT_CONFIGURED')throw e;fail(401,'EXPIRED_OR_INVALID_TOKEN');}
}
export async function verifyWebhook(raw,header,secret,{timeKey='time',sigKey='sig1',tolerance=300}={}){
  if(!secret||!header)return false;
  const pairs=header.split(',').map(x=>x.trim().split('=')); const time=Number(pairs.find(([k])=>k===timeKey)?.[1]);
  if(!Number.isInteger(time)||Math.abs(now()/1000-time)>tolerance)return false;
  const signatures=pairs.filter(([k])=>k===sigKey).map(x=>x[1]);
  for(const s of signatures){if(!/^[0-9a-f]{64}$/i.test(s||''))continue;const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);const bytes=Uint8Array.from(s.match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,bytes,enc.encode(`${time}.${raw}`)))return true;}
  return false;
}
const jwksCache=new Map();
/** Verify Access's RS256 signature, issuer, audience and expiry; never trust a forwarded email header. */
export async function verifyAccess(token,env,fetcher=fetch){
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'')||!env.ACCESS_AUD)fail(503,'ACCESS_NOT_CONFIGURED');
  try{
    const [h,b,s,...rest]=(token||'').split('.');if(rest.length||!s)fail(401,'ACCESS_JWT_REQUIRED');
    const header=JSON.parse(utf8.decode(unb64url(h)));if(header.alg!=='RS256'||typeof header.kid!=='string')fail(401,'INVALID_ACCESS_JWT');
    const issuer=`https://${env.ACCESS_TEAM_DOMAIN}`;
    let cached=jwksCache.get(issuer);
    if(!cached||cached.expires<now()||!cached.keys.some(k=>k.kid===header.kid)){
      const r=await fetcher(`${issuer}/cdn-cgi/access/certs`);if(!r.ok)fail(503,'ACCESS_KEYS_UNAVAILABLE');
      const value=await r.json();if(!Array.isArray(value.keys))fail(503,'ACCESS_KEYS_UNAVAILABLE');cached={keys:value.keys,expires:now()+300000};jwksCache.set(issuer,cached);
    }
    const jwk=cached.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)fail(401,'INVALID_ACCESS_KEY');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64url(s),enc.encode(`${h}.${b}`)))fail(401,'INVALID_ACCESS_SIGNATURE');
    const p=JSON.parse(utf8.decode(unb64url(b))), ts=Math.floor(now()/1000);
    if(p.iss!==issuer||!Array.isArray(p.aud)||!p.aud.includes(env.ACCESS_AUD)||!Number.isFinite(p.exp)||p.exp<=ts||p.nbf>ts+30||typeof p.email!=='string')fail(401,'INVALID_ACCESS_CLAIMS');
    return p;
  }catch(e){if(e.status===503)throw e;fail(401,'INVALID_ACCESS_JWT');}
}
async function aesKey(secret){if(!secret||secret.length<32)fail(503,'ENCRYPTION_NOT_CONFIGURED');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(secret),enc.encode(value));return b64url(iv)+'.'+b64url(data);}
export async function unseal(value,secret){const [i,d]=value.split('.');return utf8.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64url(i)},await aesKey(secret),unb64url(d)));}
