-- Fresh single-workspace schema. Contains no installation data.
PRAGMA foreign_keys=ON;
CREATE TABLE tenants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 quota_bytes INTEGER NOT NULL DEFAULT 107374182400 CHECK(quota_bytes>=0),
 allocated_bytes INTEGER NOT NULL DEFAULT 0 CHECK(allocated_bytes>=0),
 credit_micros INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
, provider_policy_json TEXT NOT NULL DEFAULT '{"allowStream":false,"defaultProfile":"balanced","maxJobMicros":100000000}', agent_security_version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE members (tenant_id TEXT NOT NULL REFERENCES tenants(id),email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','editor','viewer')),created_at INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,email));
CREATE INDEX members_email ON members(email);
CREATE TABLE sessions(id TEXT PRIMARY KEY,email TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE api_keys(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),token_hash TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL,scopes_json TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER, agent_id TEXT REFERENCES agents(id));
CREATE INDEX api_keys_tenant ON api_keys(tenant_id,created_at);
CREATE TABLE folders(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),parent_id TEXT REFERENCES folders(id),name TEXT NOT NULL,created_at INTEGER NOT NULL, shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)), revision INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX folders_name ON folders(tenant_id,COALESCE(parent_id,''),name COLLATE NOCASE);
CREATE INDEX folders_parent ON folders(tenant_id,parent_id);
CREATE TABLE tags(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,color TEXT NOT NULL DEFAULT 'neutral',UNIQUE(tenant_id,name));
CREATE TABLE videos (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),folder_id TEXT REFERENCES folders(id),
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',tags_json TEXT NOT NULL DEFAULT '[]',
 kind TEXT NOT NULL DEFAULT 'mp4' CHECK(kind IN ('mp4','hls','audio','image','webm','mov')),
 status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','ready','processing','deleting','deleted','failed')),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public','unlisted')),
 allowed_origins_json TEXT NOT NULL DEFAULT '[]',watermark_text TEXT NOT NULL DEFAULT '',
 max_sessions INTEGER NOT NULL DEFAULT 3 CHECK(max_sessions BETWEEN 1 AND 20),
 primary_path TEXT NOT NULL DEFAULT 'source.mp4',source_path TEXT NOT NULL DEFAULT 'source.mp4',
 thumbnail_path TEXT,caption_path TEXT,summary TEXT NOT NULL DEFAULT '',index_status TEXT NOT NULL DEFAULT 'none',
 expected_bytes INTEGER NOT NULL DEFAULT 0,duration_seconds REAL NOT NULL DEFAULT 0,width INTEGER NOT NULL DEFAULT 0,height INTEGER NOT NULL DEFAULT 0,
 token_version INTEGER NOT NULL DEFAULT 1,encrypted INTEGER NOT NULL DEFAULT 0,upload_id TEXT,upload_key TEXT,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,uploaded_at INTEGER,deleted_at INTEGER,last_error TEXT
, probe_json TEXT, preview_path TEXT, sprite_path TEXT, downloads_enabled INTEGER NOT NULL DEFAULT 0 CHECK(downloads_enabled IN (0,1)), preview_meta_json TEXT, revision INTEGER NOT NULL DEFAULT 1, agent_id TEXT REFERENCES agents(id));
CREATE INDEX videos_tenant_created ON videos(tenant_id,created_at DESC,id);
CREATE INDEX videos_tenant_folder ON videos(tenant_id,folder_id,status);
CREATE INDEX videos_status_updated ON videos(status,updated_at);
CREATE TABLE video_tags(video_id TEXT NOT NULL REFERENCES videos(id),tag_id TEXT NOT NULL REFERENCES tags(id),PRIMARY KEY(video_id,tag_id));
CREATE INDEX video_tags_tag ON video_tags(tag_id,video_id);
CREATE TABLE objects (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),path TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,size INTEGER NOT NULL CHECK(size>=0),etag TEXT,content_type TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'source' CHECK(role IN ('source','playback','caption','thumbnail','analysis','generated')),
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','ready','deleted')),
 created_at INTEGER NOT NULL,stored_at INTEGER,deleted_at INTEGER, agent_id TEXT REFERENCES agents(id), content_hash TEXT,UNIQUE(video_id,path)
);
CREATE INDEX objects_tenant_time ON objects(tenant_id,stored_at,deleted_at);
CREATE INDEX objects_video ON objects(video_id,status);
CREATE TRIGGER objects_quota_insert BEFORE INSERT ON objects WHEN NEW.status!='deleted' BEGIN
 SELECT (CASE WHEN (SELECT allocated_bytes+NEW.size>quota_bytes FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'STORAGE_QUOTA_EXCEEDED') END); END;
CREATE TRIGGER objects_quota_update BEFORE UPDATE OF size,status ON objects WHEN NEW.status!='deleted' BEGIN
 SELECT (CASE WHEN (SELECT allocated_bytes+NEW.size-(CASE WHEN OLD.status='deleted' THEN 0 ELSE OLD.size END)>quota_bytes FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'STORAGE_QUOTA_EXCEEDED') END); END;
CREATE TRIGGER objects_allocate AFTER INSERT ON objects WHEN NEW.status!='deleted' BEGIN UPDATE tenants SET allocated_bytes=allocated_bytes+NEW.size WHERE id=NEW.tenant_id; END;
CREATE TRIGGER objects_reallocate AFTER UPDATE OF size,status ON objects BEGIN UPDATE tenants SET allocated_bytes=allocated_bytes+(CASE WHEN NEW.status='deleted' THEN 0 ELSE NEW.size END)-(CASE WHEN OLD.status='deleted' THEN 0 ELSE OLD.size END) WHERE id=NEW.tenant_id; END;
CREATE TABLE upload_parts(video_id TEXT NOT NULL REFERENCES videos(id),part_number INTEGER NOT NULL,etag TEXT NOT NULL,sha256 TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL,retired_at INTEGER,PRIMARY KEY(video_id,part_number));
CREATE TABLE jobs (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),kind TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,next_run_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,finished_at INTEGER,
 stream_uid TEXT,stream_created_at INTEGER,stream_deleted_at INTEGER,provider_duration_seconds REAL NOT NULL DEFAULT 0,export_attempts INTEGER NOT NULL DEFAULT 0,
 hold_micros INTEGER NOT NULL DEFAULT 0,max_wall_seconds INTEGER NOT NULL DEFAULT 900,keep_source INTEGER NOT NULL DEFAULT 1,
 last_error TEXT,payload_json TEXT NOT NULL DEFAULT '{}',result_json TEXT,request_key TEXT NOT NULL, request_hash TEXT, agent_id TEXT REFERENCES agents(id), key_id TEXT REFERENCES api_keys(id), run_id TEXT, progress_json TEXT, reuse_fingerprint TEXT,
 UNIQUE(tenant_id,request_key)
);
CREATE INDEX jobs_due ON jobs(state,next_run_at,lease_until);
CREATE INDEX jobs_tenant_created ON jobs(tenant_id,created_at DESC);
CREATE UNIQUE INDEX one_active_job ON jobs(video_id) WHERE finished_at IS NULL;
CREATE TABLE job_events(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),tenant_id TEXT NOT NULL,state TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX job_events_job ON job_events(job_id,created_at);
CREATE TABLE wallet_ledger(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),delta_micros INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('topup','reserve','release','charge','refund')),reference TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX wallet_reference ON wallet_ledger(tenant_id,kind,reference);
CREATE INDEX wallet_tenant_created ON wallet_ledger(tenant_id,created_at DESC);
CREATE TRIGGER wallet_reserve_guard BEFORE INSERT ON wallet_ledger WHEN NEW.kind='reserve' BEGIN
 SELECT (CASE WHEN NEW.delta_micros>=0 OR (SELECT credit_micros+NEW.delta_micros<0 FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'INSUFFICIENT_CREDITS') END); END;
CREATE TRIGGER wallet_apply AFTER INSERT ON wallet_ledger BEGIN UPDATE tenants SET credit_micros=credit_micros+NEW.delta_micros WHERE id=NEW.tenant_id; END;
CREATE TRIGGER wallet_immutable_update BEFORE UPDATE ON wallet_ledger BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LEDGER'); END;
CREATE TRIGGER wallet_immutable_delete BEFORE DELETE ON wallet_ledger BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LEDGER'); END;
CREATE TABLE meter_receipts(id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE meter_daily(day TEXT NOT NULL,tenant_id TEXT NOT NULL,metric TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 0,PRIMARY KEY(day,tenant_id,metric));
CREATE TABLE request_traces(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,category TEXT NOT NULL,status INTEGER NOT NULL,counters_json TEXT NOT NULL,cpu_ms REAL,measurement_source TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX traces_tenant_created ON request_traces(tenant_id,created_at DESC);
CREATE TABLE cost_events(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,job_id TEXT,metric TEXT NOT NULL,quantity REAL NOT NULL,unit_usd REAL NOT NULL,quality TEXT NOT NULL,provider_request_id TEXT,created_at INTEGER NOT NULL);
CREATE INDEX cost_events_tenant_date ON cost_events(tenant_id,created_at);
CREATE TABLE play_sessions(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),
 viewer_hash TEXT NOT NULL,issuer_session_id TEXT,issuer_key_id TEXT,country TEXT NOT NULL DEFAULT 'XX',device TEXT NOT NULL DEFAULT 'desktop',created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,started_at INTEGER,
 last_server_at INTEGER NOT NULL,seq INTEGER NOT NULL DEFAULT 0,watch_seconds REAL NOT NULL DEFAULT 0,buffer_seconds REAL NOT NULL DEFAULT 0,
 startup_ms REAL NOT NULL DEFAULT 0,max_position REAL NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0,revoked_at INTEGER, share_id TEXT REFERENCES share_links(id));
CREATE INDEX play_sessions_tenant_date ON play_sessions(tenant_id,created_at);
CREATE INDEX play_sessions_video_date ON play_sessions(video_id,created_at);
CREATE INDEX play_sessions_concurrency ON play_sessions(video_id,viewer_hash,expires_at,last_server_at);
CREATE TABLE share_links(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,revoked_at INTEGER,created_at INTEGER NOT NULL, inputs_json TEXT NOT NULL DEFAULT '[]', video_revision INTEGER);
CREATE TABLE artifacts(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),job_id TEXT,
 layer TEXT NOT NULL,start_seconds REAL NOT NULL,end_seconds REAL NOT NULL,text TEXT NOT NULL,data_json TEXT NOT NULL DEFAULT '{}',vector_id TEXT,created_at INTEGER NOT NULL);
CREATE INDEX artifacts_video_time ON artifacts(tenant_id,video_id,layer,start_seconds);
CREATE VIRTUAL TABLE artifacts_fts USING fts5(text,content='artifacts',content_rowid='rowid');
CREATE TRIGGER artifacts_ai AFTER INSERT ON artifacts BEGIN INSERT INTO artifacts_fts(rowid,text) VALUES(new.rowid,new.text); END;
CREATE TRIGGER artifacts_ad AFTER DELETE ON artifacts BEGIN INSERT INTO artifacts_fts(artifacts_fts,rowid,text) VALUES('delete',old.rowid,old.text); END;
CREATE TRIGGER artifacts_au AFTER UPDATE OF text ON artifacts BEGIN INSERT INTO artifacts_fts(artifacts_fts,rowid,text) VALUES('delete',old.rowid,old.text); INSERT INTO artifacts_fts(rowid,text) VALUES(new.rowid,new.text); END;
CREATE TABLE timelines(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,spec_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1, agent_id TEXT REFERENCES agents(id));
CREATE TABLE detector_rules(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,query TEXT NOT NULL,match_mode TEXT NOT NULL DEFAULT 'keyword',threshold REAL NOT NULL DEFAULT 0.65,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
CREATE TABLE detections(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),rule_id TEXT NOT NULL REFERENCES detector_rules(id),artifact_id TEXT NOT NULL REFERENCES artifacts(id),video_id TEXT NOT NULL REFERENCES videos(id),score REAL NOT NULL,created_at INTEGER NOT NULL,UNIQUE(rule_id,artifact_id));
CREATE TABLE webhooks(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),url TEXT NOT NULL,secret_ciphertext TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL, topics_json TEXT NOT NULL DEFAULT '["video.detection"]');
CREATE TABLE webhook_deliveries(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,webhook_id TEXT NOT NULL REFERENCES webhooks(id),event_id TEXT NOT NULL,payload_json TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,next_run_at INTEGER NOT NULL,last_status INTEGER,created_at INTEGER NOT NULL,UNIQUE(webhook_id,event_id));
CREATE INDEX webhook_due ON webhook_deliveries(state,next_run_at);
CREATE TABLE sources(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),folder_id TEXT REFERENCES folders(id),name TEXT NOT NULL,url_ciphertext TEXT NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE audit_log(id TEXT PRIMARY KEY,tenant_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,resource_id TEXT NOT NULL,detail_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX audit_tenant_created ON audit_log(tenant_id,created_at DESC);
CREATE TABLE payment_events(id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE video_usage_daily(day TEXT NOT NULL,tenant_id TEXT NOT NULL,video_id TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 0,bytes_offered INTEGER NOT NULL DEFAULT 0,cache_hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,tenant_id,video_id));
CREATE TRIGGER folder_no_cycle BEFORE UPDATE OF parent_id ON folders WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT (CASE WHEN NEW.parent_id=NEW.id OR EXISTS(WITH RECURSIVE a(id,parent_id) AS(SELECT id,parent_id FROM folders WHERE id=NEW.parent_id UNION ALL SELECT f.id,f.parent_id FROM folders f JOIN a ON f.id=a.parent_id) SELECT 1 FROM a WHERE id=NEW.id) THEN RAISE(ABORT,'FOLDER_CYCLE') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM folders WHERE id=NEW.parent_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'FOLDER_TENANT_MISMATCH') END);
END;
CREATE TRIGGER folder_parent_tenant BEFORE INSERT ON folders WHEN NEW.parent_id IS NOT NULL BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM folders WHERE id=NEW.parent_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'FOLDER_TENANT_MISMATCH') END); END;
CREATE TABLE job_uploads(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),object_id TEXT NOT NULL REFERENCES objects(id),multipart_id TEXT NOT NULL,size INTEGER NOT NULL,parts_json TEXT NOT NULL DEFAULT '[]',created_at INTEGER NOT NULL,completed_at INTEGER,UNIQUE(job_id,object_id));
CREATE TABLE job_upload_parts(upload_id TEXT NOT NULL REFERENCES job_uploads(id),part_number INTEGER NOT NULL,etag TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL, sha256 TEXT,PRIMARY KEY(upload_id,part_number));
CREATE INDEX meter_receipts_expiry ON meter_receipts(created_at);
CREATE INDEX traces_expiry ON request_traces(created_at);
CREATE INDEX playback_expiry ON play_sessions(created_at);
CREATE TABLE media_tracks (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), video_id TEXT NOT NULL REFERENCES videos(id),
 kind TEXT NOT NULL CHECK(kind IN ('captions','audio')), language TEXT NOT NULL, label TEXT NOT NULL,
 is_default INTEGER NOT NULL DEFAULT 0, path TEXT, source_video_id TEXT REFERENCES videos(id),
 cues_json TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','deleted')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
, revision INTEGER NOT NULL DEFAULT 1);
CREATE INDEX tracks_video ON media_tracks(video_id,kind,status);
CREATE UNIQUE INDEX tracks_default ON media_tracks(video_id,kind) WHERE is_default=1 AND status='active';
CREATE TABLE media_exports (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), video_id TEXT NOT NULL REFERENCES videos(id),
 job_id TEXT NOT NULL REFERENCES jobs(id), path TEXT NOT NULL, format TEXT NOT NULL, created_at INTEGER NOT NULL,
 revoked_at INTEGER, UNIQUE(job_id,path)
);
CREATE TABLE download_grants (
 id TEXT PRIMARY KEY, export_id TEXT NOT NULL REFERENCES media_exports(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 issuer_session_id TEXT, issuer_key_id TEXT, expires_at INTEGER NOT NULL, revoked_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX downloads_expiry ON download_grants(expires_at);
CREATE TABLE media_aliases (
 video_id TEXT NOT NULL REFERENCES videos(id), path TEXT NOT NULL, source_object_id TEXT NOT NULL REFERENCES objects(id),
 tenant_id TEXT NOT NULL REFERENCES tenants(id), PRIMARY KEY(video_id,path)
);
CREATE INDEX aliases_source ON media_aliases(source_object_id);
CREATE TABLE video_dependencies (
 video_id TEXT NOT NULL REFERENCES videos(id), source_video_id TEXT NOT NULL REFERENCES videos(id),
 PRIMARY KEY(video_id,source_video_id), CHECK(video_id!=source_video_id)
);
CREATE INDEX dependencies_source ON video_dependencies(source_video_id);
CREATE TRIGGER dependency_source_guard BEFORE INSERT ON video_dependencies BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM videos a JOIN videos b ON a.tenant_id=b.tenant_id WHERE a.id=NEW.video_id AND b.id=NEW.source_video_id AND b.status='ready') THEN RAISE(ABORT,'DEPENDENCY_NOT_READY_OR_TENANT_MISMATCH') END);
END;
CREATE TRIGGER protect_dependent_source BEFORE UPDATE OF status ON videos WHEN NEW.status IN ('deleting','deleted') BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM video_dependencies d JOIN videos v ON v.id=d.video_id WHERE d.source_video_id=NEW.id AND v.status NOT IN ('deleting','deleted','failed')) THEN RAISE(ABORT,'VIDEO_HAS_DEPENDENT_CLIPS') END);
END;
CREATE TRIGGER alias_tenant_guard BEFORE INSERT ON media_aliases BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM objects o JOIN videos v ON v.id=NEW.video_id WHERE o.id=NEW.source_object_id AND o.tenant_id=NEW.tenant_id AND v.tenant_id=NEW.tenant_id AND o.status='ready') THEN RAISE(ABORT,'ALIAS_TENANT_MISMATCH') END);
END;
CREATE TABLE processing_plans (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), video_id TEXT REFERENCES videos(id),
 source_updated_at INTEGER, spec_json TEXT NOT NULL, quote_json TEXT NOT NULL, reason TEXT NOT NULL,
 provider TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX plans_expiry ON processing_plans(expires_at);
CREATE TABLE live_inputs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, provider_uid TEXT UNIQUE,
 state TEXT NOT NULL DEFAULT 'provisioning', visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public','unlisted')),
 allowed_origins_json TEXT NOT NULL DEFAULT '[]', recording INTEGER NOT NULL DEFAULT 1, dvr INTEGER NOT NULL DEFAULT 1,
 credentials_ciphertext TEXT, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, budget_micros INTEGER NOT NULL,
 stop_at INTEGER NOT NULL, max_viewer_hours REAL NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER,
 last_error TEXT, UNIQUE(tenant_id,request_key)
);
CREATE INDEX live_tenant ON live_inputs(tenant_id,created_at);
CREATE TABLE live_outputs (
 id TEXT PRIMARY KEY, live_id TEXT NOT NULL REFERENCES live_inputs(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 provider_uid TEXT, label TEXT NOT NULL, state TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, config_ciphertext TEXT,
 created_at INTEGER NOT NULL, UNIQUE(live_id,request_key)
);
CREATE TABLE live_recordings (
 provider_uid TEXT PRIMARY KEY, live_id TEXT NOT NULL REFERENCES live_inputs(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 duration_seconds REAL NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 deleted_at INTEGER, local_video_id TEXT REFERENCES videos(id), import_job_id TEXT REFERENCES jobs(id)
);
CREATE TABLE live_usage (
 live_id TEXT NOT NULL REFERENCES live_inputs(id), tenant_id TEXT NOT NULL REFERENCES tenants(id), day TEXT NOT NULL,
 delivered_minutes REAL NOT NULL, evidence_json TEXT NOT NULL, observed_at INTEGER NOT NULL,
 PRIMARY KEY(live_id,day)
);
CREATE TABLE live_sessions (
 id TEXT PRIMARY KEY, live_id TEXT NOT NULL REFERENCES live_inputs(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 issuer_session_id TEXT, issuer_key_id TEXT, viewer_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX live_sessions_limit ON live_sessions(live_id,viewer_hash,created_at);
CREATE UNIQUE INDEX active_recording_import ON jobs(json_extract(payload_json,'$.recordingId')) WHERE kind='stream_import' AND finished_at IS NULL;
CREATE TABLE live_sync_state(live_id TEXT PRIMARY KEY REFERENCES live_inputs(id),next_at INTEGER NOT NULL DEFAULT 0,last_ok INTEGER,last_error TEXT);
CREATE TABLE agents (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,purpose TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),legacy INTEGER NOT NULL DEFAULT 0,
 permissions_json TEXT NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,last_active_at INTEGER,
 operation_micros INTEGER NOT NULL DEFAULT 0 CHECK(operation_micros>=0),run_micros INTEGER NOT NULL DEFAULT 0 CHECK(run_micros>=0),
 daily_micros INTEGER NOT NULL DEFAULT 0 CHECK(daily_micros>=0),monthly_micros INTEGER NOT NULL DEFAULT 0 CHECK(monthly_micros>=0),
 concurrent_jobs INTEGER NOT NULL DEFAULT 0 CHECK(concurrent_jobs>=0),retained_bytes INTEGER NOT NULL DEFAULT 0 CHECK(retained_bytes>=0),
 upload_bytes_daily INTEGER NOT NULL DEFAULT 0 CHECK(upload_bytes_daily>=0),UNIQUE(tenant_id,name)
);
CREATE TABLE agent_grants (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),agent_id TEXT NOT NULL REFERENCES agents(id),
 resource_type TEXT NOT NULL CHECK(resource_type IN ('folder','video','live')),resource_id TEXT NOT NULL,
 access TEXT NOT NULL CHECK(access IN ('read','write')),inherit INTEGER NOT NULL DEFAULT 0 CHECK(inherit IN (0,1)),
 UNIQUE(agent_id,resource_type,resource_id)
);
CREATE INDEX grants_resource ON agent_grants(tenant_id,resource_type,resource_id);
CREATE VIEW agent_folder_access AS WITH RECURSIVE granted(agent_id,tenant_id,folder_id,access,inherit) AS (
 SELECT g.agent_id,g.tenant_id,f.id,g.access,g.inherit FROM agent_grants g JOIN folders f ON f.id=g.resource_id AND f.tenant_id=g.tenant_id WHERE g.resource_type='folder'
 UNION SELECT g.agent_id,g.tenant_id,f.id,g.access,g.inherit FROM granted g JOIN folders f ON f.parent_id=g.folder_id AND f.tenant_id=g.tenant_id WHERE g.inherit=1
) SELECT DISTINCT agent_id,tenant_id,folder_id,access FROM granted;
CREATE VIEW agent_video_access AS
 SELECT g.agent_id,v.tenant_id,v.id video_id,g.access FROM agent_grants g JOIN videos v ON g.resource_id=v.id AND g.tenant_id=v.tenant_id WHERE g.resource_type='video'
 UNION SELECT g.agent_id,v.tenant_id,v.id,g.access FROM agent_folder_access g JOIN videos v ON v.folder_id=g.folder_id AND v.tenant_id=g.tenant_id;
CREATE TABLE agent_runs (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),agent_id TEXT NOT NULL REFERENCES agents(id),external_id TEXT NOT NULL,
 objective TEXT NOT NULL,output_folder_id TEXT NOT NULL REFERENCES folders(id),inputs_json TEXT NOT NULL,ceiling_micros INTEGER NOT NULL CHECK(ceiling_micros>=0),
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','completed','cancelled')),revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
 UNIQUE(agent_id,external_id)
);
CREATE TABLE agent_reservations (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id),agent_id TEXT NOT NULL REFERENCES agents(id),tenant_id TEXT NOT NULL REFERENCES tenants(id),run_id TEXT REFERENCES agent_runs(id),
 amount_micros INTEGER NOT NULL CHECK(amount_micros>=0),charged_micros INTEGER CHECK(charged_micros>=0 AND charged_micros<=amount_micros),
 day TEXT NOT NULL,month TEXT NOT NULL,created_at INTEGER NOT NULL,settled_at INTEGER
);
CREATE INDEX reservations_agent_period ON agent_reservations(agent_id,month,day);
CREATE TRIGGER agent_reserve_guard BEFORE INSERT ON agent_reservations BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM agents a WHERE a.id=NEW.agent_id AND a.tenant_id=NEW.tenant_id AND a.status='active' AND a.legacy=0
 AND NEW.amount_micros<=a.operation_micros
 AND (SELECT COUNT(*) FROM agent_reservations r WHERE r.agent_id=a.id AND r.settled_at IS NULL)<a.concurrent_jobs
 AND NEW.amount_micros+COALESCE((SELECT SUM(COALESCE(charged_micros,amount_micros)) FROM agent_reservations WHERE agent_id=a.id AND day=NEW.day),0)<=a.daily_micros
 AND NEW.amount_micros+COALESCE((SELECT SUM(COALESCE(charged_micros,amount_micros)) FROM agent_reservations WHERE agent_id=a.id AND month=NEW.month),0)<=a.monthly_micros
 ) THEN RAISE(ABORT,'AGENT_BUDGET_EXCEEDED') END);
 SELECT (CASE WHEN NEW.run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM agent_runs r JOIN agents a ON a.id=r.agent_id WHERE r.id=NEW.run_id AND r.agent_id=NEW.agent_id AND r.tenant_id=NEW.tenant_id AND r.state='open'
 AND NEW.amount_micros+COALESCE((SELECT SUM(COALESCE(charged_micros,amount_micros)) FROM agent_reservations WHERE run_id=r.id),0)<=MIN(r.ceiling_micros,a.run_micros)) THEN RAISE(ABORT,'RUN_BUDGET_EXCEEDED') END);
END;
CREATE TRIGGER agent_reservation_immutable BEFORE UPDATE ON agent_reservations WHEN OLD.settled_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AGENT_RECEIPT'); END;
CREATE TRIGGER agent_object_quota BEFORE INSERT ON objects WHEN NEW.agent_id IS NOT NULL AND NEW.status!='deleted' BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM agents a WHERE a.id=NEW.agent_id AND a.tenant_id=NEW.tenant_id AND a.status='active'
 AND NEW.size+COALESCE((SELECT SUM(size) FROM objects WHERE agent_id=a.id AND status!='deleted'),0)<=a.retained_bytes
 AND NEW.size+COALESCE((SELECT SUM(size) FROM objects WHERE agent_id=a.id AND strftime('%Y-%m-%d',created_at/1000,'unixepoch')=strftime('%Y-%m-%d',NEW.created_at/1000,'unixepoch')),0)<=a.upload_bytes_daily)
 THEN RAISE(ABORT,'AGENT_STORAGE_QUOTA_EXCEEDED') END);
END;
CREATE TABLE agent_approvals (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),agent_id TEXT NOT NULL REFERENCES agents(id),video_id TEXT NOT NULL REFERENCES videos(id),
 action TEXT NOT NULL CHECK(action IN ('publish','share','delete')),revision INTEGER NOT NULL,payload_json TEXT NOT NULL,payload_hash TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','consumed')),expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,decided_by TEXT,decided_at INTEGER,consumed_at INTEGER
, inputs_json TEXT NOT NULL DEFAULT '[]');
CREATE INDEX approvals_inbox ON agent_approvals(tenant_id,state,created_at);
CREATE TABLE work_claims (
 tenant_id TEXT NOT NULL REFERENCES tenants(id),video_id TEXT NOT NULL REFERENCES videos(id),task TEXT NOT NULL,
 agent_id TEXT NOT NULL REFERENCES agents(id),fence INTEGER NOT NULL,lease_until INTEGER NOT NULL,PRIMARY KEY(video_id,task)
);
CREATE TABLE agent_artifacts (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),agent_id TEXT NOT NULL REFERENCES agents(id),key_id TEXT NOT NULL REFERENCES api_keys(id),
 run_id TEXT NOT NULL REFERENCES agent_runs(id),kind TEXT NOT NULL CHECK(kind IN ('finding','transcript','edit_draft')),
 request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,data_json TEXT NOT NULL,inputs_json TEXT NOT NULL,created_at INTEGER NOT NULL,
 UNIQUE(agent_id,request_key)
);
CREATE TABLE security_assertions(id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1));
CREATE TRIGGER dependency_no_cycle BEFORE INSERT ON video_dependencies BEGIN
 SELECT (CASE WHEN EXISTS(WITH RECURSIVE deps(id) AS (SELECT source_video_id FROM video_dependencies WHERE video_id=NEW.source_video_id UNION SELECT d.source_video_id FROM video_dependencies d JOIN deps ON d.video_id=deps.id) SELECT 1 FROM deps WHERE id=NEW.video_id) THEN RAISE(ABORT,'DEPENDENCY_CYCLE') END);
END;
CREATE TRIGGER agent_reservation_no_delete BEFORE DELETE ON agent_reservations BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AGENT_RECEIPT'); END;
CREATE TRIGGER agent_artifact_no_update BEFORE UPDATE ON agent_artifacts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AGENT_ARTIFACT'); END;
CREATE TRIGGER agent_artifact_no_delete BEFORE DELETE ON agent_artifacts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AGENT_ARTIFACT'); END;
CREATE TABLE resource_approvals (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),agent_id TEXT NOT NULL REFERENCES agents(id),
 resource_type TEXT NOT NULL CHECK(resource_type IN ('folder','timeline','track')),resource_id TEXT NOT NULL,snapshot_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','consumed')),expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,
 decided_by TEXT,decided_at INTEGER,consumed_at INTEGER
);
CREATE INDEX resource_approvals_inbox ON resource_approvals(tenant_id,state,created_at);
CREATE TABLE ops_alerts (
 id TEXT PRIMARY KEY, code TEXT NOT NULL, count INTEGER NOT NULL,
 created_at INTEGER NOT NULL, sent_at INTEGER, message_id TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ops_alerts_pending ON ops_alerts(sent_at,lease_until);
CREATE TABLE ops_dead_letters (
 id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 resolved_at INTEGER
);
CREATE TABLE source_versions (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), video_id TEXT NOT NULL REFERENCES videos(id),
 object_id TEXT NOT NULL REFERENCES objects(id), fingerprint TEXT, fingerprint_method TEXT NOT NULL,
 source_revision INTEGER NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, duration_seconds REAL NOT NULL,
 created_at INTEGER NOT NULL, UNIQUE(video_id,object_id)
);
CREATE TABLE artifact_manifests (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), video_id TEXT NOT NULL REFERENCES videos(id),
 source_version_id TEXT REFERENCES source_versions(id), artifact_id TEXT UNIQUE REFERENCES artifacts(id) ON DELETE CASCADE, job_id TEXT,
 origin TEXT NOT NULL, kind TEXT NOT NULL, start_seconds REAL NOT NULL, end_seconds REAL NOT NULL,
 language TEXT NOT NULL DEFAULT 'en', method_json TEXT NOT NULL, coverage_json TEXT NOT NULL,
 payload_json TEXT NOT NULL, payload_sha256 TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX evidence_tenant_time ON artifact_manifests(tenant_id,video_id,kind,start_seconds,id);
CREATE TABLE job_source_versions (
 job_id TEXT NOT NULL REFERENCES jobs(id), source_version_id TEXT NOT NULL REFERENCES source_versions(id),
 PRIMARY KEY(job_id,source_version_id)
);
CREATE TRIGGER source_versions_immutable_update BEFORE UPDATE ON source_versions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SOURCE_VERSION'); END;
CREATE TRIGGER source_versions_immutable_delete BEFORE DELETE ON source_versions BEGIN SELECT RAISE(ABORT,'IMMUTABLE_SOURCE_VERSION'); END;
CREATE TRIGGER artifact_manifests_immutable_update BEFORE UPDATE ON artifact_manifests BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARTIFACT_MANIFEST'); END;
CREATE TRIGGER artifact_manifests_immutable_delete BEFORE DELETE ON artifact_manifests WHEN NOT EXISTS(SELECT 1 FROM videos WHERE id=OLD.video_id AND status='deleting') BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARTIFACT_MANIFEST'); END;
CREATE TABLE media_recipes (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,version INTEGER NOT NULL,
 created_by TEXT NOT NULL,agent_id TEXT,inputs_json TEXT NOT NULL,variants_json TEXT NOT NULL,
 payload_hash TEXT NOT NULL,request_key TEXT NOT NULL,created_at INTEGER NOT NULL,
 UNIQUE(tenant_id,request_key),UNIQUE(tenant_id,name,version)
);
CREATE TABLE media_batches (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),recipe_id TEXT NOT NULL REFERENCES media_recipes(id),
 agent_id TEXT,key_id TEXT,session_id TEXT,actor_email TEXT NOT NULL,request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,lease_token TEXT,budget_micros INTEGER NOT NULL,spent_micros INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'queued',
 lease_until INTEGER NOT NULL DEFAULT 0,deadline_at INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,last_error TEXT,
 UNIQUE(tenant_id,request_key)
);
CREATE TABLE media_batch_items (
 batch_id TEXT NOT NULL REFERENCES media_batches(id),ordinal INTEGER NOT NULL,spec_json TEXT NOT NULL,
 dispatch_json TEXT,job_id TEXT REFERENCES jobs(id),state TEXT NOT NULL DEFAULT 'queued',charge_micros INTEGER NOT NULL DEFAULT 0,
 reused INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(batch_id,ordinal)
);
CREATE INDEX media_batches_due ON media_batches(state,lease_until);
CREATE TABLE processing_reuse (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,job_id TEXT NOT NULL REFERENCES jobs(id),created_at INTEGER NOT NULL,
 UNIQUE(tenant_id,actor_id,request_key)
);
CREATE INDEX jobs_reuse ON jobs(tenant_id,agent_id,reuse_fingerprint,state);
CREATE TRIGGER recipe_immutable_update BEFORE UPDATE ON media_recipes BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RECIPE'); END;
CREATE TRIGGER recipe_immutable_delete BEFORE DELETE ON media_recipes BEGIN SELECT RAISE(ABORT,'IMMUTABLE_RECIPE'); END;
CREATE TABLE processing_effects (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,job_id TEXT NOT NULL REFERENCES jobs(id),
 input_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('started','completed')),
 output_json TEXT,created_at INTEGER NOT NULL,completed_at INTEGER
);
CREATE INDEX processing_effects_job ON processing_effects(job_id,state);
CREATE TABLE index_unit_cache (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,video_id TEXT NOT NULL REFERENCES videos(id),source_version_id TEXT NOT NULL REFERENCES source_versions(id),
 producer_job_id TEXT NOT NULL REFERENCES jobs(id),artifact_ids_json TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE index_unit_receipts (
 job_id TEXT NOT NULL REFERENCES jobs(id),unit_index INTEGER NOT NULL,cache_id TEXT NOT NULL REFERENCES index_unit_cache(id),
 reused INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(job_id,unit_index)
);
CREATE TABLE job_event_sequence (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL UNIQUE REFERENCES job_events(id) ON DELETE CASCADE
);
CREATE TRIGGER job_event_sequence_insert AFTER INSERT ON job_events BEGIN
 INSERT INTO job_event_sequence(event_id) VALUES(NEW.id);
END;
CREATE TRIGGER single_workspace_guard BEFORE INSERT ON tenants WHEN EXISTS(SELECT 1 FROM tenants) BEGIN SELECT RAISE(ABORT,'SINGLE_WORKSPACE_ONLY'); END;
