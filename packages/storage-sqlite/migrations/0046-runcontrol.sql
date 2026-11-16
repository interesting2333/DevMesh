ALTER TABLE runs ADD COLUMN recovery_review_hash TEXT CHECK(recovery_review_hash IS NULL OR length(recovery_review_hash)=64);

CREATE TABLE run_control_targets (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  target_kind TEXT NOT NULL CHECK(target_kind IN ('ATTEMPT','PREPARATION','PREVIEW','JOB','WORKSPACE')),
  target_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING','STOPPING','SAVED','RELEASED','UNKNOWN','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  failure_code TEXT,
  evidence_json TEXT CHECK(evidence_json IS NULL OR json_valid(evidence_json)),
  last_checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(run_id,target_kind,target_id)
) STRICT;

CREATE INDEX run_control_targets_pending ON run_control_targets(run_id,state);
