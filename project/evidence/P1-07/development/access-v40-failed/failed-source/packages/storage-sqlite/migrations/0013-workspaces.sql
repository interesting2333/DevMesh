CREATE TABLE managed_repositories (
  project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
  resource_id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  template_commit TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PREPARING','READY')),
  identity_json TEXT CHECK(identity_json IS NULL OR json_valid(identity_json)),
  manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(state<>'READY' OR (identity_json IS NOT NULL AND manifest_json IS NOT NULL))
) STRICT;
CREATE TRIGGER managed_repository_basis BEFORE UPDATE ON managed_repositories
WHEN NEW.project_id<>OLD.project_id OR NEW.resource_id<>OLD.resource_id OR NEW.operation_id<>OLD.operation_id
  OR NEW.request_hash<>OLD.request_hash OR NEW.template_commit<>OLD.template_commit OR NEW.created_at<>OLD.created_at
  OR (OLD.identity_json IS NOT NULL AND NEW.identity_json IS NOT OLD.identity_json)
  OR (OLD.manifest_json IS NOT NULL AND NEW.manifest_json IS NOT OLD.manifest_json)
BEGIN SELECT RAISE(ABORT,'MANAGED_REPOSITORY_IMMUTABLE'); END;

CREATE TABLE workspace_allocations (
  workspace_ref TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL REFERENCES managed_repositories(project_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
  activation_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id),
  runner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('development','verification')),
  base_commit TEXT NOT NULL,
  scope_json TEXT NOT NULL CHECK(json_valid(scope_json)),
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PREPARING','READY','RECONCILE','FAILED')),
  identity_json TEXT CHECK(identity_json IS NULL OR json_valid(identity_json)),
  manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(state<>'READY' OR (identity_json IS NOT NULL AND manifest_json IS NOT NULL))
) STRICT;
CREATE TRIGGER workspace_allocation_basis BEFORE UPDATE ON workspace_allocations
WHEN NEW.workspace_ref<>OLD.workspace_ref OR NEW.operation_id<>OLD.operation_id OR NEW.project_id<>OLD.project_id
  OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.activation_id<>OLD.activation_id
  OR NEW.grant_id<>OLD.grant_id OR NEW.runner_id<>OLD.runner_id OR NEW.kind<>OLD.kind
  OR NEW.base_commit<>OLD.base_commit OR NEW.scope_json<>OLD.scope_json OR NEW.request_hash<>OLD.request_hash
  OR NEW.created_at<>OLD.created_at
  OR (OLD.identity_json IS NOT NULL AND NEW.identity_json IS NOT OLD.identity_json)
  OR (OLD.manifest_json IS NOT NULL AND NEW.manifest_json IS NOT OLD.manifest_json)
BEGIN SELECT RAISE(ABORT,'WORKSPACE_ALLOCATION_IMMUTABLE'); END;
