CREATE TABLE public_tasks (
  task_key TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  principal_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 100),
  state TEXT NOT NULL CHECK(state IN ('QUEUED','LEASED','COMPLETED','FAILED')),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=100000),
  lease_owner TEXT,
  lease_until TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX public_tasks_queue ON public_tasks(state,created_at,task_key);
CREATE INDEX public_tasks_principal ON public_tasks(principal_id,state);
