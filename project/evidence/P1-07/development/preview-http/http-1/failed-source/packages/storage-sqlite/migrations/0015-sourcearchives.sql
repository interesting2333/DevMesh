CREATE TABLE source_archives (
  operation_id TEXT PRIMARY KEY,
  allocation_operation_id TEXT NOT NULL REFERENCES workspace_allocations(operation_id),
  commit_operation_id TEXT NOT NULL REFERENCES repo_operations(operation_id),
  workspace_ref TEXT NOT NULL REFERENCES workspace_allocations(workspace_ref),
  project_id TEXT NOT NULL REFERENCES managed_repositories(project_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  activation_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id),
  request_hash TEXT NOT NULL,
  basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
  state TEXT NOT NULL CHECK(state IN ('SENT','PREPARED','ACKNOWLEDGED','FAILED')),
  manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
  acknowledgement_json TEXT CHECK(acknowledgement_json IS NULL OR json_valid(acknowledgement_json)),
  error_code TEXT,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  CHECK(state NOT IN ('PREPARED','ACKNOWLEDGED') OR manifest_json IS NOT NULL),
  CHECK((state='ACKNOWLEDGED')=(acknowledgement_json IS NOT NULL AND acknowledged_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX source_archive_unsettled ON source_archives(workspace_ref) WHERE state IN ('SENT','PREPARED');
CREATE TRIGGER source_archive_basis BEFORE UPDATE ON source_archives
WHEN NEW.operation_id<>OLD.operation_id OR NEW.allocation_operation_id<>OLD.allocation_operation_id
  OR NEW.commit_operation_id<>OLD.commit_operation_id OR NEW.workspace_ref<>OLD.workspace_ref
  OR NEW.project_id<>OLD.project_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id
  OR NEW.activation_id<>OLD.activation_id OR NEW.grant_id<>OLD.grant_id OR NEW.request_hash<>OLD.request_hash
  OR NEW.basis_json<>OLD.basis_json OR NEW.created_at<>OLD.created_at
  OR (OLD.manifest_json IS NOT NULL AND NEW.manifest_json IS NOT OLD.manifest_json)
  OR (OLD.state IN ('ACKNOWLEDGED','FAILED') AND (NEW.state<>OLD.state OR NEW.acknowledgement_json IS NOT OLD.acknowledgement_json OR NEW.acknowledged_at IS NOT OLD.acknowledged_at))
BEGIN SELECT RAISE(ABORT,'SOURCE_ARCHIVE_IMMUTABLE'); END;
