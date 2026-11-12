CREATE TABLE verified_repairs (
 operation_id TEXT PRIMARY KEY,
 principal_id TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES runs(run_id),
 request_hash TEXT NOT NULL,
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
 carry_json TEXT NOT NULL CHECK(json_valid(carry_json)),
 expected_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size>0),
 write_key TEXT NOT NULL UNIQUE,
 publish_key TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('PREPARED','READY','PUBLISHED')),
 content_hash TEXT REFERENCES content_objects(content_hash),
 write_id TEXT REFERENCES object_write_operations(write_id),
 published_plan_revision INTEGER,
 publication_operation_id TEXT REFERENCES operations(operation_id),
 created_at TEXT NOT NULL,
 UNIQUE(run_id,published_plan_revision),
 FOREIGN KEY(run_id,published_plan_revision) REFERENCES plan_revisions(run_id,revision),
 CHECK((state='PREPARED' AND content_hash IS NULL AND write_id IS NULL) OR (state IN ('READY','PUBLISHED') AND content_hash=expected_hash AND write_id IS NOT NULL)),
 CHECK((state='PUBLISHED')=(published_plan_revision IS NOT NULL AND publication_operation_id IS NOT NULL))
) STRICT;
CREATE TRIGGER verified_repair_identity BEFORE UPDATE ON verified_repairs WHEN
 NEW.operation_id IS NOT OLD.operation_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.run_id IS NOT OLD.run_id OR
 NEW.request_hash IS NOT OLD.request_hash OR NEW.request_json IS NOT OLD.request_json OR NEW.basis_json IS NOT OLD.basis_json OR
 NEW.plan_json IS NOT OLD.plan_json OR NEW.carry_json IS NOT OLD.carry_json OR NEW.expected_hash IS NOT OLD.expected_hash OR
 NEW.byte_size IS NOT OLD.byte_size OR NEW.write_key IS NOT OLD.write_key OR NEW.publish_key IS NOT OLD.publish_key OR NEW.created_at IS NOT OLD.created_at OR
 (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.write_id IS NOT OLD.write_id)) OR
 (OLD.state='READY' AND NEW.state NOT IN ('READY','PUBLISHED')) OR (OLD.state='PUBLISHED' AND (
 NEW.state IS NOT OLD.state OR NEW.published_plan_revision IS NOT OLD.published_plan_revision OR NEW.publication_operation_id IS NOT OLD.publication_operation_id))
 BEGIN SELECT RAISE(ABORT,'VERIFIED_REPAIR_IMMUTABLE'); END;
CREATE TRIGGER verified_repair_retained BEFORE DELETE ON verified_repairs BEGIN SELECT RAISE(ABORT,'VERIFIED_REPAIR_RETAINED'); END;
CREATE TABLE plan_carried_results (
 run_id TEXT NOT NULL,
 plan_revision INTEGER NOT NULL,
 work_id TEXT NOT NULL,
 attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
 repair_operation_id TEXT NOT NULL REFERENCES verified_repairs(operation_id),
 run_epoch INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 snapshot_sha256 TEXT NOT NULL,
 PRIMARY KEY(run_id,plan_revision,work_id),
 FOREIGN KEY(run_id,plan_revision,work_id) REFERENCES plan_works(run_id,plan_revision,work_id)
) STRICT;
CREATE TRIGGER plan_carry_immutable BEFORE UPDATE ON plan_carried_results BEGIN SELECT RAISE(ABORT,'PLAN_CARRY_IMMUTABLE'); END;
CREATE TRIGGER plan_carry_retained BEFORE DELETE ON plan_carried_results BEGIN SELECT RAISE(ABORT,'PLAN_CARRY_RETAINED'); END;
