CREATE TABLE issues (
  issue_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  run_id TEXT NOT NULL,
  source_attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  revision INTEGER NOT NULL CHECK(revision>0),
  state TEXT NOT NULL CHECK(state IN ('OPEN','FIX_LINKED','VERIFIED')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  evidence_artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  fix_work_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(run_id,issue_id),
  FOREIGN KEY(project_id,run_id) REFERENCES runs(project_id,run_id),
  FOREIGN KEY(run_id,fix_work_id) REFERENCES works(run_id,work_id)
) STRICT;
CREATE TABLE issue_operations (
  operation_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
  activation_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id),
  tool_name TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  issue_revision INTEGER NOT NULL CHECK(issue_revision>0),
  created_at TEXT NOT NULL,
  FOREIGN KEY(run_id,issue_id) REFERENCES issues(run_id,issue_id)
) STRICT;
CREATE TABLE issue_revisions (
  issue_id TEXT NOT NULL REFERENCES issues(issue_id),
  revision INTEGER NOT NULL CHECK(revision>0),
  operation_id TEXT NOT NULL UNIQUE REFERENCES issue_operations(operation_id),
  kind TEXT NOT NULL CHECK(kind IN ('CREATED','FIX_LINKED','VERIFICATION_RECORDED')),
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  evidence_artifact_id TEXT REFERENCES artifacts(artifact_id),
  fix_attempt_id TEXT REFERENCES attempts(attempt_id),
  verification_attempt_id TEXT REFERENCES attempts(attempt_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(issue_id,revision)
) STRICT;
CREATE TRIGGER immutable_issue_revision BEFORE UPDATE ON issue_revisions
BEGIN SELECT RAISE(ABORT,'ISSUE_REVISION_IMMUTABLE'); END;
CREATE TRIGGER preserve_issue_revision BEFORE DELETE ON issue_revisions
BEGIN SELECT RAISE(ABORT,'ISSUE_REVISION_IMMUTABLE'); END;
CREATE TRIGGER immutable_issue_operation BEFORE UPDATE ON issue_operations
BEGIN SELECT RAISE(ABORT,'ISSUE_OPERATION_IMMUTABLE'); END;
CREATE TRIGGER preserve_issue_operation BEFORE DELETE ON issue_operations
BEGIN SELECT RAISE(ABORT,'ISSUE_OPERATION_IMMUTABLE'); END;
CREATE INDEX issues_run ON issues(run_id,state,issue_id);
