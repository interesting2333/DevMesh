-- Formal DB-B migration 2. Derived from D5 core relationships; independent runtime source.
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  accepted_release_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, accepted_release_id)
    REFERENCES releases(project_id, release_id) DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE user_tasks (
  task_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  kind TEXT NOT NULL CHECK (kind IN ('NEW','ITERATION','FIX')),
  base_commit TEXT NOT NULL,
  request_artifact_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, task_id),
  FOREIGN KEY (project_id, request_artifact_id) REFERENCES artifacts(project_id,artifact_id) DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  origin_run_id TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('PREPARING','UNDERSTANDING','PLANNING','EXECUTING','VERIFYING','REVIEW')),
  control_gate TEXT NOT NULL DEFAULT 'OPEN' CHECK (control_gate IN ('OPEN','PAUSING','PAUSED','CANCELLING')),
  terminal_outcome TEXT CHECK (terminal_outcome IN ('COMPLETED','FAILED','CANCELLED')),
  run_epoch INTEGER NOT NULL DEFAULT 1 CHECK (run_epoch > 0),
  control_revision INTEGER NOT NULL DEFAULT 1 CHECK (control_revision > 0),
  resource_revision INTEGER NOT NULL DEFAULT 1 CHECK (resource_revision > 0),
  current_requirement_revision INTEGER,
  current_plan_revision INTEGER,
  event_seq INTEGER NOT NULL DEFAULT 0 CHECK (event_seq >= 0),
  created_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE (project_id, run_id),
  UNIQUE (project_id, task_id, run_id),
  CHECK ((terminal_outcome IS NULL AND ended_at IS NULL) OR (terminal_outcome IS NOT NULL AND ended_at IS NOT NULL)),
  CHECK (origin_run_id IS NULL OR origin_run_id <> run_id),
  FOREIGN KEY (project_id, task_id) REFERENCES user_tasks(project_id, task_id),
  FOREIGN KEY (project_id, task_id, origin_run_id) REFERENCES runs(project_id, task_id, run_id),
  FOREIGN KEY (run_id, current_requirement_revision) REFERENCES requirement_revisions(run_id, revision) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (run_id, current_plan_revision) REFERENCES plan_revisions(run_id, revision) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE UNIQUE INDEX one_active_run_per_project ON runs(project_id) WHERE terminal_outcome IS NULL;

CREATE TABLE requirement_revisions (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, revision)
) STRICT;

CREATE TABLE plan_revisions (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  requirement_revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (run_id, revision),
  FOREIGN KEY (run_id, requirement_revision) REFERENCES requirement_revisions(run_id, revision)
) STRICT;

CREATE TABLE works (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  work_id TEXT NOT NULL,
  work_epoch INTEGER NOT NULL DEFAULT 1 CHECK (work_epoch > 0),
  blocked_reason TEXT,
  PRIMARY KEY (run_id, work_id)
) STRICT;

CREATE TABLE work_revisions (
  run_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  role TEXT NOT NULL CHECK (role IN ('product','architect','developer','tester')),
  definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
  definition_hash TEXT NOT NULL,
  PRIMARY KEY (run_id, work_id, revision),
  UNIQUE (run_id, work_id, revision, role),
  FOREIGN KEY (run_id, work_id) REFERENCES works(run_id, work_id)
) STRICT;

CREATE TABLE plan_works (
  run_id TEXT NOT NULL,
  plan_revision INTEGER NOT NULL,
  work_id TEXT NOT NULL,
  work_revision INTEGER NOT NULL,
  PRIMARY KEY (run_id, plan_revision, work_id),
  FOREIGN KEY (run_id, plan_revision) REFERENCES plan_revisions(run_id, revision),
  FOREIGN KEY (run_id, work_id, work_revision) REFERENCES work_revisions(run_id, work_id, revision)
) STRICT;

CREATE TABLE plan_edges (
  run_id TEXT NOT NULL,
  plan_revision INTEGER NOT NULL,
  predecessor TEXT NOT NULL,
  successor TEXT NOT NULL,
  required_outcome TEXT NOT NULL CHECK (required_outcome IN ('success','completed-with-findings')),
  CHECK (predecessor <> successor),
  PRIMARY KEY (run_id, plan_revision, predecessor, successor),
  FOREIGN KEY (run_id, plan_revision, predecessor) REFERENCES plan_works(run_id, plan_revision, work_id),
  FOREIGN KEY (run_id, plan_revision, successor) REFERENCES plan_works(run_id, plan_revision, work_id)
) STRICT;

CREATE TABLE operations (
  operation_id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED','RUNNING','WAITING','SUCCEEDED','FAILED','OUTCOME_UNKNOWN')),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (principal_id, scope_id, idempotency_key)
) STRICT;

CREATE TABLE attempts (
  attempt_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  work_revision INTEGER NOT NULL,
  role TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  state TEXT NOT NULL CHECK (state IN ('RESERVED','SUBMITTED','WORKING','INPUT_REQUIRED','VERIFYING','OUTCOME_UNKNOWN','STOPPING','SUCCEEDED','FAILED','INTERRUPTED','CANCELLED')),
  admitted_run_epoch INTEGER NOT NULL CHECK (admitted_run_epoch > 0),
  admitted_work_epoch INTEGER NOT NULL CHECK (admitted_work_epoch > 0),
  input_manifest_json TEXT NOT NULL CHECK (json_valid(input_manifest_json)),
  input_fingerprint TEXT NOT NULL,
  role_snapshot_json TEXT NOT NULL CHECK (json_valid(role_snapshot_json)),
  dispatch_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE (run_id, attempt_id),
  UNIQUE (run_id, attempt_id, role),
  UNIQUE (run_id, work_id, attempt_no),
  CHECK ((state IN ('SUCCEEDED','FAILED','INTERRUPTED','CANCELLED') AND ended_at IS NOT NULL)
      OR (state NOT IN ('SUCCEEDED','FAILED','INTERRUPTED','CANCELLED') AND ended_at IS NULL)),
  FOREIGN KEY (run_id, work_id, work_revision, role) REFERENCES work_revisions(run_id, work_id, revision, role)
) STRICT;
CREATE UNIQUE INDEX one_unended_attempt_per_work ON attempts(run_id, work_id) WHERE ended_at IS NULL;

CREATE TABLE role_slots (
  run_id TEXT NOT NULL,
  role TEXT NOT NULL,
  attempt_id TEXT NOT NULL UNIQUE,
  activation_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY (run_id, role),
  FOREIGN KEY (run_id, attempt_id, role) REFERENCES attempts(run_id, attempt_id, role)
) STRICT;

CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  project_id TEXT NOT NULL,
  work_id TEXT,
  attempt_id TEXT,
  seq INTEGER NOT NULL CHECK (seq > 0),
  operation_id TEXT REFERENCES operations(operation_id),
  type TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  occurred_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  time_source TEXT NOT NULL CHECK (time_source IN ('producer','observed')),
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  requirement_revision INTEGER,
  plan_revision INTEGER,
  UNIQUE (run_id, seq),
  FOREIGN KEY (project_id,run_id) REFERENCES runs(project_id,run_id),
  FOREIGN KEY (run_id,work_id) REFERENCES works(run_id,work_id),
  FOREIGN KEY (run_id,attempt_id) REFERENCES attempts(run_id,attempt_id),
  FOREIGN KEY (run_id, requirement_revision) REFERENCES requirement_revisions(run_id, revision),
  FOREIGN KEY (run_id, plan_revision) REFERENCES plan_revisions(run_id, revision)
) STRICT;

CREATE TABLE outbox (
  outbox_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(operation_id),
  message_no INTEGER NOT NULL CHECK (message_no >= 0),
  destination TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  status TEXT NOT NULL CHECK (status IN ('PENDING','LEASED','ACKED','RECONCILE','FAILED')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  lease_owner TEXT,
  lease_until TEXT,
  next_attempt_at TEXT NOT NULL,
  UNIQUE (operation_id, message_no)
) STRICT;
CREATE INDEX outbox_due ON outbox(status, next_attempt_at);

CREATE TABLE a2a_tasks (
  endpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  protocol_state TEXT NOT NULL CHECK (protocol_state IN ('submitted','working','input-required','auth-required','completed','failed','canceled','rejected')),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (endpoint_id, task_id),
  FOREIGN KEY (run_id, attempt_id) REFERENCES attempts(run_id, attempt_id)
) STRICT;

CREATE TABLE delegation_inbox (
  caller_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (caller_id, operation_id),
  UNIQUE (endpoint_id, task_id),
  FOREIGN KEY (endpoint_id, task_id) REFERENCES a2a_tasks(endpoint_id, task_id)
) STRICT;

CREATE TABLE accepted_work (
  endpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING','ACTIVE','WAITING','FINISHED','RECONCILE')),
  activation_id TEXT,
  PRIMARY KEY (endpoint_id, task_id),
  FOREIGN KEY (endpoint_id, task_id) REFERENCES a2a_tasks(endpoint_id, task_id)
) STRICT;

CREATE TABLE tool_operations (
  operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
  run_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  effect_class TEXT NOT NULL CHECK (effect_class IN ('READ','IDEMPOTENT_WRITE','NONIDEMPOTENT_WRITE')),
  request_hash TEXT NOT NULL,
  permit_json TEXT NOT NULL CHECK (json_valid(permit_json)),
  FOREIGN KEY (run_id, attempt_id) REFERENCES attempts(run_id, attempt_id),
  UNIQUE (attempt_id, step_id, tool_call_id)
) STRICT;

CREATE TABLE runner_jobs (
  runner_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE REFERENCES tool_operations(operation_id),
  state TEXT NOT NULL CHECK (state IN ('QUEUED','STARTING','RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN')),
  image_digest TEXT NOT NULL,
  exit_code INTEGER,
  last_checked_at TEXT,
  stop_evidence_json TEXT CHECK (stop_evidence_json IS NULL OR json_valid(stop_evidence_json)),
  PRIMARY KEY (runner_id, job_id),
  CHECK (state = 'EXITED' OR exit_code IS NULL)
) STRICT;

CREATE TABLE artifacts (
  artifact_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  attempt_id TEXT,
  kind TEXT NOT NULL,
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  storage_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING','READY','MISSING','QUARANTINED')),
  input_fingerprint TEXT,
  code_commit TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, artifact_id),
  UNIQUE (run_id, artifact_id),
  FOREIGN KEY (project_id, run_id) REFERENCES runs(project_id, run_id),
  FOREIGN KEY (run_id, attempt_id) REFERENCES attempts(run_id, attempt_id)
) STRICT;

CREATE TABLE release_candidates (
  candidate_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  code_commit TEXT NOT NULL,
  requirement_revision INTEGER NOT NULL,
  plan_revision INTEGER NOT NULL,
  manifest_hash TEXT NOT NULL,
  check_config_hash TEXT NOT NULL,
  data_plan_hash TEXT NOT NULL,
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  state TEXT NOT NULL CHECK (state IN ('PREPARING','READY','BLOCKED','SUPERSEDED')),
  UNIQUE (project_id, candidate_id),
  UNIQUE (project_id, run_id, candidate_id),
  UNIQUE (run_id, candidate_id),
  FOREIGN KEY (project_id, run_id) REFERENCES runs(project_id, run_id),
  FOREIGN KEY (run_id, requirement_revision) REFERENCES requirement_revisions(run_id, revision),
  FOREIGN KEY (run_id, plan_revision) REFERENCES plan_revisions(run_id, revision)
) STRICT;

CREATE TABLE artifact_applicability (
  run_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  requirement_revision INTEGER NOT NULL,
  plan_revision INTEGER NOT NULL,
  candidate_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('usable','held','stale')),
  reason TEXT NOT NULL,
  PRIMARY KEY (artifact_id, requirement_revision, plan_revision, candidate_id),
  FOREIGN KEY (run_id, artifact_id) REFERENCES artifacts(run_id, artifact_id),
  FOREIGN KEY (run_id, requirement_revision) REFERENCES requirement_revisions(run_id, revision),
  FOREIGN KEY (run_id, plan_revision) REFERENCES plan_revisions(run_id, revision),
  FOREIGN KEY (run_id, candidate_id) REFERENCES release_candidates(run_id, candidate_id)
) STRICT;

CREATE TABLE decisions (
  decision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  subject_id TEXT NOT NULL,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('PLAN','CONFLICT','CHANGE','REDO','BUDGET')),
  basis_hash TEXT NOT NULL,
  choice_json TEXT NOT NULL CHECK (json_valid(choice_json)),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (run_id, subject_kind, subject_id, basis_hash)
) STRICT;

CREATE TABLE releases (
  release_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL UNIQUE,
  candidate_id TEXT NOT NULL UNIQUE,
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision > 0),
  acceptance_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  manifest_hash TEXT NOT NULL,
  prepared_data_ref TEXT NOT NULL,
  accepted_by TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  UNIQUE (project_id, release_id),
  FOREIGN KEY (project_id, run_id, candidate_id) REFERENCES release_candidates(project_id, run_id, candidate_id)
) STRICT;

-- 终态业务行不回退；迟到日志／诊断追加到事件或独立事实表。
CREATE TRIGGER immutable_terminal_attempt BEFORE UPDATE ON attempts
WHEN OLD.ended_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'TERMINAL_ATTEMPT_IMMUTABLE'); END;

-- run.event_seq 允许追加迟到历史，业务状态及代际不能变。
CREATE TRIGGER immutable_terminal_run BEFORE UPDATE ON runs
WHEN OLD.terminal_outcome IS NOT NULL AND (
  NEW.terminal_outcome IS NOT OLD.terminal_outcome OR NEW.phase IS NOT OLD.phase OR
  NEW.control_gate IS NOT OLD.control_gate OR NEW.run_epoch <> OLD.run_epoch OR
  NEW.control_revision <> OLD.control_revision OR NEW.current_plan_revision IS NOT OLD.current_plan_revision OR
  NEW.current_requirement_revision IS NOT OLD.current_requirement_revision OR
  NEW.ended_at IS NOT OLD.ended_at OR NEW.project_id <> OLD.project_id OR NEW.task_id <> OLD.task_id OR
  NEW.origin_run_id IS NOT OLD.origin_run_id)
BEGIN SELECT RAISE(ABORT, 'TERMINAL_RUN_IMMUTABLE'); END;

CREATE TRIGGER immutable_requirement BEFORE UPDATE ON requirement_revisions
BEGIN SELECT RAISE(ABORT, 'REQUIREMENT_REVISION_IMMUTABLE'); END;
CREATE TRIGGER immutable_plan BEFORE UPDATE ON plan_revisions
BEGIN SELECT RAISE(ABORT, 'PLAN_REVISION_IMMUTABLE'); END;
CREATE TRIGGER immutable_work_revision BEFORE UPDATE ON work_revisions
BEGIN SELECT RAISE(ABORT, 'WORK_REVISION_IMMUTABLE'); END;
CREATE TRIGGER immutable_release BEFORE UPDATE ON releases
BEGIN SELECT RAISE(ABORT, 'RELEASE_IMMUTABLE'); END;
