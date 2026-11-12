ALTER TABLE projects ADD COLUMN updated_at TEXT;
UPDATE projects SET updated_at=created_at;
CREATE INDEX projects_updated ON projects(updated_at DESC,project_id DESC);
ALTER TABLE user_tasks ADD COLUMN title TEXT;

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','operator','viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(project_id,principal_id)
) STRICT;
INSERT INTO project_members SELECT project_id,owner_id,'owner',created_at FROM projects;
CREATE INDEX members_principal ON project_members(principal_id,project_id);

CREATE TABLE input_message_attachments (
  message_id TEXT NOT NULL REFERENCES input_messages(message_id),
  attachment_id TEXT NOT NULL REFERENCES attachments(attachment_id),
  position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 2),
  PRIMARY KEY(message_id,attachment_id),
  UNIQUE(message_id,position)
) STRICT;
CREATE TABLE input_processing (
  message_id TEXT PRIMARY KEY REFERENCES input_messages(message_id),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  intent_hint TEXT NOT NULL CHECK(intent_hint IN ('query','change','unsure'))
) STRICT;
CREATE TABLE input_operation_resources (
  operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  run_id TEXT NOT NULL,
  FOREIGN KEY(project_id,run_id) REFERENCES runs(project_id,run_id)
) STRICT;

CREATE TABLE upload_intakes (
  intake_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  principal_id TEXT NOT NULL,
  claim_token TEXT NOT NULL UNIQUE,
  staging_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK(state IN ('RECEIVING','VALIDATED','READY','FAILED','INTERRUPTED')),
  request_hash TEXT CHECK(request_hash IS NULL OR length(request_hash)=64),
  expected_hash TEXT CHECK(expected_hash IS NULL OR length(expected_hash)=64),
  content_hash TEXT REFERENCES content_objects(content_hash),
  byte_size INTEGER CHECK(byte_size IS NULL OR byte_size BETWEEN 1 AND 2097152),
  name TEXT,
  client_attachment_id TEXT,
  attachment_id TEXT REFERENCES attachments(attachment_id),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((state='READY')=(attachment_id IS NOT NULL)),
  CHECK(state NOT IN ('VALIDATED','READY') OR (request_hash IS NOT NULL AND byte_size IS NOT NULL AND name IS NOT NULL AND client_attachment_id IS NOT NULL))
) STRICT;
CREATE INDEX upload_intakes_recovery ON upload_intakes(state,intake_id);

CREATE TABLE auth_sessions (
  session_id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  token_digest TEXT NOT NULL UNIQUE CHECK(length(token_digest)=64),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at,session_id);

CREATE TRIGGER preserve_input_attachment BEFORE DELETE ON input_message_attachments
BEGIN SELECT RAISE(ABORT,'INPUT_ATTACHMENT_IMMUTABLE'); END;
CREATE TRIGGER immutable_input_attachment BEFORE UPDATE ON input_message_attachments
BEGIN SELECT RAISE(ABORT,'INPUT_ATTACHMENT_IMMUTABLE'); END;
CREATE TRIGGER protect_bound_attachment BEFORE UPDATE OF state ON attachments
WHEN NEW.state='REMOVED' AND EXISTS(SELECT 1 FROM input_message_attachments WHERE attachment_id=OLD.attachment_id)
BEGIN SELECT RAISE(ABORT,'ATTACHMENT_BOUND'); END;
CREATE TRIGGER input_attachment_ready BEFORE INSERT ON input_message_attachments
WHEN NOT EXISTS(SELECT 1 FROM attachments a JOIN input_messages m ON m.author=a.owner_id WHERE a.attachment_id=NEW.attachment_id AND m.message_id=NEW.message_id AND a.state='READY')
BEGIN SELECT RAISE(ABORT,'ATTACHMENT_UNAVAILABLE'); END;
