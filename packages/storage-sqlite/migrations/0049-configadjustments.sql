CREATE TABLE config_control (
  singleton_id INTEGER PRIMARY KEY CHECK(singleton_id=1),
  generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>0),
  updated_at TEXT NOT NULL
) STRICT;
INSERT INTO config_control(singleton_id,generation,updated_at) VALUES(1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE TABLE config_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  base_generation INTEGER NOT NULL CHECK(base_generation>0),
  state TEXT NOT NULL CHECK(state IN ('PROPOSED','CONFIRMED','REJECTED')),
  config_json TEXT NOT NULL CHECK(json_valid(config_json) AND length(config_json)<=20000),
  applied_generation INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(run_id,adjustment_id),
  FOREIGN KEY(project_id,run_id) REFERENCES runs(project_id,run_id)
) STRICT;
CREATE INDEX config_adjustments_run ON config_adjustments(run_id,created_at,adjustment_id);
