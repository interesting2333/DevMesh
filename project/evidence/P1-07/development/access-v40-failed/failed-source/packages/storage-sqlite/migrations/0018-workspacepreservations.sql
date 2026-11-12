CREATE TABLE workspace_preservations (
 operation_id TEXT PRIMARY KEY,
 allocation_operation_id TEXT NOT NULL REFERENCES workspace_allocations(operation_id),
 workspace_ref TEXT NOT NULL REFERENCES workspace_allocations(workspace_ref),
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 principal_id TEXT NOT NULL,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 basis_hash TEXT NOT NULL CHECK(length(basis_hash)=64),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 state TEXT NOT NULL CHECK(state IN ('SENT','PREPARED','ACKNOWLEDGED')),
 manifest_json TEXT CHECK(manifest_json IS NULL OR json_valid(manifest_json)),
 manifest_hash TEXT CHECK(manifest_hash IS NULL OR length(manifest_hash)=64),
 acknowledgement_json TEXT CHECK(acknowledgement_json IS NULL OR json_valid(acknowledgement_json)),
 created_at TEXT NOT NULL,
 acknowledged_at TEXT,
 CHECK((manifest_json IS NOT NULL)=(manifest_hash IS NOT NULL)),
 CHECK((state='ACKNOWLEDGED')=(acknowledgement_json IS NOT NULL AND acknowledged_at IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX workspace_preservation_unresolved ON workspace_preservations(workspace_ref) WHERE state<>'ACKNOWLEDGED';
CREATE TABLE workspace_preservation_materials (
 operation_id TEXT NOT NULL REFERENCES workspace_preservations(operation_id),
 material_key TEXT NOT NULL,
 expected_hash TEXT NOT NULL CHECK(length(expected_hash)=64),
 byte_size INTEGER NOT NULL CHECK(byte_size>=0 AND byte_size<=8388608),
 write_key TEXT NOT NULL UNIQUE,
 content_hash TEXT REFERENCES content_objects(content_hash),
 write_id TEXT UNIQUE REFERENCES object_write_operations(write_id),
 PRIMARY KEY(operation_id,material_key),
 CHECK((content_hash IS NOT NULL)=(write_id IS NOT NULL)),
 CHECK(content_hash IS NULL OR content_hash=expected_hash)
) STRICT;
CREATE TRIGGER workspace_preservation_material_identity BEFORE UPDATE ON workspace_preservation_materials
WHEN NEW.operation_id<>OLD.operation_id OR NEW.material_key<>OLD.material_key OR NEW.expected_hash<>OLD.expected_hash OR NEW.byte_size<>OLD.byte_size OR NEW.write_key<>OLD.write_key
 OR (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.write_id IS NOT OLD.write_id))
BEGIN SELECT RAISE(ABORT,'WORKSPACE_PRESERVATION_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER workspace_preservation_material_ready BEFORE UPDATE OF content_hash ON workspace_preservation_materials
WHEN NEW.content_hash IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM content_objects c JOIN object_write_operations w ON w.expected_hash=c.content_hash
 WHERE c.content_hash=NEW.expected_hash AND c.byte_size=NEW.byte_size AND c.state='READY' AND w.write_id=NEW.write_id
  AND w.purpose='workspacePreservation' AND w.expected_size=NEW.byte_size
  AND json_extract(w.target_json,'$.operationId')=NEW.operation_id
  AND json_extract(w.target_json,'$.materialKey')=NEW.material_key
)
BEGIN SELECT RAISE(ABORT,'WORKSPACE_PRESERVATION_MATERIAL_UNPROVEN'); END;
CREATE TRIGGER workspace_preservation_material_preserve BEFORE DELETE ON workspace_preservation_materials
BEGIN SELECT RAISE(ABORT,'WORKSPACE_PRESERVATION_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER workspace_preservation_identity BEFORE UPDATE ON workspace_preservations
WHEN NEW.operation_id<>OLD.operation_id OR NEW.allocation_operation_id<>OLD.allocation_operation_id OR NEW.workspace_ref<>OLD.workspace_ref OR NEW.project_id<>OLD.project_id
 OR NEW.principal_id<>OLD.principal_id OR NEW.request_hash<>OLD.request_hash OR NEW.basis_hash<>OLD.basis_hash OR NEW.basis_json<>OLD.basis_json OR NEW.created_at<>OLD.created_at
 OR (OLD.manifest_json IS NOT NULL AND (NEW.manifest_json IS NOT OLD.manifest_json OR NEW.manifest_hash IS NOT OLD.manifest_hash))
 OR (OLD.acknowledgement_json IS NOT NULL AND (NEW.acknowledgement_json IS NOT OLD.acknowledgement_json OR NEW.acknowledged_at IS NOT OLD.acknowledged_at OR NEW.state<>OLD.state))
BEGIN SELECT RAISE(ABORT,'WORKSPACE_PRESERVATION_IMMUTABLE'); END;
CREATE TRIGGER workspace_preservation_preserve BEFORE DELETE ON workspace_preservations
BEGIN SELECT RAISE(ABORT,'WORKSPACE_PRESERVATION_IMMUTABLE'); END;
