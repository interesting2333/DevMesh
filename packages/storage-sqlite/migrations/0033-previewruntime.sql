CREATE UNIQUE INDEX previews_original_start ON previews(preview_id,operation_id);
CREATE UNIQUE INDEX preview_effect_original_hash ON preview_effects(operation_id,request_hash);
CREATE TABLE preview_runtime_observations (
  preview_id TEXT NOT NULL REFERENCES previews(preview_id),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  operation_id TEXT NOT NULL REFERENCES preview_effects(operation_id),
  request_hash TEXT NOT NULL,
  fact_json TEXT NOT NULL CHECK(json_valid(fact_json)),
  checked_at TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  PRIMARY KEY(preview_id,sequence),
  FOREIGN KEY(preview_id,operation_id) REFERENCES previews(preview_id,operation_id),
  FOREIGN KEY(operation_id,request_hash) REFERENCES preview_effects(operation_id,request_hash)
) STRICT;
CREATE INDEX preview_runtime_latest ON preview_runtime_observations(preview_id,sequence DESC);
CREATE TRIGGER preview_runtime_update BEFORE UPDATE ON preview_runtime_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_RUNTIME_IMMUTABLE'); END;
CREATE TRIGGER preview_runtime_delete BEFORE DELETE ON preview_runtime_observations
BEGIN SELECT RAISE(ABORT,'PREVIEW_RUNTIME_RETAINED'); END;
