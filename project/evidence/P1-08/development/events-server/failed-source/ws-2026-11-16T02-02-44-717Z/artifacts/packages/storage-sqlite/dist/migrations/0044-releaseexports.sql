CREATE TABLE release_exports (
 export_id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 release_id TEXT NOT NULL REFERENCES releases(release_id),
 principal_id TEXT NOT NULL,
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 state TEXT NOT NULL CHECK(state IN ('QUEUED','PACKING','FAILED','READY')),
 generation INTEGER NOT NULL DEFAULT 0 CHECK(generation>=0),
 claim_token TEXT,
 lease_until TEXT,
 archive_hash TEXT CHECK(archive_hash IS NULL OR length(archive_hash)=64),
 archive_size INTEGER CHECK(archive_size IS NULL OR archive_size>=0),
 archive_manifest TEXT CHECK(archive_manifest IS NULL OR json_valid(archive_manifest)),
 write_key TEXT NOT NULL,
 content_hash TEXT REFERENCES content_objects(content_hash),
 error_code TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK((state='READY')=(content_hash IS NOT NULL)),
 CHECK((archive_hash IS NULL)=(archive_size IS NULL)),
 CHECK((archive_hash IS NULL)=(archive_manifest IS NULL))
) STRICT;
CREATE TABLE release_export_materials (
 export_id TEXT NOT NULL REFERENCES release_exports(export_id),
 material_key TEXT NOT NULL,
 path TEXT NOT NULL,
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 byte_size INTEGER NOT NULL CHECK(byte_size>=0),
 transform TEXT NOT NULL CHECK(transform IN ('EXACT','REDACT_JSON')),
 PRIMARY KEY(export_id,material_key),
 UNIQUE(export_id,path)
) STRICT;
CREATE TABLE release_export_history (
 export_id TEXT NOT NULL REFERENCES release_exports(export_id),
 seq INTEGER NOT NULL CHECK(seq>0),
 state TEXT NOT NULL,
 generation INTEGER NOT NULL,
 error_code TEXT,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(export_id,seq)
) STRICT;
CREATE TRIGGER release_export_snapshot_immutable BEFORE UPDATE OF operation_id,release_id,principal_id,snapshot_hash,snapshot_json,write_key,created_at ON release_exports
BEGIN SELECT RAISE(ABORT,'EXPORT_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER release_export_archive_immutable BEFORE UPDATE OF archive_hash,archive_size,archive_manifest ON release_exports
WHEN OLD.archive_hash IS NOT NULL AND (NEW.archive_hash IS NOT OLD.archive_hash OR NEW.archive_size IS NOT OLD.archive_size OR NEW.archive_manifest IS NOT OLD.archive_manifest)
BEGIN SELECT RAISE(ABORT,'EXPORT_ARCHIVE_IMMUTABLE'); END;
CREATE TRIGGER release_export_material_immutable BEFORE UPDATE ON release_export_materials
BEGIN SELECT RAISE(ABORT,'EXPORT_MATERIAL_IMMUTABLE'); END;
CREATE TRIGGER release_export_material_retained BEFORE DELETE ON release_export_materials
BEGIN SELECT RAISE(ABORT,'EXPORT_MATERIAL_RETAINED'); END;
CREATE TRIGGER release_export_history_immutable BEFORE UPDATE ON release_export_history
BEGIN SELECT RAISE(ABORT,'EXPORT_HISTORY_IMMUTABLE'); END;
