import {inspect} from 'node:util';
export function print(value: unknown,flags: any){if(flags.jsonl)process.stdout.write(JSON.stringify({type:'result',data:value})+'\n');else if(flags.json||!process.stdout.isTTY)process.stdout.write(JSON.stringify(value,null,2)+'\n');else process.stdout.write(inspect(value,{colors:true,depth:8,compact:false})+'\n');}
