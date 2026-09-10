import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {CliError} from '../errors/index.js';
export const configRoot=()=>process.env.VIDEOAGENTVAULT_CONFIG_DIR||path.join(os.homedir(),'.config','videoagentvault');
export async function atomicJSON(file: string,value: unknown){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+process.pid+'.tmp';await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});try{await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
export async function profiles(){try{return JSON.parse(await fs.readFile(path.join(configRoot(),'profiles.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw new CliError('CONFIG_INVALID','The profile file could not be read.');}}
export async function settings(flags: Record<string,any>){const all=await profiles(),name=flags.profile||'default',p=all[name]||{};return {endpoint:flags.endpoint||process.env.VIDEOAGENTVAULT_ORIGIN||p.endpoint||'',workspace:flags.workspace||process.env.VIDEOAGENTVAULT_WORKSPACE||p.workspace,folder:flags.folder||p.folder};}
export async function saveProfile(flags: Record<string,any>){const all=await profiles(),name=flags.profile||'default';if(!/^[\w-]{1,60}$/.test(name))throw new CliError('PROFILE_NAME','Use a short alphanumeric profile name.');all[name]=Object.fromEntries(['endpoint','workspace','folder'].filter(k=>flags[k]).map(k=>[k,flags[k]]));await atomicJSON(path.join(configRoot(),'profiles.json'),all);return {profile:name,...all[name]};}
