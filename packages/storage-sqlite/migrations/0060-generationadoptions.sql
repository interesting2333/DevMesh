CREATE TABLE conversation_generation_adoptions (
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
 conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),
 input_revision INTEGER NOT NULL,
 old_project_id TEXT NOT NULL REFERENCES projects(project_id),
 old_run_id TEXT NOT NULL REFERENCES runs(run_id),
 created_at TEXT NOT NULL,
 UNIQUE(conversation_id,input_revision)
) STRICT;
