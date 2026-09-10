import {hash,canonicalJSON} from '../util.js';
export async function bytesHash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function partFingerprint(parts,size){
 if(!parts.length||parts.reduce((n,p)=>n+p.size,0)!==size||parts.some((p,i)=>p.part_number!==i+1||!/^[a-f0-9]{64}$/.test(p.sha256||'')))return null;
 return hash(canonicalJSON(parts.map(p=>({part:p.part_number,size:p.size,sha256:p.sha256}))));
}
