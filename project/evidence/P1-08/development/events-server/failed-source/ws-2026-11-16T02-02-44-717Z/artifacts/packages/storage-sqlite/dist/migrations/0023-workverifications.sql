CREATE TABLE work_verifications (
 operation_id TEXT PRIMARY KEY,
 principal_id TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES runs(run_id),
 attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
 request_hash TEXT NOT NULL,
 candidate_json TEXT NOT NULL CHECK(json_valid(candidate_json)),
 quality_operation_id TEXT REFERENCES quality_verifications(operation_id),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 evaluation_json TEXT NOT NULL CHECK(json_valid(evaluation_json)),
 expected_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size>=0 AND byte_size<=262144),
 write_key TEXT NOT NULL UNIQUE,
 completion_key TEXT NOT NULL UNIQUE,
 expected_artifact_id TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('PREPARED','READY','APPLIED')),
 content_hash TEXT REFERENCES content_objects(content_hash),
 artifact_id TEXT REFERENCES artifacts(artifact_id),
 write_id TEXT,
 created_at TEXT NOT NULL,
 applied_at TEXT,
 CHECK(content_hash IS NULL OR content_hash=expected_hash),
 CHECK(artifact_id IS NULL OR artifact_id=expected_artifact_id),
 CHECK((state='PREPARED')=(content_hash IS NULL)),
 CHECK((content_hash IS NULL)=(artifact_id IS NULL)),
 CHECK((content_hash IS NULL)=(write_id IS NULL)),
 CHECK((state='APPLIED')=(applied_at IS NOT NULL))
) STRICT;
CREATE INDEX work_verifications_attempt ON work_verifications(attempt_id,created_at);
CREATE TRIGGER work_verification_immutable BEFORE UPDATE ON work_verifications
WHEN NEW.operation_id<>OLD.operation_id OR NEW.principal_id<>OLD.principal_id OR NEW.run_id<>OLD.run_id
 OR NEW.attempt_id<>OLD.attempt_id OR NEW.request_hash<>OLD.request_hash OR NEW.candidate_json<>OLD.candidate_json
 OR NEW.quality_operation_id IS NOT OLD.quality_operation_id OR NEW.basis_json<>OLD.basis_json
 OR NEW.evaluation_json<>OLD.evaluation_json OR NEW.expected_hash<>OLD.expected_hash OR NEW.byte_size<>OLD.byte_size
 OR NEW.write_key<>OLD.write_key OR NEW.completion_key<>OLD.completion_key OR NEW.expected_artifact_id<>OLD.expected_artifact_id
 OR NEW.created_at<>OLD.created_at OR OLD.state='APPLIED'
 OR (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.artifact_id IS NOT OLD.artifact_id OR NEW.write_id IS NOT OLD.write_id))
BEGIN SELECT RAISE(ABORT,'WORK_VERIFICATION_IMMUTABLE'); END;
CREATE TRIGGER work_verification_retained BEFORE DELETE ON work_verifications BEGIN SELECT RAISE(ABORT,'WORK_VERIFICATION_RETAINED'); END;
