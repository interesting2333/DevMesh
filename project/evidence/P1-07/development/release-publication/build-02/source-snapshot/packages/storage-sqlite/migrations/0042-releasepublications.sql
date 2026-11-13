CREATE TABLE release_publications (
 sequence INTEGER PRIMARY KEY,release_id TEXT NOT NULL UNIQUE REFERENCES release_promotion_outbox(release_id),
 state TEXT NOT NULL CHECK(state IN ('PENDING','SENT','UNKNOWN','PUBLISHED')),revision INTEGER NOT NULL CHECK(revision>0),observation_sequence INTEGER NOT NULL CHECK(observation_sequence>=0),
 basis_json TEXT CHECK(basis_json IS NULL OR json_valid(basis_json)),proof_hash TEXT,error_code TEXT,created_at TEXT NOT NULL,dispatched_at TEXT,updated_at TEXT NOT NULL,published_at TEXT,
 FOREIGN KEY(release_id,proof_hash) REFERENCES release_publication_proofs(release_id,proof_hash),
 CHECK((state='PENDING')=(basis_json IS NULL)),CHECK((state='PENDING')=(dispatched_at IS NULL)),
 CHECK((state='UNKNOWN')=(error_code IS NOT NULL)),CHECK((state='PUBLISHED')=(proof_hash IS NOT NULL)),CHECK((state='PUBLISHED')=(published_at IS NOT NULL))
) STRICT;
CREATE TABLE release_publication_events (
 release_id TEXT NOT NULL REFERENCES release_publications(release_id),revision INTEGER NOT NULL,state TEXT NOT NULL,error_code TEXT,observed_at TEXT NOT NULL,
 PRIMARY KEY(release_id,revision)
) STRICT;
CREATE TABLE release_publication_observations (
 release_id TEXT NOT NULL REFERENCES release_publications(release_id),sequence INTEGER NOT NULL CHECK(sequence>0),expected_revision INTEGER NOT NULL CHECK(expected_revision>0),
 observation_hash TEXT NOT NULL,observation_json TEXT NOT NULL CHECK(json_valid(observation_json)),observed_at TEXT NOT NULL,PRIMARY KEY(release_id,sequence)
) STRICT;
CREATE TABLE release_publication_proofs (
 release_id TEXT PRIMARY KEY REFERENCES release_publications(release_id),promotion_request_hash TEXT NOT NULL,proof_hash TEXT NOT NULL,proof_json TEXT NOT NULL CHECK(json_valid(proof_json)),
 target_dataset_id TEXT NOT NULL REFERENCES preview_write_gates(dataset_id),target_gate_fence INTEGER NOT NULL CHECK(target_gate_fence>=0),target_gate_revision INTEGER NOT NULL CHECK(target_gate_revision>=0),published_at TEXT NOT NULL,
 UNIQUE(release_id,proof_hash)
) STRICT;
-- Only the intent is historical fact. Never backfill a dispatch or live proof.
INSERT INTO release_publications(release_id,state,revision,observation_sequence,created_at,updated_at) SELECT release_id,'PENDING',1,0,created_at,created_at FROM release_promotion_outbox;
INSERT INTO release_publication_events SELECT release_id,1,'PENDING',NULL,created_at FROM release_publications;
CREATE TRIGGER release_publication_enroll AFTER INSERT ON release_promotion_outbox BEGIN
 INSERT INTO release_publications(release_id,state,revision,observation_sequence,created_at,updated_at) VALUES(NEW.release_id,'PENDING',1,0,NEW.created_at,NEW.created_at);
 INSERT INTO release_publication_events VALUES(NEW.release_id,1,'PENDING',NULL,NEW.created_at);
END;
CREATE TRIGGER release_publication_insert BEFORE INSERT ON release_publications WHEN NEW.state<>'PENDING' OR NEW.revision<>1 OR NEW.observation_sequence<>0 OR NEW.basis_json IS NOT NULL OR NEW.proof_hash IS NOT NULL OR NEW.error_code IS NOT NULL OR NEW.dispatched_at IS NOT NULL OR NEW.published_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM release_promotion_outbox o WHERE o.release_id=NEW.release_id AND o.created_at=NEW.created_at AND o.created_at=NEW.updated_at) BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_IDENTITY_CHANGED'); END;
CREATE TRIGGER release_publication_update BEFORE UPDATE ON release_publications WHEN
 NEW.sequence<>OLD.sequence OR NEW.release_id IS NOT OLD.release_id OR NEW.created_at IS NOT OLD.created_at OR NEW.revision<>OLD.revision+1 OR OLD.state='PUBLISHED' OR
 (OLD.basis_json IS NOT NULL AND NEW.basis_json IS NOT OLD.basis_json) OR (OLD.dispatched_at IS NOT NULL AND NEW.dispatched_at IS NOT OLD.dispatched_at) OR
 NOT ((OLD.state='PENDING' AND NEW.state='SENT' AND NEW.observation_sequence=0) OR (OLD.state IN ('SENT','UNKNOWN') AND NEW.state IN ('UNKNOWN','PUBLISHED') AND NEW.observation_sequence=OLD.observation_sequence+1))
BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_IMMUTABLE'); END;
CREATE TRIGGER release_publication_delete BEFORE DELETE ON release_publications BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_RETAINED'); END;
CREATE TRIGGER release_publication_event_update BEFORE UPDATE ON release_publication_events BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER release_publication_event_delete BEFORE DELETE ON release_publication_events BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_HISTORY_RETAINED'); END;
CREATE TRIGGER release_publication_observation_insert BEFORE INSERT ON release_publication_observations WHEN NOT EXISTS(SELECT 1 FROM release_publications p WHERE p.release_id=NEW.release_id AND p.state IN ('SENT','UNKNOWN') AND p.revision=NEW.expected_revision AND p.observation_sequence+1=NEW.sequence) BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_OBSERVATION_CHANGED'); END;
CREATE TRIGGER release_publication_observation_update BEFORE UPDATE ON release_publication_observations BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_OBSERVATION_IMMUTABLE'); END;
CREATE TRIGGER release_publication_observation_delete BEFORE DELETE ON release_publication_observations BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_OBSERVATION_RETAINED'); END;
CREATE TRIGGER release_publication_proof_insert BEFORE INSERT ON release_publication_proofs WHEN NOT EXISTS(
 SELECT 1 FROM release_publications p JOIN release_promotion_outbox o ON o.release_id=p.release_id JOIN releases r ON r.release_id=p.release_id JOIN acceptance_commits c ON c.release_id=r.release_id JOIN projects j ON j.project_id=r.project_id JOIN preview_write_gates g ON g.dataset_id=r.prepared_data_ref
 WHERE p.release_id=NEW.release_id AND p.state IN ('SENT','UNKNOWN') AND o.request_hash=NEW.promotion_request_hash AND j.accepted_release_id=r.release_id
 AND g.state='CLOSED' AND g.dataset_id=NEW.target_dataset_id AND g.fence=NEW.target_gate_fence AND g.revision=NEW.target_gate_revision
 AND g.dataset_operation_id=c.preparation_operation_id AND g.dataset_request_hash=json_extract(o.request_json,'$.preparedProof.requestHash')
  AND g.close_operation_id IS NULL AND g.close_request_hash IS NULL
 AND json_extract(p.basis_json,'$.targetGate.datasetId')=g.dataset_id AND json_extract(p.basis_json,'$.targetGate.fence')=g.fence AND json_extract(p.basis_json,'$.targetGate.revision')=g.revision
 AND json_extract(NEW.proof_json,'$.releaseId')=r.release_id AND json_extract(NEW.proof_json,'$.promotionRequestHash')=o.request_hash AND json_extract(NEW.proof_json,'$.preparedProofHash')=c.proof_hash
  AND json_extract(NEW.proof_json,'$.gates')=json(p.basis_json)
  AND EXISTS(SELECT 1 FROM release_publication_observations v WHERE v.release_id=p.release_id AND v.sequence=p.observation_sequence+1 AND v.expected_revision=p.revision AND json_extract(v.observation_json,'$.state')='PUBLISHED' AND json_extract(v.observation_json,'$.proof')=json(NEW.proof_json))
  AND (json_extract(o.request_json,'$.preparation.source') IS NULL OR EXISTS(
   SELECT 1 FROM preview_write_gates s WHERE s.dataset_id=json_extract(o.request_json,'$.preparation.source.datasetId') AND s.state='CLOSED'
   AND s.dataset_operation_id=json_extract(o.request_json,'$.preparation.source.datasetOperationId') AND s.close_operation_id=c.preparation_operation_id
   AND s.dataset_id=json_extract(p.basis_json,'$.sourceGate.datasetId') AND s.dataset_request_hash=json_extract(p.basis_json,'$.sourceGate.datasetRequestHash')
   AND s.fence=json_extract(p.basis_json,'$.sourceGate.fence') AND s.revision=json_extract(p.basis_json,'$.sourceGate.revision')
   AND s.close_request_hash=json_extract(p.basis_json,'$.sourceGate.closeRequestHash')
  ))
  AND NOT EXISTS(SELECT 1 FROM preview_access_requests w WHERE w.is_write=1 AND w.state IN ('DISPATCHED','UNKNOWN') AND (w.dataset_id=g.dataset_id OR w.dataset_id=json_extract(o.request_json,'$.preparation.source.datasetId')))
 AND NOT EXISTS(SELECT 1 FROM acceptance_abort_decisions a WHERE a.preparation_operation_id=c.preparation_operation_id)
) BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_PROOF_CHANGED'); END;
CREATE TRIGGER release_publication_proof_update BEFORE UPDATE ON release_publication_proofs BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_PROOF_IMMUTABLE'); END;
CREATE TRIGGER release_publication_proof_delete BEFORE DELETE ON release_publication_proofs BEGIN SELECT RAISE(ABORT,'RELEASE_PUBLICATION_PROOF_RETAINED'); END;

DROP TRIGGER preview_write_gate_update;
CREATE TRIGGER preview_write_gate_update BEFORE UPDATE ON preview_write_gates WHEN
 NEW.dataset_id IS NOT OLD.dataset_id OR NEW.project_id IS NOT OLD.project_id OR NEW.dataset_operation_id IS NOT OLD.dataset_operation_id OR NEW.dataset_request_hash IS NOT OLD.dataset_request_hash OR NEW.created_at IS NOT OLD.created_at OR NEW.fence<>OLD.fence+1 OR NEW.revision<>OLD.revision+1 OR
 NOT ((OLD.state='OPEN' AND NEW.state='CLOSED') OR
 (OLD.state='CLOSED' AND NEW.state='OPEN' AND NEW.close_operation_id IS NULL AND NEW.close_request_hash IS NULL AND (
 EXISTS(SELECT 1 FROM acceptance_abort_completions a WHERE a.preparation_operation_id=OLD.close_operation_id AND a.source_dataset_id=OLD.dataset_id AND a.source_gate_revision=OLD.revision AND a.source_gate_fence=OLD.fence AND a.source_close_operation_id=OLD.close_operation_id AND a.source_close_request_hash=OLD.close_request_hash) OR
 EXISTS(SELECT 1 FROM release_publication_proofs p JOIN releases r ON r.release_id=p.release_id JOIN projects j ON j.project_id=r.project_id WHERE p.target_dataset_id=OLD.dataset_id AND p.target_gate_revision=OLD.revision AND p.target_gate_fence=OLD.fence AND j.accepted_release_id=r.release_id AND r.prepared_data_ref=OLD.dataset_id AND OLD.close_operation_id IS NULL AND OLD.close_request_hash IS NULL)
 )))
BEGIN
 SELECT CASE WHEN NEW.state='OPEN' AND EXISTS(SELECT 1 FROM acceptance_preparations p JOIN acceptance_abort_decisions a ON a.preparation_operation_id=p.operation_id WHERE p.target_dataset_id=NEW.dataset_id) THEN RAISE(ABORT,'ACCEPTANCE_ABORT_REQUESTED') END;
 SELECT RAISE(ABORT,'PREVIEW_WRITE_GATE_IMMUTABLE');
END;
