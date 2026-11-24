CREATE TABLE assistant_sessions (
 session_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),turn_id TEXT NOT NULL UNIQUE REFERENCES conversation_turns(turn_id),
 input_revision INTEGER NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('READ','EDIT')),state TEXT NOT NULL CHECK(state IN ('RUNNING','READY','BLOCKED','UNKNOWN','SUPERSEDED')),
 workspace_json TEXT CHECK(workspace_json IS NULL OR json_valid(workspace_json)),result_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(result_json)),error_code TEXT,applied INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX assistant_sessions_conversation ON assistant_sessions(conversation_id,created_at);
CREATE TABLE assistant_steps (
 session_id TEXT NOT NULL REFERENCES assistant_sessions(session_id),step_no INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('SENT','RESPONDED','DONE','UNKNOWN')),
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(session_id,step_no)
) STRICT;
CREATE TABLE assistant_tool_calls (
 operation_id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES assistant_sessions(session_id),step_no INTEGER NOT NULL,ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 7),call_id TEXT NOT NULL,name TEXT NOT NULL,
 args_json TEXT NOT NULL CHECK(json_valid(args_json)),state TEXT NOT NULL CHECK(state IN ('PREPARED','RUNNING','SUCCEEDED','FAILED','UNKNOWN')),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(session_id,step_no,call_id),UNIQUE(session_id,step_no,ordinal),
 FOREIGN KEY(session_id,step_no) REFERENCES assistant_steps(session_id,step_no)
) STRICT;
CREATE TABLE assistant_applications (
 operation_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),session_id TEXT NOT NULL REFERENCES assistant_sessions(session_id),owner_id TEXT NOT NULL,
 idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('ACCEPTED','SUCCEEDED','FAILED')),plan_json TEXT NOT NULL CHECK(json_valid(plan_json)),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(owner_id,conversation_id,idempotency_key)
) STRICT;
