CREATE TABLE workspace_reclamations (
 operation_id TEXT PRIMARY KEY,
 preservation_operation_id TEXT NOT NULL REFERENCES workspace_preservations(operation_id),
 workspace_ref TEXT NOT NULL UNIQUE REFERENCES workspace_allocations(workspace_ref),
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 principal_id TEXT NOT NULL,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','ISOLATION_SENT','ISOLATED','DELETE_SENT','DELETED')),
 isolation_intent_hash TEXT CHECK(isolation_intent_hash IS NULL OR length(isolation_intent_hash)=64),
 isolation_proof_json TEXT CHECK(isolation_proof_json IS NULL OR json_valid(isolation_proof_json)),
 delete_intent_hash TEXT CHECK(delete_intent_hash IS NULL OR length(delete_intent_hash)=64),
 deletion_proof_json TEXT CHECK(deletion_proof_json IS NULL OR json_valid(deletion_proof_json)),
 error_code TEXT,
 created_at TEXT NOT NULL,
 CHECK((state IN ('ISOLATION_SENT','ISOLATED','DELETE_SENT','DELETED'))=(isolation_intent_hash IS NOT NULL)),
 CHECK((state IN ('ISOLATED','DELETE_SENT','DELETED'))=(isolation_proof_json IS NOT NULL)),
 CHECK((state IN ('DELETE_SENT','DELETED'))=(delete_intent_hash IS NOT NULL)),
 CHECK((state='DELETED')=(deletion_proof_json IS NOT NULL))
) STRICT;
CREATE TRIGGER workspace_reclamation_identity BEFORE UPDATE ON workspace_reclamations
WHEN NEW.operation_id<>OLD.operation_id OR NEW.preservation_operation_id<>OLD.preservation_operation_id OR NEW.workspace_ref<>OLD.workspace_ref
 OR NEW.project_id<>OLD.project_id OR NEW.principal_id<>OLD.principal_id OR NEW.request_hash<>OLD.request_hash OR NEW.basis_json<>OLD.basis_json OR NEW.created_at<>OLD.created_at
 OR (OLD.isolation_intent_hash IS NOT NULL AND NEW.isolation_intent_hash IS NOT OLD.isolation_intent_hash)
 OR (OLD.isolation_proof_json IS NOT NULL AND NEW.isolation_proof_json IS NOT OLD.isolation_proof_json)
 OR (OLD.delete_intent_hash IS NOT NULL AND NEW.delete_intent_hash IS NOT OLD.delete_intent_hash)
 OR (OLD.deletion_proof_json IS NOT NULL AND NEW.deletion_proof_json IS NOT OLD.deletion_proof_json)
 OR (NEW.state<>OLD.state AND NOT (
  (OLD.state='PREPARED' AND NEW.state='ISOLATION_SENT') OR (OLD.state='ISOLATION_SENT' AND NEW.state='ISOLATED')
  OR (OLD.state='ISOLATED' AND NEW.state='DELETE_SENT') OR (OLD.state='DELETE_SENT' AND NEW.state='DELETED')
 ))
BEGIN SELECT RAISE(ABORT,'WORKSPACE_RECLAMATION_IMMUTABLE'); END;
CREATE TRIGGER workspace_reclamation_preserve BEFORE DELETE ON workspace_reclamations
BEGIN SELECT RAISE(ABORT,'WORKSPACE_RECLAMATION_IMMUTABLE'); END;
