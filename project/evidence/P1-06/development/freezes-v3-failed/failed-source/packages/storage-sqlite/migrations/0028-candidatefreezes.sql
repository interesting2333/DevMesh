CREATE TABLE candidate_freezes (
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
 principal_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL UNIQUE,
 revision INTEGER NOT NULL CHECK(revision>0),
 integration_operation_id TEXT NOT NULL REFERENCES candidate_integrations(operation_id),
 delivery_operation_id TEXT NOT NULL REFERENCES release_deliveries(operation_id),
 request_hash TEXT NOT NULL,
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 basis_hash TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(run_id,revision),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id)
) STRICT;
CREATE TABLE candidate_freeze_work_proofs (
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 work_id TEXT NOT NULL,
 work_verification_id TEXT NOT NULL REFERENCES work_verifications(operation_id),
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 relation TEXT NOT NULL CHECK(relation IN ('CURRENT','CARRIED','MANUAL_PENDING')),
 PRIMARY KEY(candidate_id,work_id)
) STRICT;
CREATE TABLE candidate_freeze_materials (
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 material_key TEXT NOT NULL,
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 PRIMARY KEY(candidate_id,material_key)
) STRICT;
CREATE TRIGGER candidate_freeze_update BEFORE UPDATE ON candidate_freezes
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER candidate_freeze_delete BEFORE DELETE ON candidate_freezes
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER candidate_freeze_work_update BEFORE UPDATE ON candidate_freeze_work_proofs
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER candidate_freeze_work_delete BEFORE DELETE ON candidate_freeze_work_proofs
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER candidate_freeze_material_update BEFORE UPDATE ON candidate_freeze_materials
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER candidate_freeze_material_delete BEFORE DELETE ON candidate_freeze_materials
BEGIN SELECT RAISE(ABORT,'CANDIDATE_FREEZE_IMMUTABLE'); END;
CREATE TRIGGER frozen_candidate_update BEFORE UPDATE ON release_candidates
WHEN EXISTS(SELECT 1 FROM candidate_freezes WHERE candidate_id=OLD.candidate_id)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVISION_IMMUTABLE'); END;
CREATE TRIGGER frozen_candidate_delete BEFORE DELETE ON release_candidates
WHEN EXISTS(SELECT 1 FROM candidate_freezes WHERE candidate_id=OLD.candidate_id)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVISION_IMMUTABLE'); END;
