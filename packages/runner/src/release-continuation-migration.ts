// Forward-only v12. Original migration SQL and publication proofs stay unchanged.
export const releaseContinuationMigration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v11;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=12)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,12 FROM runner_identity_v11;
DROP TABLE runner_identity_v11;
CREATE TABLE release_profile_preparations(release_id TEXT PRIMARY KEY REFERENCES release_service_profiles(release_id),mode TEXT NOT NULL CHECK(mode IN ('EXECUTE_ONCE','INSPECT_ONLY'))) STRICT;
INSERT INTO release_profile_preparations SELECT release_id,'INSPECT_ONLY' FROM release_service_profiles;
CREATE TRIGGER immutable_release_profile_preparation BEFORE UPDATE ON release_profile_preparations BEGIN SELECT RAISE(ABORT,'RELEASE_PROFILE_PREPARATION_IMMUTABLE'); END;
CREATE TRIGGER retained_release_profile_preparation BEFORE DELETE ON release_profile_preparations BEGIN SELECT RAISE(ABORT,'RELEASE_PROFILE_PREPARATION_IMMUTABLE'); END;
DROP TRIGGER retired_source_service;
CREATE TABLE release_service_actions_v12(release_id TEXT NOT NULL REFERENCES release_service_handoffs(release_id),kind TEXT NOT NULL CHECK(kind IN ('ARM_FENCES','SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE','PROFILE_PREPARE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START','ROUTE_BIND')),request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(release_id,kind),CHECK((state='OBSERVED')=(observation_json IS NOT NULL)),CHECK((state='OBSERVED')=(observed_at IS NOT NULL))) STRICT;
INSERT INTO release_service_actions_v12 SELECT * FROM release_service_actions;
DROP TABLE release_service_actions;
ALTER TABLE release_service_actions_v12 RENAME TO release_service_actions;
CREATE TRIGGER immutable_release_service_action BEFORE UPDATE ON release_service_actions WHEN OLD.state='OBSERVED' OR NEW.release_id<>OLD.release_id OR NEW.kind<>OLD.kind OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_release_service_action BEFORE DELETE ON release_service_actions BEGIN SELECT RAISE(ABORT,'RELEASE_SERVICE_ACTION_IMMUTABLE'); END;
CREATE TRIGGER retired_source_service BEFORE UPDATE ON release_service_reservations WHEN EXISTS(SELECT 1 FROM release_service_handoffs WHERE source_release_id=OLD.release_id) AND NOT (
 NEW.state='REMOVED' AND NEW.released_at IS NOT NULL AND EXISTS(SELECT 1 FROM release_service_handoffs h JOIN release_service_actions a ON h.release_id=a.release_id WHERE h.source_release_id=OLD.release_id AND a.kind='SOURCE_CONTAINER_REMOVE' AND a.state='OBSERVED' AND json_extract(a.observation_json,'$.objectId')=OLD.instance_id AND json_extract(a.observation_json,'$.absenceVerified')=1)
) BEGIN SELECT RAISE(ABORT,'RELEASE_SOURCE_RETIRING'); END;
PRAGMA user_version=12;`;
