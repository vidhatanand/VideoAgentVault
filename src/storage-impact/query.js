/** Aggregates stay scoped to visible videos; restricted dependency titles never leave SQL. */
export function inventoryQuery(filter,extra=''){
 return `WITH inventory AS (
 SELECT v.id,v.title,v.revision,v.kind,v.status,v.visibility,v.created_at,v.folder_id,
 COALESCE((SELECT SUM(size) FROM objects WHERE video_id=v.id AND status='ready'),0) bytes,
 COALESCE((SELECT SUM(size) FROM objects WHERE video_id=v.id AND status='ready' AND role='source'),0) source_bytes,
 (SELECT COUNT(*) FROM objects WHERE video_id=v.id AND status='ready') files,
 (SELECT COUNT(*) FROM play_sessions WHERE video_id=v.id AND created_at>=?) plays,
 COALESCE((SELECT SUM(watch_seconds) FROM play_sessions WHERE video_id=v.id AND created_at>=?),0) watch_seconds,
 (SELECT MAX(last_server_at) FROM play_sessions WHERE video_id=v.id AND created_at>=?) last_play,
 COALESCE((SELECT SUM(requests) FROM video_usage_daily WHERE video_id=v.id AND day>=?),0) requests,
 (SELECT MAX(day) FROM video_usage_daily WHERE video_id=v.id AND day>=? AND requests>0) last_media_day,
 (SELECT COUNT(*) FROM jobs WHERE video_id=v.id AND agent_id IS NOT NULL AND created_at>=?) agent_jobs,
 (SELECT MAX(created_at) FROM jobs WHERE video_id=v.id AND agent_id IS NOT NULL AND created_at>=?) last_agent_job,
 (SELECT COUNT(*) FROM jobs WHERE video_id=v.id AND finished_at IS NULL) active_jobs,
 (SELECT COUNT(*) FROM work_claims WHERE video_id=v.id AND lease_until>?) active_claims,
 (SELECT COUNT(*) FROM video_dependencies d JOIN videos child ON child.id=d.video_id WHERE d.source_video_id=v.id AND child.status NOT IN ('deleted','failed')) dependents,
 (SELECT COUNT(DISTINCT t.id) FROM timelines t,json_each(json_extract(t.spec_json,'$.clips')) x WHERE t.tenant_id=v.tenant_id AND json_extract(x.value,'$.videoId')=v.id) timelines,
 (SELECT COUNT(*) FROM agent_runs r,json_each(r.inputs_json) x WHERE r.tenant_id=v.tenant_id AND r.state='open' AND json_extract(x.value,'$.videoId')=v.id) open_runs,
 (SELECT COUNT(*) FROM share_links WHERE video_id=v.id AND revoked_at IS NULL AND expires_at>?) shares
 FROM videos v WHERE v.tenant_id=? AND v.status!='deleted' AND ${filter} ${extra}
 ), usage AS (
 SELECT *,MAX(COALESCE(last_play,0),COALESCE(last_agent_job,0),COALESCE(CAST(strftime('%s',last_media_day) AS INTEGER)*1000,0)) last_used FROM inventory
 ), ranked AS (
 SELECT *,CASE WHEN status!='ready' OR visibility!='private' OR active_jobs+active_claims+dependents+timelines+open_runs+shares>0 THEN NULL ELSE
 ROUND(40.0*MIN(1.0,bytes/10000000000.0)+30.0*MIN(1.0,MAX(0,?-MAX(created_at,last_used))/7776000000.0)+20.0/(1+plays+agent_jobs+requests/100.0)+CASE WHEN bytes>0 THEN 10.0*(bytes-source_bytes)/bytes ELSE 0 END) END priority
 FROM usage)
 `;
}
