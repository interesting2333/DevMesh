-- Original merge steps remain owned by the original work-input operation.
ALTER TABLE candidate_integrations ADD COLUMN origin_operation_id TEXT REFERENCES candidate_integrations(operation_id);
CREATE TRIGGER candidate_promotion_insert BEFORE INSERT ON candidate_integrations
WHEN NEW.origin_operation_id IS NOT NULL AND (
  NEW.purpose<>'run-candidate' OR NEW.state<>'BUILDING' OR NOT EXISTS (
    SELECT 1 FROM candidate_integrations i WHERE i.operation_id=NEW.origin_operation_id
      AND i.project_id=NEW.project_id AND i.run_id=NEW.run_id
      AND i.purpose='work-input' AND i.state='ACKNOWLEDGED' AND i.origin_operation_id IS NULL
  )
)
BEGIN SELECT RAISE(ABORT,'CANDIDATE_PROMOTION_UNPROVEN'); END;
CREATE TRIGGER candidate_promotion_immutable BEFORE UPDATE ON candidate_integrations
WHEN NEW.origin_operation_id IS NOT OLD.origin_operation_id
BEGIN SELECT RAISE(ABORT,'CANDIDATE_PROMOTION_IMMUTABLE'); END;
