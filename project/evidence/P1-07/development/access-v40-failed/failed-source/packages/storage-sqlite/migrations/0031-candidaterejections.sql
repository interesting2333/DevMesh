CREATE TABLE candidate_rejection_results (
 result_id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 rejection_id TEXT NOT NULL,
 previous_result_id TEXT,
 classification TEXT NOT NULL CHECK(classification IN ('IN_SCOPE_DEFECT','SCOPE_CHANGE')),
 state TEXT NOT NULL CHECK(state IN ('OPEN','WITHDRAWN')),
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 created_at TEXT NOT NULL,
 UNIQUE(candidate_id,rejection_id,result_id),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(candidate_id,rejection_id,previous_result_id) REFERENCES candidate_rejection_results(candidate_id,rejection_id,result_id)
) STRICT;
CREATE TABLE candidate_rejection_current (
 rejection_id TEXT PRIMARY KEY,
 candidate_id TEXT NOT NULL,
 result_id TEXT NOT NULL,
 FOREIGN KEY(candidate_id,rejection_id,result_id) REFERENCES candidate_rejection_results(candidate_id,rejection_id,result_id)
) STRICT;
CREATE INDEX candidate_rejection_history ON candidate_rejection_results(candidate_id,rejection_id);
CREATE TABLE candidate_rejection_evidence (
 result_id TEXT NOT NULL REFERENCES candidate_rejection_results(result_id),
 artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 PRIMARY KEY(result_id,artifact_id)
) STRICT;
CREATE TRIGGER candidate_rejection_result_update BEFORE UPDATE ON candidate_rejection_results
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REJECTION_IMMUTABLE'); END;
CREATE TRIGGER candidate_rejection_result_delete BEFORE DELETE ON candidate_rejection_results
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REJECTION_IMMUTABLE'); END;
CREATE TRIGGER candidate_rejection_evidence_update BEFORE UPDATE ON candidate_rejection_evidence
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REJECTION_IMMUTABLE'); END;
CREATE TRIGGER candidate_rejection_evidence_delete BEFORE DELETE ON candidate_rejection_evidence
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REJECTION_IMMUTABLE'); END;
