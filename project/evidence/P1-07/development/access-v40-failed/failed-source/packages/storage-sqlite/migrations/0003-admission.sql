-- Minimal prerequisites for the DB part of T1/T2; later DB-C/DB-D migrations extend them.
CREATE TABLE input_messages (
  message_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body_artifact_id TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(run_id,author,client_message_id),
  FOREIGN KEY(project_id,run_id) REFERENCES runs(project_id,run_id),
  FOREIGN KEY(run_id,body_artifact_id) REFERENCES artifacts(run_id,artifact_id)
) STRICT;

CREATE TABLE role_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('product','architect','developer','tester')),
  revision TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE plan_confirmations (
  run_id TEXT NOT NULL,
  plan_revision INTEGER NOT NULL,
  requirement_revision INTEGER NOT NULL,
  review_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(run_id,plan_revision),
  FOREIGN KEY(run_id,plan_revision) REFERENCES plan_revisions(run_id,revision),
  FOREIGN KEY(run_id,requirement_revision) REFERENCES requirement_revisions(run_id,revision)
) STRICT;

CREATE TABLE execution_grants (
  grant_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  activation_id TEXT NOT NULL,
  permit_json TEXT NOT NULL CHECK(json_valid(permit_json)),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(attempt_id,activation_id),
  FOREIGN KEY(run_id,attempt_id) REFERENCES attempts(run_id,attempt_id)
) STRICT;

CREATE TABLE content_write_operations (
  write_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  expected_size INTEGER NOT NULL CHECK(expected_size>=0),
  state TEXT NOT NULL CHECK(state IN ('STAGING','PUBLISHED','COMMITTED','FAILED')),
  error_json TEXT CHECK(error_json IS NULL OR json_valid(error_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER max_two_role_slots BEFORE INSERT ON role_slots
WHEN (SELECT count(*) FROM role_slots WHERE run_id=NEW.run_id)>=2
BEGIN SELECT RAISE(ABORT,'RUN_SLOT_LIMIT'); END;

CREATE TRIGGER slot_requires_open_attempt BEFORE INSERT ON role_slots
WHEN NOT EXISTS(SELECT 1 FROM attempts WHERE attempt_id=NEW.attempt_id AND ended_at IS NULL)
BEGIN SELECT RAISE(ABORT,'ATTEMPT_ALREADY_ENDED'); END;

CREATE TRIGGER artifact_content_matches BEFORE INSERT ON artifacts
WHEN NOT EXISTS(SELECT 1 FROM content_objects c WHERE c.content_hash=NEW.content_hash
  AND c.byte_size=NEW.byte_size AND c.storage_key=NEW.storage_key
  AND c.state='READY')
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;

CREATE TRIGGER immutable_input_message BEFORE UPDATE ON input_messages
BEGIN SELECT RAISE(ABORT,'INPUT_MESSAGE_IMMUTABLE'); END;
CREATE TRIGGER immutable_role_snapshot BEFORE UPDATE ON role_snapshots
BEGIN SELECT RAISE(ABORT,'ROLE_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER immutable_confirmation BEFORE UPDATE ON plan_confirmations
BEGIN SELECT RAISE(ABORT,'PLAN_CONFIRMATION_IMMUTABLE'); END;

CREATE TRIGGER immutable_artifact_content BEFORE UPDATE ON artifacts
WHEN NEW.content_hash<>OLD.content_hash OR NEW.byte_size<>OLD.byte_size OR NEW.storage_key<>OLD.storage_key
 OR NEW.project_id<>OLD.project_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id IS NOT OLD.attempt_id
BEGIN SELECT RAISE(ABORT,'ARTIFACT_CONTENT_IMMUTABLE'); END;

CREATE TRIGGER preserve_requirement BEFORE DELETE ON requirement_revisions
BEGIN SELECT RAISE(ABORT,'REQUIREMENT_REVISION_IMMUTABLE'); END;
CREATE TRIGGER preserve_plan BEFORE DELETE ON plan_revisions
BEGIN SELECT RAISE(ABORT,'PLAN_REVISION_IMMUTABLE'); END;
CREATE TRIGGER preserve_work_revision BEFORE DELETE ON work_revisions
BEGIN SELECT RAISE(ABORT,'WORK_REVISION_IMMUTABLE'); END;
CREATE TRIGGER preserve_release BEFORE DELETE ON releases
BEGIN SELECT RAISE(ABORT,'RELEASE_IMMUTABLE'); END;
CREATE TRIGGER preserve_event BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT,'EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_event_delete BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT,'EVENT_IMMUTABLE'); END;

CREATE INDEX operations_scope ON operations(principal_id,scope_id,created_at,operation_id);
CREATE INDEX attempts_run_state ON attempts(run_id,state,attempt_id);
CREATE INDEX runs_project_created ON runs(project_id,created_at,run_id);
