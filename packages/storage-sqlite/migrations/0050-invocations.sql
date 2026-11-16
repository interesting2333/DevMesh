CREATE TABLE invocations (
  invocation_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  principal_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  endpoint_revision INTEGER NOT NULL CHECK(endpoint_revision>0),
  registry_generation_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ACCEPTED','WORKING','INPUT_REQUIRED','COMPLETED','FAILED','CANCELED')),
  input_manifest_hash TEXT NOT NULL CHECK(length(input_manifest_hash)=64),
  definition_snapshot_hash TEXT NOT NULL CHECK(length(definition_snapshot_hash)=64),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id,invocation_id)
) STRICT;

CREATE INDEX invocations_principal ON invocations(principal_id,project_id,created_at,invocation_id);
