-- Registry generations are committed authority; probe tickets alone never authorize routes.
CREATE TABLE endpoint_registrations (
 endpoint_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 config_hash TEXT NOT NULL, config_json TEXT NOT NULL CHECK(json_valid(config_json)),
 created_at TEXT NOT NULL, PRIMARY KEY(endpoint_id,revision)
) STRICT;
CREATE TABLE registry_generations (
 generation_id TEXT PRIMARY KEY, manifest_revision TEXT NOT NULL UNIQUE, manifest_hash TEXT NOT NULL,
 manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)), created_at TEXT NOT NULL
) STRICT;
CREATE TABLE registry_imports (
 manifest_revision TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL,
 generation_id TEXT NOT NULL UNIQUE REFERENCES registry_generations(generation_id), imported_at TEXT NOT NULL
) STRICT;
CREATE TABLE registry_control (
 singleton_id INTEGER PRIMARY KEY CHECK(singleton_id=1),
 active_generation_id TEXT NOT NULL REFERENCES registry_generations(generation_id),
 projection_revision INTEGER NOT NULL CHECK(projection_revision>0), activated_at TEXT NOT NULL
) STRICT;
CREATE TABLE role_endpoint_bindings (
 generation_id TEXT NOT NULL REFERENCES registry_generations(generation_id), role TEXT NOT NULL,
 endpoint_id TEXT NOT NULL, endpoint_revision INTEGER NOT NULL,
 PRIMARY KEY(generation_id,role), FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE registry_probe_tickets (
 check_id TEXT PRIMARY KEY, endpoint_id TEXT NOT NULL, endpoint_revision INTEGER NOT NULL,
 check_sequence INTEGER NOT NULL CHECK(check_sequence>0), config_hash TEXT NOT NULL, issued_at TEXT NOT NULL,
 UNIQUE(endpoint_id,endpoint_revision,check_sequence)
) STRICT;
CREATE TABLE endpoint_checks (
 check_id TEXT PRIMARY KEY REFERENCES registry_probe_tickets(check_id), endpoint_id TEXT NOT NULL,
 endpoint_revision INTEGER NOT NULL, check_sequence INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('HEALTHY','UNHEALTHY','NEEDS_REVIEW')),
 observed_card_hash TEXT, checked_at TEXT NOT NULL, expires_at TEXT NOT NULL, error_code TEXT,
 UNIQUE(endpoint_id,endpoint_revision,check_sequence),
 FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE endpoint_runtime_state (
 endpoint_id TEXT NOT NULL, revision INTEGER NOT NULL,
 lifecycle TEXT NOT NULL CHECK(lifecycle IN ('ACTIVE','DRAINING','RETIRED')),
 latest_check_id TEXT REFERENCES endpoint_checks(check_id), last_applied_sequence INTEGER NOT NULL DEFAULT 0,
 drain_reason TEXT, changed_at TEXT NOT NULL,
 PRIMARY KEY(endpoint_id,revision), FOREIGN KEY(endpoint_id,revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE registry_audit (
 audit_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, endpoint_id TEXT NOT NULL, endpoint_revision INTEGER NOT NULL,
 action TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE attempt_dispatch_bindings (
 attempt_id TEXT PRIMARY KEY REFERENCES attempts(attempt_id),
 endpoint_id TEXT NOT NULL, endpoint_revision INTEGER NOT NULL,
 registry_generation_id TEXT NOT NULL REFERENCES registry_generations(generation_id), projection_revision INTEGER NOT NULL,
 input_manifest_id TEXT NOT NULL UNIQUE, input_fingerprint TEXT NOT NULL,
 role_snapshot_id TEXT NOT NULL REFERENCES role_snapshots(snapshot_id),
 FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE a2a_task_ownership (
 endpoint_id TEXT NOT NULL, task_id TEXT NOT NULL, caller_id TEXT NOT NULL, endpoint_revision INTEGER NOT NULL,
 status_revision INTEGER NOT NULL DEFAULT 1 CHECK(status_revision>0), cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(endpoint_id,task_id), FOREIGN KEY(endpoint_id,task_id) REFERENCES a2a_tasks(endpoint_id,task_id),
 FOREIGN KEY(endpoint_id,endpoint_revision) REFERENCES endpoint_registrations(endpoint_id,revision)
) STRICT;
CREATE TABLE a2a_task_events (
 endpoint_id TEXT NOT NULL, task_id TEXT NOT NULL, seq INTEGER NOT NULL CHECK(seq>0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), created_at TEXT NOT NULL,
 PRIMARY KEY(endpoint_id,task_id,seq), FOREIGN KEY(endpoint_id,task_id) REFERENCES a2a_tasks(endpoint_id,task_id)
) STRICT;
ALTER TABLE accepted_work ADD COLUMN worker_id TEXT;
ALTER TABLE accepted_work ADD COLUMN claim_token TEXT;
ALTER TABLE accepted_work ADD COLUMN claimed_at TEXT;
CREATE INDEX a2a_tasks_owner ON a2a_task_ownership(caller_id,endpoint_id,created_at,task_id);
CREATE TRIGGER immutable_endpoint BEFORE UPDATE ON endpoint_registrations BEGIN SELECT RAISE(ABORT,'ENDPOINT_IMMUTABLE'); END;
CREATE TRIGGER immutable_generation BEFORE UPDATE ON registry_generations BEGIN SELECT RAISE(ABORT,'GENERATION_IMMUTABLE'); END;
CREATE TRIGGER immutable_registry_binding BEFORE UPDATE ON role_endpoint_bindings BEGIN SELECT RAISE(ABORT,'REGISTRY_BINDING_IMMUTABLE'); END;
CREATE TRIGGER immutable_attempt_binding BEFORE UPDATE ON attempt_dispatch_bindings BEGIN SELECT RAISE(ABORT,'ATTEMPT_BINDING_IMMUTABLE'); END;
CREATE TRIGGER immutable_endpoint_check BEFORE UPDATE ON endpoint_checks BEGIN SELECT RAISE(ABORT,'ENDPOINT_CHECK_IMMUTABLE'); END;
CREATE TRIGGER immutable_a2a_event BEFORE UPDATE ON a2a_task_events BEGIN SELECT RAISE(ABORT,'A2A_EVENT_IMMUTABLE'); END;
CREATE TRIGGER immutable_a2a_identity BEFORE UPDATE ON a2a_tasks
 WHEN NEW.endpoint_id<>OLD.endpoint_id OR NEW.task_id<>OLD.task_id OR NEW.context_id<>OLD.context_id OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id
 BEGIN SELECT RAISE(ABORT,'A2A_IDENTITY_IMMUTABLE'); END;
