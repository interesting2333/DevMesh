CREATE TABLE release_delivery_policies (
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 policy_hash TEXT NOT NULL,
 check_config_hash TEXT NOT NULL,
 policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),
 registered_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,policy_hash),
 FOREIGN KEY(project_id,check_config_hash) REFERENCES quality_policies(project_id,config_hash)
) STRICT;
CREATE TABLE release_deliveries (
 operation_id TEXT PRIMARY KEY,
 principal_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 quality_operation_id TEXT NOT NULL REFERENCES quality_verifications(operation_id),
 policy_hash TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 job_json TEXT NOT NULL CHECK(json_valid(job_json)),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','READY')),
 image_json TEXT CHECK(image_json IS NULL OR json_valid(image_json)),
 data_plan_json TEXT CHECK(data_plan_json IS NULL OR json_valid(data_plan_json)),
 created_at TEXT NOT NULL,
 FOREIGN KEY(project_id,run_id) REFERENCES runs(project_id,run_id),
 FOREIGN KEY(project_id,policy_hash) REFERENCES release_delivery_policies(project_id,policy_hash),
 CHECK((state='READY')=(image_json IS NOT NULL AND data_plan_json IS NOT NULL))
) STRICT;
CREATE TABLE release_delivery_materials (
 operation_id TEXT NOT NULL REFERENCES release_deliveries(operation_id),
 material_key TEXT NOT NULL,
 output_path TEXT NOT NULL,
 output_index INTEGER NOT NULL CHECK(output_index BETWEEN 1 AND 32),
 expected_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 0 AND 67108864),
 write_key TEXT NOT NULL UNIQUE,
 content_hash TEXT REFERENCES content_objects(content_hash),
 write_id TEXT REFERENCES object_write_operations(write_id),
 PRIMARY KEY(operation_id,material_key),
 UNIQUE(operation_id,output_index),
 CHECK((content_hash IS NULL)=(write_id IS NULL)),
 CHECK(content_hash IS NULL OR content_hash=expected_hash)
) STRICT;
CREATE TRIGGER delivery_policy_update BEFORE UPDATE ON release_delivery_policies
BEGIN SELECT RAISE(ABORT,'DELIVERY_POLICY_IMMUTABLE'); END;
CREATE TRIGGER delivery_policy_delete BEFORE DELETE ON release_delivery_policies
BEGIN SELECT RAISE(ABORT,'DELIVERY_POLICY_IMMUTABLE'); END;
CREATE TRIGGER release_delivery_update BEFORE UPDATE ON release_deliveries
WHEN NEW.operation_id<>OLD.operation_id OR NEW.principal_id<>OLD.principal_id
 OR NEW.project_id<>OLD.project_id OR NEW.run_id<>OLD.run_id OR NEW.quality_operation_id<>OLD.quality_operation_id
 OR NEW.policy_hash<>OLD.policy_hash OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json
 OR NEW.basis_json<>OLD.basis_json OR NEW.job_json<>OLD.job_json OR NEW.created_at<>OLD.created_at
 OR (OLD.state='READY' AND (NEW.state<>OLD.state OR NEW.image_json IS NOT OLD.image_json OR NEW.data_plan_json IS NOT OLD.data_plan_json))
BEGIN SELECT RAISE(ABORT,'RELEASE_DELIVERY_IMMUTABLE'); END;
CREATE TRIGGER release_delivery_delete BEFORE DELETE ON release_deliveries
BEGIN SELECT RAISE(ABORT,'RELEASE_DELIVERY_IMMUTABLE'); END;
CREATE TRIGGER delivery_material_update BEFORE UPDATE ON release_delivery_materials
WHEN NEW.operation_id<>OLD.operation_id OR NEW.material_key<>OLD.material_key OR NEW.output_path<>OLD.output_path
 OR NEW.output_index<>OLD.output_index OR NEW.expected_hash<>OLD.expected_hash OR NEW.byte_size<>OLD.byte_size OR NEW.write_key<>OLD.write_key
 OR (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.write_id IS NOT OLD.write_id))
BEGIN SELECT RAISE(ABORT,'DELIVERY_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER delivery_material_delete BEFORE DELETE ON release_delivery_materials
BEGIN SELECT RAISE(ABORT,'DELIVERY_MATERIAL_IMMUTABLE'); END;
