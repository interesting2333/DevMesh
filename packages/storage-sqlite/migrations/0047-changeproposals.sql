CREATE TABLE change_proposals (
  change_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  source_message_id TEXT NOT NULL,
  proposed_text TEXT NOT NULL CHECK(length(proposed_text) BETWEEN 1 AND 40000),
  state TEXT NOT NULL CHECK(state IN ('PROPOSED','CONFIRMED','REJECTED')),
  basis_hash TEXT NOT NULL CHECK(length(basis_hash)=64),
  decision_operation_id TEXT REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(run_id,source_message_id)
) STRICT;

CREATE INDEX change_proposals_run ON change_proposals(run_id,created_at,change_id);
