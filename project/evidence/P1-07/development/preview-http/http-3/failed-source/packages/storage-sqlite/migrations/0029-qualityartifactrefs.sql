CREATE TABLE quality_artifact_refs (
 operation_id TEXT NOT NULL,
 material_key TEXT NOT NULL,
 artifact_id TEXT NOT NULL UNIQUE REFERENCES artifacts(artifact_id),
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 PRIMARY KEY(operation_id,material_key),
 FOREIGN KEY(operation_id,material_key) REFERENCES quality_materials(operation_id,material_key)
) STRICT;
CREATE TRIGGER quality_artifact_ref_update BEFORE UPDATE ON quality_artifact_refs
BEGIN SELECT RAISE(ABORT,'QUALITY_ARTIFACT_REF_IMMUTABLE'); END;
CREATE TRIGGER quality_artifact_ref_delete BEFORE DELETE ON quality_artifact_refs
BEGIN SELECT RAISE(ABORT,'QUALITY_ARTIFACT_REF_IMMUTABLE'); END;
