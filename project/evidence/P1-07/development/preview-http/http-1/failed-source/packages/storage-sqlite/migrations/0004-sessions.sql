ALTER TABLE content_objects ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE content_objects ADD COLUMN verified_at TEXT;
ALTER TABLE content_objects ADD COLUMN last_error TEXT;

CREATE TABLE object_write_operations (
  write_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  owner_id TEXT NOT NULL,
  owner_scope TEXT NOT NULL,
  purpose TEXT NOT NULL,
  staging_key TEXT NOT NULL UNIQUE,
  expected_hash TEXT NOT NULL CHECK(length(expected_hash)=64),
  expected_size INTEGER NOT NULL CHECK(expected_size>=0),
  mime_type TEXT NOT NULL,
  target_json TEXT NOT NULL CHECK(json_valid(target_json)),
  lease_until TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('RECEIVING','SEALED','REGISTERED','FAILED')),
  error_json TEXT CHECK(error_json IS NULL OR json_valid(error_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX object_writes_recovery ON object_write_operations(state,write_id);

CREATE TABLE attachments (
  attachment_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  client_attachment_id TEXT NOT NULL,
  upload_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  name TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size>=0),
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  state TEXT NOT NULL CHECK(state IN ('READY','REMOVED')),
  created_at TEXT NOT NULL,
  UNIQUE(owner_id,client_attachment_id)
) STRICT;

CREATE TABLE agent_sessions (
  session_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL UNIQUE,
  role_snapshot_id TEXT NOT NULL REFERENCES role_snapshots(snapshot_id),
  context_manifest_ref TEXT REFERENCES content_objects(content_hash),
  last_step_no INTEGER NOT NULL DEFAULT 0 CHECK(last_step_no>=0),
  last_message_seq INTEGER NOT NULL DEFAULT 0 CHECK(last_message_seq>=0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY(run_id,attempt_id) REFERENCES attempts(run_id,attempt_id),
  UNIQUE(run_id,session_id),
  CHECK((status='CLOSED')=(closed_at IS NOT NULL))
) STRICT;

CREATE TABLE session_messages (
  message_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(session_id),
  message_seq INTEGER NOT NULL CHECK(message_seq>=1),
  client_message_id TEXT NOT NULL,
  activation_id TEXT NOT NULL,
  step_no INTEGER,
  kind TEXT NOT NULL CHECK(kind IN ('user','assistant','tool-call','tool-result','context-summary')),
  body_content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  tool_call_id TEXT,
  source_ref TEXT CHECK(source_ref IS NULL OR json_valid(source_ref)),
  created_at TEXT NOT NULL,
  UNIQUE(session_id,message_seq),
  UNIQUE(session_id,client_message_id),
  FOREIGN KEY(session_id,step_no) REFERENCES model_steps(session_id,step_no),
  CHECK((kind IN ('tool-call','tool-result'))=(tool_call_id IS NOT NULL))
) STRICT;

CREATE TABLE context_snapshots (
  context_snapshot_id TEXT PRIMARY KEY,
  workflow_session_id TEXT NOT NULL REFERENCES agent_sessions(session_id),
  through_message_seq INTEGER NOT NULL CHECK(through_message_seq>=0),
  manifest_content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  summary_content_hash TEXT REFERENCES content_objects(content_hash),
  config_hash TEXT NOT NULL CHECK(length(config_hash)=64),
  message_refs_json TEXT NOT NULL CHECK(json_valid(message_refs_json)),
  created_at TEXT NOT NULL,
  UNIQUE(workflow_session_id,context_snapshot_id)
) STRICT;

CREATE TABLE model_steps (
  session_id TEXT NOT NULL REFERENCES agent_sessions(session_id),
  step_no INTEGER NOT NULL CHECK(step_no>=1),
  context_snapshot_id TEXT NOT NULL,
  request_content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  response_content_hash TEXT REFERENCES content_objects(content_hash),
  usage_json TEXT CHECK(usage_json IS NULL OR json_valid(usage_json)),
  provider_request_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('PREPARED','SENT','RESPONDED','INTERRUPTED','FAILED')),
  started_at TEXT NOT NULL,
  sent_at TEXT,
  ended_at TEXT,
  PRIMARY KEY(session_id,step_no),
  FOREIGN KEY(session_id,context_snapshot_id) REFERENCES context_snapshots(workflow_session_id,context_snapshot_id),
  CHECK((state IN ('RESPONDED','INTERRUPTED','FAILED'))=(ended_at IS NOT NULL)),
  CHECK((state IN ('RESPONDED','INTERRUPTED','FAILED'))=(response_content_hash IS NOT NULL))
) STRICT;

CREATE TABLE storage_pins (
  pin_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  owner_type TEXT NOT NULL CHECK(owner_type IN ('READ','MAINTENANCE')),
  owner_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ACTIVE','RELEASED')),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX storage_pins_content ON storage_pins(content_hash,state);

CREATE TRIGGER session_message_is_contiguous BEFORE INSERT ON session_messages
WHEN NEW.message_seq<>(SELECT last_message_seq+1 FROM agent_sessions WHERE session_id=NEW.session_id)
BEGIN SELECT RAISE(ABORT,'MESSAGE_SEQUENCE_INVALID'); END;
CREATE TRIGGER session_message_ready BEFORE INSERT ON session_messages
WHEN NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.body_content_hash AND state='READY')
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;
CREATE TRIGGER attachment_content_ready BEFORE INSERT ON attachments
WHEN NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.content_hash AND state='READY' AND byte_size=NEW.byte_size)
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;
CREATE TRIGGER immutable_session_message BEFORE UPDATE ON session_messages
BEGIN SELECT RAISE(ABORT,'MESSAGE_IMMUTABLE'); END;
CREATE TRIGGER preserve_session_message BEFORE DELETE ON session_messages
BEGIN SELECT RAISE(ABORT,'MESSAGE_IMMUTABLE'); END;
CREATE TRIGGER immutable_context_snapshot BEFORE UPDATE ON context_snapshots
BEGIN SELECT RAISE(ABORT,'CONTEXT_IMMUTABLE'); END;
CREATE TRIGGER context_content_ready BEFORE INSERT ON context_snapshots
WHEN NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.manifest_content_hash AND state='READY')
 OR (NEW.summary_content_hash IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.summary_content_hash AND state='READY'))
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;
CREATE TRIGGER model_request_ready BEFORE INSERT ON model_steps
WHEN NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.request_content_hash AND state='READY')
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;
CREATE TRIGGER model_response_ready BEFORE UPDATE OF response_content_hash ON model_steps
WHEN NEW.response_content_hash IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_objects WHERE content_hash=NEW.response_content_hash AND state='READY')
BEGIN SELECT RAISE(ABORT,'CONTENT_NOT_READY'); END;
CREATE TRIGGER attachment_identity_immutable BEFORE UPDATE ON attachments
WHEN NEW.attachment_id<>OLD.attachment_id OR NEW.owner_id<>OLD.owner_id OR NEW.client_attachment_id<>OLD.client_attachment_id
 OR NEW.upload_operation_id<>OLD.upload_operation_id OR NEW.name<>OLD.name OR NEW.byte_size<>OLD.byte_size OR NEW.content_hash<>OLD.content_hash
BEGIN SELECT RAISE(ABORT,'ATTACHMENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_context_snapshot BEFORE DELETE ON context_snapshots
BEGIN SELECT RAISE(ABORT,'CONTEXT_IMMUTABLE'); END;
CREATE TRIGGER model_request_immutable BEFORE UPDATE ON model_steps
WHEN NEW.session_id<>OLD.session_id OR NEW.step_no<>OLD.step_no OR NEW.request_content_hash<>OLD.request_content_hash
 OR NEW.context_snapshot_id<>OLD.context_snapshot_id OR OLD.response_content_hash IS NOT NULL
BEGIN SELECT RAISE(ABORT,'MODEL_STEP_IMMUTABLE'); END;
CREATE TRIGGER preserve_model_step BEFORE DELETE ON model_steps
BEGIN SELECT RAISE(ABORT,'MODEL_STEP_IMMUTABLE'); END;
CREATE TRIGGER session_identity_immutable BEFORE UPDATE ON agent_sessions
WHEN NEW.session_id<>OLD.session_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.role_snapshot_id<>OLD.role_snapshot_id
 OR (OLD.status='CLOSED' AND NEW.status<>'CLOSED') OR NEW.last_message_seq<OLD.last_message_seq OR NEW.last_step_no<OLD.last_step_no
BEGIN SELECT RAISE(ABORT,'SESSION_IDENTITY_IMMUTABLE'); END;
