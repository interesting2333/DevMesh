CREATE TABLE preview_backend_policies (
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 policy_hash TEXT NOT NULL,
 policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),
 registered_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,policy_hash)
) STRICT;
CREATE TABLE datasets (
 dataset_id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 policy_hash TEXT NOT NULL,
 source_dataset_id TEXT,
 source_release_id TEXT,
 storage_key TEXT NOT NULL UNIQUE,
 schema_revision TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PREPARING','READY','WRITE_FROZEN','RETIRED','MISSING')),
 revision INTEGER NOT NULL CHECK(revision>0),
 snapshot_at TEXT,
 retention_until TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(project_id,dataset_id),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,policy_hash) REFERENCES preview_backend_policies(project_id,policy_hash),
 FOREIGN KEY(project_id,source_dataset_id) REFERENCES datasets(project_id,dataset_id),
 FOREIGN KEY(project_id,source_release_id) REFERENCES releases(project_id,release_id),
 CHECK((source_dataset_id IS NULL)=(source_release_id IS NULL))
) STRICT;
CREATE TABLE previews (
 preview_id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 dataset_id TEXT NOT NULL UNIQUE,
 policy_hash TEXT NOT NULL,
 image_digest TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('STARTING','READY','STOPPING','STOPPED','EXPIRED','UNKNOWN')),
 revision INTEGER NOT NULL CHECK(revision>0),
 instance_id TEXT,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(project_id,preview_id),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,dataset_id) REFERENCES datasets(project_id,dataset_id),
 FOREIGN KEY(project_id,policy_hash) REFERENCES preview_backend_policies(project_id,policy_hash)
) STRICT;
CREATE TABLE preview_effects (
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL,
 dataset_id TEXT NOT NULL,
 preview_id TEXT,
 policy_hash TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('DATASET_PREPARE','PREVIEW_START','PREVIEW_STOP')),
 remote_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','SENT','UNKNOWN','SUCCEEDED','FAILED')),
 revision INTEGER NOT NULL CHECK(revision>0),
 receipt_json TEXT CHECK(receipt_json IS NULL OR json_valid(receipt_json)),
 error_code TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(kind,remote_key),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,dataset_id) REFERENCES datasets(project_id,dataset_id),
 FOREIGN KEY(project_id,preview_id) REFERENCES previews(project_id,preview_id),
 FOREIGN KEY(project_id,policy_hash) REFERENCES preview_backend_policies(project_id,policy_hash),
 CHECK((kind='DATASET_PREPARE')=(preview_id IS NULL))
) STRICT;
CREATE TABLE preview_effect_observations (
 operation_id TEXT NOT NULL REFERENCES preview_effects(operation_id),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 observation_json TEXT NOT NULL CHECK(json_valid(observation_json)),
 observed_at TEXT NOT NULL,
 PRIMARY KEY(operation_id,sequence)
) STRICT;
CREATE INDEX datasets_run ON datasets(run_id,dataset_id);
CREATE INDEX previews_run ON previews(run_id,preview_id);
CREATE INDEX preview_effects_recovery ON preview_effects(state,operation_id);
CREATE TRIGGER preview_policy_update BEFORE UPDATE ON preview_backend_policies
BEGIN SELECT RAISE(ABORT,'PREVIEW_POLICY_IMMUTABLE'); END;
CREATE TRIGGER preview_policy_delete BEFORE DELETE ON preview_backend_policies
BEGIN SELECT RAISE(ABORT,'PREVIEW_POLICY_IMMUTABLE'); END;
CREATE TRIGGER dataset_identity_update BEFORE UPDATE ON datasets WHEN
 NEW.dataset_id IS NOT OLD.dataset_id OR NEW.project_id IS NOT OLD.project_id OR NEW.run_id IS NOT OLD.run_id OR
 NEW.candidate_id IS NOT OLD.candidate_id OR NEW.operation_id IS NOT OLD.operation_id OR NEW.policy_hash IS NOT OLD.policy_hash OR
 NEW.source_dataset_id IS NOT OLD.source_dataset_id OR NEW.source_release_id IS NOT OLD.source_release_id OR
 NEW.storage_key IS NOT OLD.storage_key OR NEW.schema_revision IS NOT OLD.schema_revision OR
 NEW.retention_until IS NOT OLD.retention_until OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'DATASET_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER dataset_delete BEFORE DELETE ON datasets
BEGIN SELECT RAISE(ABORT,'DATASET_RETAINED'); END;
CREATE TRIGGER preview_identity_update BEFORE UPDATE ON previews WHEN
 NEW.preview_id IS NOT OLD.preview_id OR NEW.project_id IS NOT OLD.project_id OR NEW.run_id IS NOT OLD.run_id OR
 NEW.candidate_id IS NOT OLD.candidate_id OR NEW.operation_id IS NOT OLD.operation_id OR NEW.policy_hash IS NOT OLD.policy_hash OR
 NEW.dataset_id IS NOT OLD.dataset_id OR NEW.image_digest IS NOT OLD.image_digest OR NEW.expires_at IS NOT OLD.expires_at OR
 NEW.created_at IS NOT OLD.created_at OR OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id
BEGIN SELECT RAISE(ABORT,'PREVIEW_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER preview_delete BEFORE DELETE ON previews
BEGIN SELECT RAISE(ABORT,'PREVIEW_RETAINED'); END;
CREATE TRIGGER preview_effect_identity_update BEFORE UPDATE ON preview_effects WHEN
 NEW.operation_id IS NOT OLD.operation_id OR NEW.project_id IS NOT OLD.project_id OR NEW.run_id IS NOT OLD.run_id OR
 NEW.candidate_id IS NOT OLD.candidate_id OR NEW.dataset_id IS NOT OLD.dataset_id OR NEW.preview_id IS NOT OLD.preview_id OR
 NEW.policy_hash IS NOT OLD.policy_hash OR NEW.kind IS NOT OLD.kind OR NEW.remote_key IS NOT OLD.remote_key OR
 NEW.request_hash IS NOT OLD.request_hash OR NEW.request_json IS NOT OLD.request_json OR NEW.created_at IS NOT OLD.created_at OR
 OLD.state IN ('SUCCEEDED','FAILED')
BEGIN SELECT RAISE(ABORT,'PREVIEW_EFFECT_IMMUTABLE'); END;
CREATE TRIGGER preview_effect_delete BEFORE DELETE ON preview_effects
BEGIN SELECT RAISE(ABORT,'PREVIEW_EFFECT_RETAINED'); END;
CREATE TRIGGER preview_observation_update BEFORE UPDATE ON preview_effect_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_OBSERVATION_IMMUTABLE'); END;
CREATE TRIGGER preview_observation_delete BEFORE DELETE ON preview_effect_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_OBSERVATION_IMMUTABLE'); END;
