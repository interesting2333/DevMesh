CREATE TABLE candidate_review_results (
 result_id TEXT PRIMARY KEY,
 operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 project_id TEXT NOT NULL,
 run_id TEXT NOT NULL,
 candidate_id TEXT NOT NULL REFERENCES candidate_freezes(candidate_id),
 item_id TEXT NOT NULL,
 item_hash TEXT NOT NULL,
 previous_result_id TEXT,
 principal_id TEXT NOT NULL,
 verdict TEXT NOT NULL CHECK(verdict IN ('PASS','FAIL')),
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 created_at TEXT NOT NULL,
 UNIQUE(candidate_id,item_id,result_id),
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(candidate_id,item_id,previous_result_id) REFERENCES candidate_review_results(candidate_id,item_id,result_id)
) STRICT;
CREATE INDEX candidate_review_history ON candidate_review_results(candidate_id,item_id);
CREATE TABLE candidate_review_current (
 candidate_id TEXT NOT NULL,
 item_id TEXT NOT NULL,
 result_id TEXT NOT NULL,
 PRIMARY KEY(candidate_id,item_id),
 FOREIGN KEY(candidate_id,item_id,result_id) REFERENCES candidate_review_results(candidate_id,item_id,result_id)
) STRICT;
CREATE TABLE candidate_review_evidence (
 result_id TEXT NOT NULL REFERENCES candidate_review_results(result_id),
 artifact_id TEXT NOT NULL REFERENCES artifacts(artifact_id),
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 PRIMARY KEY(result_id,artifact_id)
) STRICT;
CREATE TRIGGER candidate_review_result_update BEFORE UPDATE ON candidate_review_results
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER candidate_review_result_delete BEFORE DELETE ON candidate_review_results
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER candidate_review_evidence_update BEFORE UPDATE ON candidate_review_evidence
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER candidate_review_evidence_delete BEFORE DELETE ON candidate_review_evidence
BEGIN SELECT RAISE(ABORT,'CANDIDATE_REVIEW_IMMUTABLE'); END;
