CREATE TABLE acceptance_commits (
 release_id TEXT PRIMARY KEY REFERENCES releases(release_id),
 preparation_operation_id TEXT NOT NULL UNIQUE REFERENCES acceptance_preparations(operation_id),
 acceptance_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 proof_hash TEXT NOT NULL,observation_sequence INTEGER NOT NULL CHECK(observation_sequence>0),
 preparation_revision INTEGER NOT NULL CHECK(preparation_revision>0),
 review_hash TEXT NOT NULL,receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)),committed_at TEXT NOT NULL,
 FOREIGN KEY(preparation_operation_id,proof_hash) REFERENCES acceptance_prepared_proofs(operation_id,proof_hash),
 FOREIGN KEY(preparation_operation_id,observation_sequence) REFERENCES acceptance_preparation_observations(operation_id,sequence)
) STRICT;

-- Dispatch state remains historical. A committed preparation is resolved without
-- changing SENT/UNKNOWN into an invented failure or removing the original row.
DROP INDEX acceptance_one_unresolved_project;
CREATE TRIGGER acceptance_one_unresolved_project BEFORE INSERT ON acceptance_preparations
WHEN NEW.state<>'FAILED' AND EXISTS(SELECT 1 FROM acceptance_preparations p WHERE p.project_id=NEW.project_id AND p.state<>'FAILED'
 AND NOT EXISTS(SELECT 1 FROM acceptance_commits c WHERE c.preparation_operation_id=p.operation_id))
BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_PREPARATION_UNRESOLVED'); END;
CREATE TRIGGER acceptance_committed_preparation BEFORE UPDATE ON acceptance_preparations
WHEN EXISTS(SELECT 1 FROM acceptance_commits WHERE preparation_operation_id=OLD.operation_id)
BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_ALREADY_COMMITTED'); END;

CREATE TABLE work_acceptance_completions (
 verification_operation_id TEXT PRIMARY KEY REFERENCES work_verifications(operation_id),
 attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(attempt_id),
 release_id TEXT NOT NULL REFERENCES acceptance_commits(release_id),
 acceptance_operation_id TEXT NOT NULL REFERENCES operations(operation_id),
 candidate_id TEXT NOT NULL REFERENCES release_candidates(candidate_id),
 automatic_evidence_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
 review_hash TEXT NOT NULL,result_ids_json TEXT NOT NULL CHECK(json_valid(result_ids_json)),
 completed_at TEXT NOT NULL
) STRICT;
CREATE TABLE release_promotion_outbox (
 release_id TEXT PRIMARY KEY REFERENCES acceptance_commits(release_id),
 acceptance_operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),created_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER acceptance_commit_update BEFORE UPDATE ON acceptance_commits BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_COMMIT_IMMUTABLE'); END;
CREATE TRIGGER acceptance_commit_delete BEFORE DELETE ON acceptance_commits BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_COMMIT_IMMUTABLE'); END;
CREATE TRIGGER work_acceptance_update BEFORE UPDATE ON work_acceptance_completions BEGIN SELECT RAISE(ABORT,'WORK_ACCEPTANCE_IMMUTABLE'); END;
CREATE TRIGGER work_acceptance_delete BEFORE DELETE ON work_acceptance_completions BEGIN SELECT RAISE(ABORT,'WORK_ACCEPTANCE_IMMUTABLE'); END;
CREATE TRIGGER promotion_intent_update BEFORE UPDATE ON release_promotion_outbox BEGIN SELECT RAISE(ABORT,'PROMOTION_INTENT_IMMUTABLE'); END;
CREATE TRIGGER promotion_intent_delete BEFORE DELETE ON release_promotion_outbox BEGIN SELECT RAISE(ABORT,'PROMOTION_INTENT_IMMUTABLE'); END;
CREATE TRIGGER release_retained BEFORE DELETE ON releases BEGIN SELECT RAISE(ABORT,'RELEASE_IMMUTABLE'); END;
