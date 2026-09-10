import {fail} from '../util.js';
export function validate(schema,value,path='arguments'){
 const types=Array.isArray(schema.type)?schema.type:[schema.type];const type=value===null?'null':Array.isArray(value)?'array':typeof value;if(!types.includes(type)&&!(types.includes('integer')&&Number.isSafeInteger(value)))fail(400,'INVALID_TOOL_ARGUMENT',`${path}: wrong type.`);if(schema.enum&&!schema.enum.includes(value))fail(400,'INVALID_TOOL_ARGUMENT',`${path}: not an allowed value.`);
 if(type==='number'){if(!Number.isFinite(value)||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum))fail(400,'INVALID_TOOL_ARGUMENT',`${path}: out of bounds.`);}
 if(type==='object'){for(const k of schema.required||[])if(!Object.hasOwn(value,k))fail(400,'INVALID_TOOL_ARGUMENT',`${path}.${k} is required.`);for(const [k,v] of Object.entries(value)){if(!schema.properties?.[k]){if(schema.additionalProperties===false)fail(400,'UNKNOWN_TOOL_ARGUMENT',`${path}.${k}`);}else validate(schema.properties[k],v,`${path}.${k}`);}}
 if(type==='array'){if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??1000))fail(400,'INVALID_TOOL_ARGUMENT','Too many items.');for(let i=0;i<value.length;i++)validate(schema.items,value[i],`${path}[${i}]`);}
}
