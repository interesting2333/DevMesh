CREATE TABLE agent_exposures (
  exposure_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  agent_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  state TEXT NOT NULL CHECK(state IN ('DRAFT','VALIDATED','PUBLISHED','DRAINING','RETIRED')),
  card_json TEXT NOT NULL CHECK(json_valid(card_json) AND length(card_json)<=20000),
  card_hash TEXT NOT NULL CHECK(length(card_hash)=64),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(project_id,agent_key)
) STRICT;

CREATE INDEX agent_exposures_state ON agent_exposures(project_id,state);