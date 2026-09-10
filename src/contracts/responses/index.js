import {coreResponses} from './core.js';
import {libraryResponses} from './library.js';
import {object} from './types.js';
import {jobResponses} from './jobs.js';
import {agentResponses} from './agents.js';
import {productionResponses} from './production.js';
import {storageResponses} from './storage.js';
import {reportResponses} from './reports.js';
import {playbackResponses} from './playback.js';
export const RESPONSE_SCHEMAS=Object.freeze({...coreResponses,...libraryResponses,...jobResponses,...agentResponses,...productionResponses,...storageResponses,...reportResponses,...playbackResponses,processing_plan_get:jobResponses.processing_plan});
export function mcpOutputSchema(name){const schema=RESPONSE_SCHEMAS[name];return schema?.type==='array'?object({items:schema}):schema;}
