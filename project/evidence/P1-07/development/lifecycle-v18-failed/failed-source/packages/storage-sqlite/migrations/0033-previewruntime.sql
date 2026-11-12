CREATE TABLE preview_runtime_observations (
  preview_id TEXT NOT NULL REFERENCES previews(preview_id),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  operation_id TEXT NOT NULL REFERENCES preview_effects(operation_id),
  request_hash TEXT NOT NULL,
  fact_json TEXT NOT NULL CHECK(json_valid(fact_json)),
  checked_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  PRIMARY KEY(preview_id,sequence)
) STRICT;
CREATE INDEX preview_runtime_latest ON preview_runtime_observations(preview_id,sequence DESC);
CREATE TRIGGER preview_runtime_update BEFORE UPDATE ON preview_runtime_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_RUNTIME_IMMUTABLE'); END;
CREATE TRIGGER preview_runtime_delete BEFORE DELETE ON preview_runtime_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_RUNTIME_RETAINED'); END;
