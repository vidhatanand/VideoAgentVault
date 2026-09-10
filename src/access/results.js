import {agentOnly,videoAccess} from './policy.js';
/** Answers can quote several resources. Withhold the whole answer if any citation is no longer readable. */
export async function visibleJob(c,j){if(!agentOnly(c))return j;const result=JSON.parse(j.result_json||'null');for(const row of [...(result?.citations||[]),...(result?.items||[])])if(row.video_id)await videoAccess(c,{id:row.video_id});return j;}
