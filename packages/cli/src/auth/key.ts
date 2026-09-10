import fs from 'node:fs/promises';
import {CliError} from '../errors/index.js';
export async function readKey(file?: string){
 let value=process.env.VIDEOAGENTVAULT_API_KEY;
 if(file){const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||(process.platform!=='win32'&&(st.mode&0o077)))throw new CliError('SECRET_FILE_PERMISSIONS','Use a regular secret file readable only by its owner.',3);value=(await fs.readFile(file,'utf8')).trim();}
 if(!value||!/^er_[A-Za-z0-9_-]+$/.test(value))throw new CliError('API_KEY_REQUIRED','Set VIDEOAGENTVAULT_API_KEY or use --key-file. Literal key arguments are not accepted.',3);
 return value;
}
