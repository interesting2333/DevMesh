CREATE TABLE run_redos (
  redo_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  project_id TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  new_run_id TEXT NOT NULL UNIQUE,
  review_hash TEXT NOT NULL CHECK(length(review_hash)=64),
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, source_run_id) REFERENCES runs(project_id, run_id),
  FOREIGN KEY (project_id, new_run_id) REFERENCES runs(project_id, run_id)
) STRICT;

CREATE INDEX run_redos_source ON run_redos(project_id, source_run_id);
