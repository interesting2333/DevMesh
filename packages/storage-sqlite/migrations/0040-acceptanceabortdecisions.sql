-- A decision barrier only. It never proves physical cleanup or releases occupancy.
CREATE TABLE acceptance_abort_decisions (
 preparation_operation_id TEXT PRIMARY KEY REFERENCES acceptance_preparations(operation_id),
 abort_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),request_hash TEXT NOT NULL,
 decision_hash TEXT NOT NULL UNIQUE,decision_json TEXT NOT NULL CHECK(json_valid(decision_json)),
 prepared_proof_hash TEXT,decided_at TEXT NOT NULL,
 FOREIGN KEY(preparation_operation_id,prepared_proof_hash) REFERENCES acceptance_prepared_proofs(operation_id,proof_hash)
) STRICT;
CREATE TRIGGER acceptance_abort_decision_insert BEFORE INSERT ON acceptance_abort_decisions WHEN
 NOT EXISTS(SELECT 1 FROM acceptance_preparations p WHERE p.operation_id=NEW.preparation_operation_id AND p.state IN ('SENT','UNKNOWN') AND p.request_hash=NEW.request_hash
 AND p.revision=json_extract(NEW.decision_json,'$.preparationRevision') AND p.request_json=json_extract(NEW.decision_json,'$.preparation')
 AND NEW.abort_operation_id=json_extract(NEW.decision_json,'$.operationId') AND NEW.request_hash=json_extract(NEW.decision_json,'$.preparationRequestHash')
 AND NEW.prepared_proof_hash IS json_extract(NEW.decision_json,'$.preparedProofHash') AND NEW.decided_at=json_extract(NEW.decision_json,'$.decidedAt')
 AND NEW.prepared_proof_hash IS (SELECT proof_hash FROM acceptance_prepared_proofs WHERE operation_id=p.operation_id)
 AND NOT EXISTS(SELECT 1 FROM acceptance_commits c WHERE c.preparation_operation_id=p.operation_id)
 AND NOT EXISTS(SELECT 1 FROM releases r WHERE r.release_id=p.release_id OR r.prepared_data_ref=p.target_dataset_id))
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_BASIS_CHANGED'); END;
CREATE TRIGGER acceptance_abort_decision_update BEFORE UPDATE ON acceptance_abort_decisions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_IMMUTABLE'); END;
CREATE TRIGGER acceptance_abort_decision_delete BEFORE DELETE ON acceptance_abort_decisions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_RETAINED'); END;
CREATE TRIGGER acceptance_aborting_preparation BEFORE UPDATE ON acceptance_preparations
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=OLD.operation_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_proof BEFORE INSERT ON acceptance_prepared_proofs
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=NEW.operation_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_observation BEFORE INSERT ON acceptance_preparation_observations
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=NEW.operation_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_release BEFORE INSERT ON releases
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions a JOIN acceptance_preparations p ON p.operation_id=a.preparation_operation_id WHERE p.release_id=NEW.release_id OR p.target_dataset_id=NEW.prepared_data_ref)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_commit BEFORE INSERT ON acceptance_commits
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=NEW.preparation_operation_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_source_close BEFORE INSERT ON preview_write_closures
 WHEN EXISTS(SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=NEW.operation_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
CREATE TRIGGER acceptance_aborting_target_open BEFORE UPDATE ON preview_write_gates
 WHEN NEW.state='OPEN' AND EXISTS(SELECT 1 FROM acceptance_abort_decisions a JOIN acceptance_preparations p ON p.operation_id=a.preparation_operation_id WHERE p.target_dataset_id=NEW.dataset_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED'); END;
