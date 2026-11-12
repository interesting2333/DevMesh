CREATE TABLE acceptance_backend_policies (
 project_id TEXT NOT NULL REFERENCES projects(project_id),policy_hash TEXT NOT NULL,
 policy_json TEXT NOT NULL CHECK(json_valid(policy_json)),registered_by TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,policy_hash)
) STRICT;
CREATE TABLE acceptance_data_decisions (
 decision_id TEXT PRIMARY KEY,operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
 project_id TEXT NOT NULL,run_id TEXT NOT NULL,candidate_id TEXT NOT NULL,
 manifest_hash TEXT NOT NULL,review_hash TEXT NOT NULL,source_release_id TEXT NOT NULL,
 data_plan_hash TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,source_release_id) REFERENCES releases(project_id,release_id)
) STRICT;
CREATE TABLE acceptance_preparations (
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),principal_id TEXT NOT NULL,
 project_id TEXT NOT NULL,run_id TEXT NOT NULL,candidate_id TEXT NOT NULL,policy_hash TEXT NOT NULL,
 release_id TEXT NOT NULL UNIQUE,target_dataset_id TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','SENT','UNKNOWN','FAILED')),
 revision INTEGER NOT NULL CHECK(revision>0),error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 FOREIGN KEY(project_id,run_id,candidate_id) REFERENCES release_candidates(project_id,run_id,candidate_id),
 FOREIGN KEY(project_id,policy_hash) REFERENCES acceptance_backend_policies(project_id,policy_hash),
 CHECK((state IN ('UNKNOWN','FAILED'))=(error_code IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX acceptance_one_unresolved_project ON acceptance_preparations(project_id) WHERE state<>'FAILED';
CREATE TABLE acceptance_preparation_history (
 operation_id TEXT NOT NULL REFERENCES acceptance_preparations(operation_id),sequence INTEGER NOT NULL CHECK(sequence>0),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),observed_at TEXT NOT NULL,
 PRIMARY KEY(operation_id,sequence)
) STRICT;
CREATE TRIGGER acceptance_policy_update BEFORE UPDATE ON acceptance_backend_policies BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_POLICY_IMMUTABLE'); END;
CREATE TRIGGER acceptance_policy_delete BEFORE DELETE ON acceptance_backend_policies BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_POLICY_IMMUTABLE'); END;
CREATE TRIGGER acceptance_decision_update BEFORE UPDATE ON acceptance_data_decisions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_DECISION_IMMUTABLE'); END;
CREATE TRIGGER acceptance_decision_delete BEFORE DELETE ON acceptance_data_decisions BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_DECISION_IMMUTABLE'); END;
CREATE TRIGGER acceptance_preparation_update BEFORE UPDATE ON acceptance_preparations WHEN
 NEW.operation_id IS NOT OLD.operation_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.project_id IS NOT OLD.project_id OR
 NEW.run_id IS NOT OLD.run_id OR NEW.candidate_id IS NOT OLD.candidate_id OR NEW.policy_hash IS NOT OLD.policy_hash OR
 NEW.release_id IS NOT OLD.release_id OR NEW.target_dataset_id IS NOT OLD.target_dataset_id OR NEW.request_hash IS NOT OLD.request_hash OR
 NEW.request_json IS NOT OLD.request_json OR NEW.created_at IS NOT OLD.created_at OR NEW.revision<>OLD.revision+1 OR
 NOT ((OLD.state='PREPARED' AND NEW.state IN ('SENT','FAILED')) OR (OLD.state IN ('SENT','UNKNOWN') AND NEW.state='UNKNOWN'))
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_PREPARATION_IMMUTABLE'); END;
CREATE TRIGGER acceptance_preparation_delete BEFORE DELETE ON acceptance_preparations BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_PREPARATION_RETAINED'); END;
CREATE TRIGGER acceptance_history_update BEFORE UPDATE ON acceptance_preparation_history BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER acceptance_history_delete BEFORE DELETE ON acceptance_preparation_history BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_HISTORY_IMMUTABLE'); END;
