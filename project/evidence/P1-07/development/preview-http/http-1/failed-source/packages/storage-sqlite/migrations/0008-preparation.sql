ALTER TABLE runs ADD COLUMN answer_interventions INTEGER NOT NULL DEFAULT 0 CHECK(answer_interventions>=0);
ALTER TABLE runs ADD COLUMN preparation_token_limit INTEGER CHECK(preparation_token_limit IS NULL OR preparation_token_limit>0);
ALTER TABLE runs ADD COLUMN preparation_tokens_used INTEGER NOT NULL DEFAULT 0 CHECK(preparation_tokens_used>=0);

CREATE TABLE preparation_jobs (
  job_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  principal_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('UNDERSTAND','INTERPRET','PLAN')),
  role TEXT NOT NULL CHECK(role IN ('product','architect')),
  state TEXT NOT NULL DEFAULT 'WAITING' CHECK(state IN ('WAITING','READY','ACTIVE','APPLIED','FAILED','RECONCILE','SUPERSEDED')),
  retry_of TEXT REFERENCES preparation_jobs(job_id),
  basis_hash TEXT CHECK(basis_hash IS NULL OR length(basis_hash)=64),
  basis_json TEXT CHECK(basis_json IS NULL OR json_valid(basis_json)),
  result_artifact_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(run_id,job_id),
  CHECK((purpose='PLAN')=(role='architect')),
  FOREIGN KEY(run_id,result_artifact_id) REFERENCES artifacts(run_id,artifact_id)
) STRICT;
CREATE INDEX preparation_pending ON preparation_jobs(state,created_at,job_id);
CREATE TABLE preparation_bootstrap_sources (
  run_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  path TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  PRIMARY KEY(job_id,path),
  FOREIGN KEY(run_id,job_id) REFERENCES preparation_jobs(run_id,job_id),
  FOREIGN KEY(run_id,artifact_id) REFERENCES artifacts(run_id,artifact_id)
) STRICT;

CREATE TABLE preparation_attempts (
  preparation_attempt_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK(attempt_no>0),
  run_epoch INTEGER NOT NULL CHECK(run_epoch>0),
  role TEXT NOT NULL CHECK(role IN ('product','architect')),
  activation_id TEXT NOT NULL UNIQUE,
  grant_id TEXT NOT NULL UNIQUE,
  grant_not_before TEXT NOT NULL,
  grant_expires_at TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  endpoint_revision INTEGER NOT NULL,
  registry_generation_id TEXT NOT NULL REFERENCES registry_generations(generation_id),
  caller_id TEXT NOT NULL,
  profile_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  input_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  basis_hash TEXT NOT NULL CHECK(length(basis_hash)=64),
  dispatch_sent_at TEXT,
  state TEXT NOT NULL CHECK(state IN ('RESERVED','SUBMITTED','WORKING','RESPONDED','RECONCILE','SUCCEEDED','FAILED','SUPERSEDED','CANCELLED')),
  ended_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(job_id,attempt_no),
  UNIQUE(run_id,preparation_attempt_id),
  UNIQUE(preparation_attempt_id,role),
  FOREIGN KEY(run_id,job_id) REFERENCES preparation_jobs(run_id,job_id),
  FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision),
  CHECK(grant_expires_at>grant_not_before),
  CHECK((ended_at IS NOT NULL)=(state IN ('SUCCEEDED','FAILED','SUPERSEDED','CANCELLED')))
) STRICT;
CREATE UNIQUE INDEX preparation_one_live_job ON preparation_attempts(job_id) WHERE ended_at IS NULL;

CREATE TABLE preparation_slots (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  role TEXT NOT NULL,
  preparation_attempt_id TEXT NOT NULL UNIQUE,
  PRIMARY KEY(run_id,role),
  FOREIGN KEY(run_id,preparation_attempt_id) REFERENCES preparation_attempts(run_id,preparation_attempt_id),
  FOREIGN KEY(preparation_attempt_id,role) REFERENCES preparation_attempts(preparation_attempt_id,role)
) STRICT;
CREATE TRIGGER preparation_capacity BEFORE INSERT ON preparation_slots
WHEN EXISTS(SELECT 1 FROM role_slots WHERE run_id=NEW.run_id AND role=NEW.role)
 OR (SELECT count(*) FROM role_slots WHERE run_id=NEW.run_id)+(SELECT count(*) FROM preparation_slots WHERE run_id=NEW.run_id)>=2
BEGIN SELECT RAISE(ABORT,'ROLE_CAPACITY_EXHAUSTED'); END;
CREATE TRIGGER implementation_preparation_capacity BEFORE INSERT ON role_slots
WHEN EXISTS(SELECT 1 FROM preparation_slots WHERE run_id=NEW.run_id AND role=NEW.role)
 OR (SELECT count(*) FROM role_slots WHERE run_id=NEW.run_id)+(SELECT count(*) FROM preparation_slots WHERE run_id=NEW.run_id)>=2
BEGIN SELECT RAISE(ABORT,'ROLE_CAPACITY_EXHAUSTED'); END;

CREATE TABLE preparation_steps (
  preparation_attempt_id TEXT NOT NULL REFERENCES preparation_attempts(preparation_attempt_id),
  step_no INTEGER NOT NULL CHECK(step_no=1),
  request_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  response_hash TEXT REFERENCES content_objects(content_hash),
  state TEXT NOT NULL CHECK(state IN ('PREPARED','SENT','RESPONDED','FAILED','RECONCILE')),
  reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens>0),
  input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens>=0),
  output_tokens INTEGER CHECK(output_tokens IS NULL OR output_tokens>=0),
  usage_source TEXT CHECK(usage_source IS NULL OR usage_source IN ('provider','estimated')),
  provider_request_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(preparation_attempt_id,step_no),
  CHECK(state<>'RESPONDED' OR (response_hash IS NOT NULL AND input_tokens IS NOT NULL AND output_tokens IS NOT NULL))
) STRICT;

CREATE TABLE preparation_a2a_tasks (
  task_id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  endpoint_revision INTEGER NOT NULL,
  preparation_attempt_id TEXT NOT NULL UNIQUE REFERENCES preparation_attempts(preparation_attempt_id),
  caller_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  protocol_state TEXT NOT NULL CHECK(protocol_state IN ('submitted','working','input-required','auth-required','completed','failed','canceled','rejected')),
  status_revision INTEGER NOT NULL DEFAULT 1 CHECK(status_revision>0),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
  worker_id TEXT,
  claim_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(endpoint_id,task_id),
  FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE INDEX preparation_tasks_caller ON preparation_a2a_tasks(caller_id,endpoint_id,task_id);
CREATE TABLE preparation_inbox (
  caller_id TEXT NOT NULL,
  endpoint_id TEXT NOT NULL,
  operation_id TEXT NOT NULL REFERENCES operations(operation_id),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  task_id TEXT NOT NULL,
  PRIMARY KEY(caller_id,endpoint_id,operation_id),
  FOREIGN KEY(endpoint_id,task_id) REFERENCES preparation_a2a_tasks(endpoint_id,task_id)
) STRICT;
CREATE TABLE preparation_task_events (
  task_id TEXT NOT NULL REFERENCES preparation_a2a_tasks(task_id),
  seq INTEGER NOT NULL CHECK(seq>0),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(task_id,seq)
) STRICT;

CREATE TABLE understanding_revisions (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  requirement_revision INTEGER NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  artifact_id TEXT NOT NULL,
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  content_json TEXT NOT NULL CHECK(json_valid(content_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(run_id,requirement_revision),
  FOREIGN KEY(run_id,requirement_revision) REFERENCES requirement_revisions(run_id,revision),
  FOREIGN KEY(run_id,job_id) REFERENCES preparation_jobs(run_id,job_id),
  FOREIGN KEY(run_id,artifact_id) REFERENCES artifacts(run_id,artifact_id)
) STRICT;
CREATE TABLE clarification_questions (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  question_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  requirement_basis INTEGER NOT NULL,
  content_json TEXT NOT NULL CHECK(json_valid(content_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(run_id,question_id,revision),
  FOREIGN KEY(run_id,requirement_basis) REFERENCES requirement_revisions(run_id,revision)
) STRICT;
CREATE TABLE clarification_current (
  run_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_revision INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('OPEN','ANSWERED','SUPERSEDED')),
  answer_id TEXT,
  PRIMARY KEY(run_id,question_id),
  FOREIGN KEY(run_id,question_id,question_revision) REFERENCES clarification_questions(run_id,question_id,revision),
  FOREIGN KEY(run_id,question_id,question_revision,answer_id) REFERENCES clarification_answers(run_id,question_id,question_revision,answer_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK((state='ANSWERED')=(answer_id IS NOT NULL))
) STRICT;
CREATE TABLE clarification_answers (
  answer_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_revision INTEGER NOT NULL,
  value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  actor TEXT NOT NULL,
  operation_id TEXT NOT NULL REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  UNIQUE(operation_id,question_id),
  UNIQUE(run_id,answer_id),
  UNIQUE(run_id,question_id,question_revision,answer_id),
  FOREIGN KEY(run_id,question_id,question_revision) REFERENCES clarification_questions(run_id,question_id,revision)
) STRICT;
CREATE TABLE interpretation_answers (
  run_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position>=0),
  PRIMARY KEY(job_id,answer_id),
  UNIQUE(job_id,position),
  FOREIGN KEY(run_id,job_id) REFERENCES preparation_jobs(run_id,job_id),
  FOREIGN KEY(run_id,answer_id) REFERENCES clarification_answers(run_id,answer_id)
) STRICT;
CREATE TRIGGER immutable_understanding BEFORE UPDATE ON understanding_revisions BEGIN SELECT RAISE(ABORT,'UNDERSTANDING_IMMUTABLE'); END;
CREATE TRIGGER retain_understanding BEFORE DELETE ON understanding_revisions BEGIN SELECT RAISE(ABORT,'UNDERSTANDING_IMMUTABLE'); END;
CREATE TRIGGER immutable_question BEFORE UPDATE ON clarification_questions BEGIN SELECT RAISE(ABORT,'QUESTION_IMMUTABLE'); END;
CREATE TRIGGER retain_question BEFORE DELETE ON clarification_questions BEGIN SELECT RAISE(ABORT,'QUESTION_IMMUTABLE'); END;
CREATE TRIGGER immutable_answer BEFORE UPDATE ON clarification_answers BEGIN SELECT RAISE(ABORT,'ANSWER_IMMUTABLE'); END;
CREATE TRIGGER retain_answer BEFORE DELETE ON clarification_answers BEGIN SELECT RAISE(ABORT,'ANSWER_IMMUTABLE'); END;
CREATE TRIGGER immutable_interpretation_answers BEFORE UPDATE ON interpretation_answers BEGIN SELECT RAISE(ABORT,'ANSWER_SET_IMMUTABLE'); END;
CREATE TRIGGER retain_interpretation_answers BEFORE DELETE ON interpretation_answers BEGIN SELECT RAISE(ABORT,'ANSWER_SET_IMMUTABLE'); END;
