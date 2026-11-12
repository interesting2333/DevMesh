CREATE TABLE candidate_integrations (
  operation_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES managed_repositories(project_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  principal_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('work-input','run-candidate')),
  work_id TEXT,
  request_hash TEXT NOT NULL,
  basis_sha256 TEXT NOT NULL,
  basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
  expected_head_json TEXT CHECK(expected_head_json IS NULL OR json_valid(expected_head_json)),
  state TEXT NOT NULL CHECK(state IN ('BUILDING','PREPARED','CAS_SENT','ACKNOWLEDGED','CONFLICT_PENDING','CONFLICT','FAILED')),
  manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
  acknowledgement_json TEXT CHECK(acknowledgement_json IS NULL OR json_valid(acknowledgement_json)),
  failure_json TEXT CHECK(failure_json IS NULL OR json_valid(failure_json)),
  error_code TEXT,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  FOREIGN KEY(run_id,work_id) REFERENCES works(run_id,work_id),
  CHECK((purpose='work-input')=(work_id IS NOT NULL)),
  CHECK(state NOT IN ('PREPARED','CAS_SENT','ACKNOWLEDGED') OR manifest_json IS NOT NULL),
  CHECK((state IN ('ACKNOWLEDGED','CONFLICT'))=(acknowledgement_json IS NOT NULL AND acknowledged_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX candidate_project_unsettled ON candidate_integrations(project_id)
  WHERE state IN ('BUILDING','PREPARED','CAS_SENT','CONFLICT_PENDING');
CREATE INDEX candidate_qualified_snapshot ON candidate_integrations(run_id,basis_sha256,state);

CREATE TABLE candidate_integration_sources (
  operation_id TEXT NOT NULL REFERENCES candidate_integrations(operation_id),
  ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<30),
  archive_operation_id TEXT NOT NULL REFERENCES source_archives(operation_id),
  PRIMARY KEY(operation_id,ordinal),
  UNIQUE(operation_id,archive_operation_id)
) STRICT;
CREATE TRIGGER candidate_source_binding BEFORE INSERT ON candidate_integration_sources
WHEN NOT EXISTS (
  SELECT 1 FROM candidate_integrations i JOIN source_archives a ON a.operation_id=NEW.archive_operation_id
  WHERE i.operation_id=NEW.operation_id AND i.state='BUILDING' AND a.state='ACKNOWLEDGED'
    AND a.project_id=i.project_id AND a.run_id=i.run_id
    AND json_extract(i.basis_json,'$.sources['||NEW.ordinal||'].archiveOperationId')=NEW.archive_operation_id
)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_SOURCE_UNPROVEN'); END;
CREATE TRIGGER candidate_source_update BEFORE UPDATE ON candidate_integration_sources
BEGIN SELECT RAISE(ABORT,'CANDIDATE_SOURCE_IMMUTABLE'); END;
CREATE TRIGGER candidate_source_delete BEFORE DELETE ON candidate_integration_sources
BEGIN SELECT RAISE(ABORT,'CANDIDATE_SOURCE_IMMUTABLE'); END;

CREATE TABLE candidate_integration_steps (
  operation_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  ours TEXT NOT NULL,
  theirs TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('COMPUTING','PREPARED','REF_SENT','ACKNOWLEDGED','CONFLICT_PENDING','CONFLICT','ABANDONED')),
  preparation_json TEXT CHECK(preparation_json IS NULL OR json_valid(preparation_json)),
  acknowledgement_json TEXT CHECK(acknowledgement_json IS NULL OR json_valid(acknowledgement_json)),
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  PRIMARY KEY(operation_id,ordinal),
  FOREIGN KEY(operation_id,ordinal) REFERENCES candidate_integration_sources(operation_id,ordinal),
  CHECK(state IN ('COMPUTING','ABANDONED') OR preparation_json IS NOT NULL),
  CHECK((state IN ('ACKNOWLEDGED','CONFLICT'))=(acknowledgement_json IS NOT NULL AND acknowledged_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX candidate_step_unsettled ON candidate_integration_steps(operation_id)
  WHERE state IN ('COMPUTING','PREPARED','REF_SENT','CONFLICT_PENDING');
CREATE TRIGGER candidate_step_immutable BEFORE UPDATE ON candidate_integration_steps
WHEN NEW.operation_id<>OLD.operation_id OR NEW.ordinal<>OLD.ordinal OR NEW.ours<>OLD.ours OR NEW.theirs<>OLD.theirs
  OR NEW.created_at<>OLD.created_at
  OR (OLD.preparation_json IS NOT NULL AND NEW.preparation_json IS NOT OLD.preparation_json)
  OR (OLD.acknowledgement_json IS NOT NULL AND NEW.acknowledgement_json IS NOT OLD.acknowledgement_json)
  OR (OLD.state IN ('ACKNOWLEDGED','CONFLICT','ABANDONED') AND (NEW.state<>OLD.state OR NEW.acknowledged_at IS NOT OLD.acknowledged_at))
BEGIN SELECT RAISE(ABORT,'CANDIDATE_STEP_IMMUTABLE'); END;
CREATE TRIGGER candidate_step_delete BEFORE DELETE ON candidate_integration_steps
BEGIN SELECT RAISE(ABORT,'CANDIDATE_STEP_IMMUTABLE'); END;

CREATE TABLE managed_candidate_heads (
  run_id TEXT PRIMARY KEY REFERENCES runs(run_id),
  project_id TEXT NOT NULL REFERENCES managed_repositories(project_id),
  operation_id TEXT NOT NULL REFERENCES candidate_integrations(operation_id),
  commit_sha TEXT NOT NULL
) STRICT;
CREATE TRIGGER candidate_head_insert BEFORE INSERT ON managed_candidate_heads
WHEN NOT EXISTS (SELECT 1 FROM candidate_integrations i WHERE i.operation_id=NEW.operation_id
  AND i.run_id=NEW.run_id AND i.project_id=NEW.project_id AND i.purpose='run-candidate'
  AND i.state='ACKNOWLEDGED' AND json_extract(i.manifest_json,'$.commit')=NEW.commit_sha)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_HEAD_UNPROVEN'); END;
CREATE TRIGGER candidate_head_update BEFORE UPDATE ON managed_candidate_heads
WHEN NEW.run_id<>OLD.run_id OR NEW.project_id<>OLD.project_id OR NOT EXISTS (
  SELECT 1 FROM candidate_integrations i WHERE i.operation_id=NEW.operation_id
  AND i.run_id=NEW.run_id AND i.project_id=NEW.project_id AND i.purpose='run-candidate'
  AND i.state='ACKNOWLEDGED' AND json_extract(i.manifest_json,'$.commit')=NEW.commit_sha)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_HEAD_UNPROVEN'); END;

CREATE TRIGGER candidate_integration_immutable BEFORE UPDATE ON candidate_integrations
WHEN NEW.operation_id<>OLD.operation_id OR NEW.project_id<>OLD.project_id OR NEW.run_id<>OLD.run_id
  OR NEW.principal_id<>OLD.principal_id OR NEW.purpose<>OLD.purpose OR NEW.work_id IS NOT OLD.work_id
  OR NEW.request_hash<>OLD.request_hash OR NEW.basis_sha256<>OLD.basis_sha256 OR NEW.basis_json<>OLD.basis_json
  OR NEW.expected_head_json IS NOT OLD.expected_head_json OR NEW.created_at<>OLD.created_at
  OR (OLD.manifest_json IS NOT NULL AND NEW.manifest_json IS NOT OLD.manifest_json)
  OR (OLD.acknowledgement_json IS NOT NULL AND NEW.acknowledgement_json IS NOT OLD.acknowledgement_json)
  OR (OLD.failure_json IS NOT NULL AND NEW.failure_json IS NOT OLD.failure_json)
  OR (OLD.state IN ('ACKNOWLEDGED','CONFLICT','FAILED') AND (NEW.state<>OLD.state OR NEW.acknowledged_at IS NOT OLD.acknowledged_at OR NEW.error_code IS NOT OLD.error_code))
BEGIN SELECT RAISE(ABORT,'CANDIDATE_INTEGRATION_IMMUTABLE'); END;
CREATE TRIGGER candidate_integration_delete BEFORE DELETE ON candidate_integrations
BEGIN SELECT RAISE(ABORT,'CANDIDATE_INTEGRATION_IMMUTABLE'); END;
