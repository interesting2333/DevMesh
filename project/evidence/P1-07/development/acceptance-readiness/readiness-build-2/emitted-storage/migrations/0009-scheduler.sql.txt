CREATE TABLE scheduler_project_turns (
  project_id TEXT PRIMARY KEY REFERENCES projects(project_id),
  turn INTEGER NOT NULL UNIQUE CHECK(turn>0)
) STRICT;

CREATE TABLE scheduler_run_budget (
  run_id TEXT PRIMARY KEY REFERENCES runs(run_id),
  maximum_attempts INTEGER NOT NULL CHECK(maximum_attempts BETWEEN 1 AND 200),
  maximum_reserved_ms INTEGER NOT NULL CHECK(maximum_reserved_ms>0),
  admitted_attempts INTEGER NOT NULL DEFAULT 0 CHECK(admitted_attempts BETWEEN 0 AND maximum_attempts),
  reserved_ms INTEGER NOT NULL DEFAULT 0 CHECK(reserved_ms BETWEEN 0 AND maximum_reserved_ms)
) STRICT;

CREATE TABLE scheduler_run_roles (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  role TEXT NOT NULL,
  policy_hash TEXT NOT NULL CHECK(length(policy_hash)=64),
  PRIMARY KEY(run_id,role)
) STRICT;

CREATE TABLE scheduled_work (
  attempt_id TEXT PRIMARY KEY REFERENCES attempts(attempt_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  plan_revision INTEGER NOT NULL,
  runner_id TEXT NOT NULL,
  reservation_key TEXT NOT NULL UNIQUE,
  caller_id TEXT NOT NULL,
  FOREIGN KEY(run_id,plan_revision) REFERENCES plan_revisions(run_id,revision)
) STRICT;
CREATE INDEX scheduled_work_runner ON scheduled_work(runner_id);

CREATE TABLE verified_work_results (
  attempt_id TEXT PRIMARY KEY REFERENCES attempts(attempt_id),
  outcome TEXT NOT NULL CHECK(outcome IN ('success','completed-with-findings')),
  evidence_artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
  outputs_json TEXT NOT NULL CHECK(json_valid(outputs_json)),
  code_commit TEXT CHECK(code_commit IS NULL OR length(code_commit)=40),
  recorded_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER verified_work_results_immutable BEFORE UPDATE ON verified_work_results
BEGIN SELECT RAISE(ABORT,'VERIFICATION_IMMUTABLE'); END;
CREATE TRIGGER verified_work_results_retained BEFORE DELETE ON verified_work_results
BEGIN SELECT RAISE(ABORT,'VERIFICATION_IMMUTABLE'); END;

CREATE TABLE scheduled_dispatch_delivery (
  attempt_id TEXT PRIMARY KEY REFERENCES scheduled_work(attempt_id),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  outbox_id TEXT NOT NULL UNIQUE REFERENCES outbox(outbox_id),
  state TEXT NOT NULL CHECK(state IN ('SENT','ACKED','RECONCILE','NOT_SENT')),
  endpoint_id TEXT NOT NULL,
  task_id TEXT,
  sent_at TEXT,
  checked_at TEXT NOT NULL,
  CHECK((state='ACKED')=(task_id IS NOT NULL)),
  CHECK((state='NOT_SENT')=(sent_at IS NULL)),
  FOREIGN KEY(endpoint_id,task_id) REFERENCES a2a_tasks(endpoint_id,task_id)
) STRICT;
