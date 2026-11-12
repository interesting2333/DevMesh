CREATE TABLE repo_file_operations (
  operation_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  activation_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id),
  workspace_ref TEXT NOT NULL,
  tool_name TEXT NOT NULL CHECK(tool_name IN ('repo.writeFile','repo.deleteFile')),
  request_hash TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
  state TEXT NOT NULL CHECK(state IN ('SENT','PREPARED','SUCCEEDED','FAILED')),
  prepared_json TEXT CHECK(prepared_json IS NULL OR json_valid(prepared_json)),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  cleanup_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_confirmed IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(state<>'SUCCEEDED' OR prepared_json IS NOT NULL),
  CHECK(cleanup_confirmed=0 OR state IN ('SUCCEEDED','FAILED'))
) STRICT;
CREATE INDEX repo_file_workspace_pending ON repo_file_operations(workspace_ref,state,cleanup_confirmed);
CREATE TRIGGER repo_file_basis BEFORE UPDATE ON repo_file_operations
WHEN NEW.operation_id<>OLD.operation_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id
  OR NEW.activation_id<>OLD.activation_id OR NEW.grant_id<>OLD.grant_id OR NEW.workspace_ref<>OLD.workspace_ref
  OR NEW.tool_name<>OLD.tool_name OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json
  OR NEW.scope_json<>OLD.scope_json OR NEW.created_at<>OLD.created_at
  OR (OLD.prepared_json IS NOT NULL AND NEW.prepared_json IS NOT OLD.prepared_json)
  OR (OLD.result_json IS NOT NULL AND (NEW.result_json IS NOT OLD.result_json OR NEW.state<>OLD.state))
  OR NEW.cleanup_confirmed<OLD.cleanup_confirmed
BEGIN SELECT RAISE(ABORT,'REPO_FILE_OPERATION_IMMUTABLE'); END;
CREATE TRIGGER repo_file_history BEFORE DELETE ON repo_file_operations
BEGIN SELECT RAISE(ABORT,'REPO_FILE_HISTORY_IMMUTABLE'); END;
