CREATE TABLE acceptance_data_confirmations (
 decision_id TEXT NOT NULL REFERENCES acceptance_data_decisions(decision_id),
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
 project_id TEXT NOT NULL,run_id TEXT NOT NULL,candidate_id TEXT NOT NULL,
 manifest_hash TEXT NOT NULL,review_hash TEXT NOT NULL,source_release_id TEXT NOT NULL,
 data_plan_hash TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(decision_id,review_hash),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,source_release_id) REFERENCES releases(project_id,release_id)
) STRICT;
INSERT INTO acceptance_data_confirmations SELECT * FROM acceptance_data_decisions;
CREATE TRIGGER acceptance_confirmation_insert BEFORE INSERT ON acceptance_data_confirmations
 WHEN NOT EXISTS(SELECT 1 FROM acceptance_data_decisions d WHERE
 d.decision_id=NEW.decision_id AND d.project_id=NEW.project_id AND d.run_id=NEW.run_id AND
 d.candidate_id=NEW.candidate_id AND d.manifest_hash=NEW.manifest_hash AND
 d.source_release_id=NEW.source_release_id AND d.data_plan_hash=NEW.data_plan_hash AND d.actor_id=NEW.actor_id)
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_CONFIRMATION_BASIS_CHANGED'); END;
CREATE TRIGGER acceptance_confirmation_update BEFORE UPDATE ON acceptance_data_confirmations
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_CONFIRMATION_IMMUTABLE'); END;
CREATE TRIGGER acceptance_confirmation_delete BEFORE DELETE ON acceptance_data_confirmations
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_CONFIRMATION_IMMUTABLE'); END;
