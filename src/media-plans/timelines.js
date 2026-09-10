import {tenantAuth} from '../auth.js';
import {requireVideo} from '../library.js';
import {fail,canonicalJSON} from '../util.js';
export async function timelineSnapshot(c,tid,id){
 await tenantAuth(c,tid,'timelines:write','editor');
 const row=await c.db.one('SELECT * FROM timelines WHERE id=? AND tenant_id=?',[id,tid]);if(!row)fail(404,'TIMELINE_NOT_FOUND');
 const spec=JSON.parse(row.spec_json);for(const clip of spec.clips)await requireVideo(c,clip.videoId);
 return {timelineId:row.id,expectedTimelineRevision:row.revision,timelineSnapshot:spec};
}
export async function validateTimelines(c,tid,variants){
 for(const variant of variants){if(variant.kind!=='render')continue;const snapshot=await timelineSnapshot(c,tid,variant.timelineId);
  if(snapshot.expectedTimelineRevision!==variant.expectedTimelineRevision||canonicalJSON(snapshot.timelineSnapshot)!==canonicalJSON(variant.timelineSnapshot))fail(409,'RECIPE_TIMELINE_CHANGED','Create a new recipe version after reviewing the edited timeline.');
 }
}
