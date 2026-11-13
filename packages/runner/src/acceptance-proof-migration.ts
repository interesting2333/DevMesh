// Forward-only v8. The original v2-v7 migrations and stored hashes stay intact.
export const acceptanceProofMigration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v7;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=8)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,8 FROM runner_identity_v7;
DROP TABLE runner_identity_v7;
CREATE TABLE acceptance_service_proofs(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,profile_hash TEXT NOT NULL,proof_hash TEXT NOT NULL,proof_json TEXT NOT NULL CHECK(json_valid(proof_json)),created_at TEXT NOT NULL,FOREIGN KEY(reservation_id,request_hash) REFERENCES acceptance_services(reservation_id,request_hash),FOREIGN KEY(reservation_id,profile_hash) REFERENCES acceptance_service_profiles(reservation_id,profile_hash)) STRICT;
CREATE TRIGGER immutable_acceptance_proof_update BEFORE UPDATE ON acceptance_service_proofs BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROOF_IMMUTABLE'); END;
CREATE TRIGGER immutable_acceptance_proof_delete BEFORE DELETE ON acceptance_service_proofs BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_SERVICE_PROOF_IMMUTABLE'); END;
PRAGMA user_version=8;`;
