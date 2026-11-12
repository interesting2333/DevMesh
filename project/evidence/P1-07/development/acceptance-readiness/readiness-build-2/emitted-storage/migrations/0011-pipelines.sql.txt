CREATE TABLE pipelines (
  pipeline_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  activation_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id),
  permit_json TEXT NOT NULL CHECK(json_valid(permit_json)),
  definition_id TEXT NOT NULL,
  definition_version TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
  workspace_ref TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','STOPPING','CANCELLED','OUTCOME_UNKNOWN')),
  stop_requested INTEGER NOT NULL DEFAULT 0 CHECK(stop_requested IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE pipeline_stages (
  pipeline_id TEXT NOT NULL REFERENCES pipelines(pipeline_id),
  ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 7),
  stage_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK(state IN ('PENDING','SENT','ACKED','EXITED','UNKNOWN','SKIPPED')),
  request_json TEXT CHECK(request_json IS NULL OR json_valid(request_json)),
  job_id TEXT,
  job_json TEXT CHECK(job_json IS NULL OR json_valid(job_json)),
  error_code TEXT,
  checked_at TEXT NOT NULL,
  PRIMARY KEY(pipeline_id,ordinal),
  UNIQUE(pipeline_id,stage_id)
) STRICT;
CREATE TRIGGER pipeline_frozen_basis BEFORE UPDATE ON pipelines
WHEN NEW.operation_id<>OLD.operation_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id
  OR NEW.activation_id<>OLD.activation_id OR NEW.grant_id<>OLD.grant_id OR NEW.permit_json<>OLD.permit_json
  OR NEW.definition_id<>OLD.definition_id OR NEW.definition_version<>OLD.definition_version
  OR NEW.definition_hash<>OLD.definition_hash OR NEW.definition_json<>OLD.definition_json
  OR NEW.workspace_ref<>OLD.workspace_ref OR NEW.request_hash<>OLD.request_hash
BEGIN SELECT RAISE(ABORT,'PIPELINE_BASIS_IMMUTABLE'); END;
CREATE TRIGGER pipeline_stage_identity BEFORE UPDATE ON pipeline_stages
WHEN NEW.operation_id<>OLD.operation_id OR NEW.stage_id<>OLD.stage_id OR NEW.ordinal<>OLD.ordinal
  OR NEW.pipeline_id<>OLD.pipeline_id OR (OLD.request_json IS NOT NULL AND NEW.request_json IS NOT OLD.request_json)
  OR (OLD.job_id IS NOT NULL AND NEW.job_id IS NOT OLD.job_id)
BEGIN SELECT RAISE(ABORT,'PIPELINE_STAGE_IDENTITY_IMMUTABLE'); END;
CREATE INDEX pipeline_pending ON pipeline_stages(state,checked_at,pipeline_id);
