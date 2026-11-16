CREATE TABLE quality_policies (
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 config_hash TEXT NOT NULL,
 policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),
 registered_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,config_hash)
) STRICT;
CREATE TABLE quality_verifications (
 operation_id TEXT PRIMARY KEY,
 principal_id TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 run_id TEXT NOT NULL REFERENCES runs(run_id),
 attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
 allocation_operation_id TEXT NOT NULL REFERENCES workspace_allocations(operation_id),
 config_hash TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','EVALUATED')),
 evaluation_json TEXT CHECK(evaluation_json IS NULL OR json_valid(evaluation_json)),
 created_at TEXT NOT NULL,
 evaluated_at TEXT,
 FOREIGN KEY(project_id,config_hash) REFERENCES quality_policies(project_id,config_hash),
 CHECK((state='EVALUATED')=(evaluation_json IS NOT NULL)),
 CHECK((state='EVALUATED')=(evaluated_at IS NOT NULL))
) STRICT;
CREATE TABLE quality_origins (
 operation_id TEXT NOT NULL REFERENCES quality_verifications(operation_id),
 producer_id TEXT NOT NULL,
 pipeline_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL,
 job_id TEXT NOT NULL,
 execution_json TEXT NOT NULL CHECK(json_valid(execution_json)),
 job_hash TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(operation_id,producer_id),
 UNIQUE(operation_id,job_id),
 FOREIGN KEY(pipeline_id,ordinal) REFERENCES pipeline_stages(pipeline_id,ordinal)
) STRICT;
CREATE TABLE quality_materials (
 operation_id TEXT NOT NULL REFERENCES quality_verifications(operation_id),
 material_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('SOURCE','REPORT','LOG','RESULT')),
 descriptor_json TEXT NOT NULL CHECK(json_valid(descriptor_json)),
 expected_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size>=0 AND byte_size<=16777216),
 write_key TEXT NOT NULL,
 content_hash TEXT REFERENCES content_objects(content_hash),
 write_id TEXT,
 created_at TEXT NOT NULL,
 PRIMARY KEY(operation_id,material_key),
 UNIQUE(operation_id,write_key),
 CHECK(content_hash IS NULL OR content_hash=expected_hash),
 CHECK((content_hash IS NULL)=(write_id IS NULL))
) STRICT;
CREATE TRIGGER quality_policy_immutable BEFORE UPDATE ON quality_policies BEGIN SELECT RAISE(ABORT,'QUALITY_POLICY_IMMUTABLE'); END;
CREATE TRIGGER quality_policy_retained BEFORE DELETE ON quality_policies BEGIN SELECT RAISE(ABORT,'QUALITY_POLICY_RETAINED'); END;
CREATE TRIGGER quality_origin_immutable BEFORE UPDATE ON quality_origins BEGIN SELECT RAISE(ABORT,'QUALITY_ORIGIN_IMMUTABLE'); END;
CREATE TRIGGER quality_origin_retained BEFORE DELETE ON quality_origins BEGIN SELECT RAISE(ABORT,'QUALITY_ORIGIN_RETAINED'); END;
CREATE TRIGGER quality_verification_basis BEFORE UPDATE ON quality_verifications
WHEN NEW.operation_id<>OLD.operation_id OR NEW.principal_id<>OLD.principal_id OR NEW.project_id<>OLD.project_id
 OR NEW.run_id<>OLD.run_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.allocation_operation_id<>OLD.allocation_operation_id
 OR NEW.config_hash<>OLD.config_hash OR NEW.request_hash<>OLD.request_hash OR NEW.basis_json<>OLD.basis_json
 OR NEW.created_at<>OLD.created_at OR OLD.state='EVALUATED'
BEGIN SELECT RAISE(ABORT,'QUALITY_VERIFICATION_IMMUTABLE'); END;
CREATE TRIGGER quality_verification_retained BEFORE DELETE ON quality_verifications BEGIN SELECT RAISE(ABORT,'QUALITY_VERIFICATION_RETAINED'); END;
CREATE TRIGGER quality_material_identity BEFORE UPDATE ON quality_materials
WHEN NEW.operation_id<>OLD.operation_id OR NEW.material_key<>OLD.material_key OR NEW.kind<>OLD.kind
 OR NEW.descriptor_json<>OLD.descriptor_json OR NEW.expected_hash<>OLD.expected_hash OR NEW.byte_size<>OLD.byte_size
 OR NEW.write_key<>OLD.write_key OR NEW.created_at<>OLD.created_at
 OR (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.write_id IS NOT OLD.write_id))
BEGIN SELECT RAISE(ABORT,'QUALITY_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER quality_material_retained BEFORE DELETE ON quality_materials BEGIN SELECT RAISE(ABORT,'QUALITY_MATERIAL_RETAINED'); END;
