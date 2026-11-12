CREATE TABLE candidate_materials (
  operation_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  material_key TEXT NOT NULL,
  descriptor_json TEXT NOT NULL CHECK(json_valid(descriptor_json)),
  kind TEXT NOT NULL CHECK(kind IN ('REPORT','FILE','DIRECTORY','ABSENT')),
  expected_hash TEXT,
  byte_size INTEGER,
  write_key TEXT UNIQUE,
  content_hash TEXT REFERENCES content_objects(content_hash),
  write_id TEXT UNIQUE REFERENCES object_write_operations(write_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(operation_id,ordinal,material_key),
  FOREIGN KEY(operation_id,ordinal) REFERENCES candidate_integration_steps(operation_id,ordinal),
  CHECK((kind IN ('REPORT','FILE') AND expected_hash IS NOT NULL AND byte_size IS NOT NULL AND write_key IS NOT NULL)
    OR (kind IN ('DIRECTORY','ABSENT') AND expected_hash IS NULL AND byte_size IS NULL AND write_key IS NULL)),
  CHECK((kind='REPORT')=(material_key='report')),
  CHECK(expected_hash IS NULL OR length(expected_hash)=64),
  CHECK(byte_size IS NULL OR byte_size>=0),
  CHECK((content_hash IS NOT NULL)=(write_id IS NOT NULL)),
  CHECK(content_hash IS NULL OR content_hash=expected_hash)
) STRICT;
CREATE TABLE candidate_conflict_manifests (
  operation_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  report_hash TEXT NOT NULL,
  material_count INTEGER NOT NULL CHECK(material_count>=1 AND material_count<=20000),
  manifest_hash TEXT NOT NULL CHECK(length(manifest_hash)=64),
  created_at TEXT NOT NULL,
  PRIMARY KEY(operation_id,ordinal),
  FOREIGN KEY(operation_id,ordinal) REFERENCES candidate_integration_steps(operation_id,ordinal)
) STRICT;
CREATE TRIGGER candidate_material_identity BEFORE UPDATE ON candidate_materials
WHEN NEW.operation_id<>OLD.operation_id OR NEW.ordinal<>OLD.ordinal OR NEW.material_key<>OLD.material_key
  OR NEW.descriptor_json<>OLD.descriptor_json OR NEW.kind<>OLD.kind OR NEW.expected_hash IS NOT OLD.expected_hash
  OR NEW.byte_size IS NOT OLD.byte_size OR NEW.write_key IS NOT OLD.write_key OR NEW.created_at<>OLD.created_at
  OR (OLD.content_hash IS NOT NULL AND (NEW.content_hash IS NOT OLD.content_hash OR NEW.write_id IS NOT OLD.write_id))
BEGIN SELECT RAISE(ABORT,'CANDIDATE_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER candidate_material_ready BEFORE UPDATE OF content_hash ON candidate_materials
WHEN NEW.content_hash IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM content_objects c JOIN object_write_operations w ON w.expected_hash=c.content_hash
  WHERE c.content_hash=NEW.expected_hash AND c.byte_size=NEW.byte_size AND c.state='READY' AND w.write_id=NEW.write_id
    AND w.purpose='candidateMaterial' AND w.expected_size=NEW.byte_size
    AND json_extract(w.target_json,'$.operationId')=NEW.operation_id
    AND json_extract(w.target_json,'$.ordinal')=NEW.ordinal
    AND json_extract(w.target_json,'$.materialKey')=NEW.material_key
)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_MATERIAL_UNPROVEN'); END;
CREATE TRIGGER candidate_material_preserve BEFORE DELETE ON candidate_materials
BEGIN SELECT RAISE(ABORT,'CANDIDATE_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER candidate_material_closed BEFORE INSERT ON candidate_materials
WHEN EXISTS (SELECT 1 FROM candidate_conflict_manifests WHERE operation_id=NEW.operation_id AND ordinal=NEW.ordinal)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_MATERIALS_SEALED'); END;
CREATE TRIGGER candidate_conflict_manifest_update BEFORE UPDATE ON candidate_conflict_manifests
BEGIN SELECT RAISE(ABORT,'CANDIDATE_CONFLICT_IMMUTABLE'); END;
CREATE TRIGGER candidate_conflict_manifest_delete BEFORE DELETE ON candidate_conflict_manifests
BEGIN SELECT RAISE(ABORT,'CANDIDATE_CONFLICT_IMMUTABLE'); END;
