CREATE TABLE conversations (
 conversation_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, client_id TEXT NOT NULL,
 title TEXT NOT NULL, project_id TEXT REFERENCES projects(project_id),run_id TEXT REFERENCES runs(run_id),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('EXECUTE','PLAN')),
 state TEXT NOT NULL DEFAULT 'IDLE', revision INTEGER NOT NULL DEFAULT 1,input_revision INTEGER NOT NULL DEFAULT 0,last_seq INTEGER NOT NULL DEFAULT 0,
 block_reason TEXT,last_observed TEXT,token_usage INTEGER NOT NULL DEFAULT 0,manual_pause INTEGER NOT NULL DEFAULT 0,last_control_seq INTEGER NOT NULL DEFAULT 0,
 resume_requested INTEGER NOT NULL DEFAULT 0,resume_waiting_input INTEGER NOT NULL DEFAULT 0,resume_key TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(owner_id,client_id)
) STRICT;
CREATE TABLE conversation_messages (
 message_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),seq INTEGER NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('user','assistant','progress')),text TEXT NOT NULL,attachments_json TEXT NOT NULL CHECK(json_valid(attachments_json)),
 client_id TEXT,turn_id TEXT,basis_json TEXT NOT NULL DEFAULT 'null',created_at TEXT NOT NULL,
 UNIQUE(conversation_id,seq),UNIQUE(conversation_id,client_id)
) STRICT;
CREATE TABLE conversation_turns (
 turn_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),input_revision INTEGER NOT NULL,
 trigger_key TEXT NOT NULL,state TEXT NOT NULL,claim_token TEXT,request_json TEXT,raw_response_json TEXT,response_json TEXT,
 action_key TEXT NOT NULL,action_json TEXT,result_json TEXT,error_code TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(conversation_id,trigger_key)
) STRICT;
CREATE TABLE conversation_authorizations (
 authorization_id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),input_revision INTEGER NOT NULL,
 actor TEXT NOT NULL,mode TEXT NOT NULL,scope_text TEXT NOT NULL,run_id TEXT REFERENCES runs(run_id),created_at TEXT NOT NULL,
 UNIQUE(conversation_id,input_revision)
) STRICT;
CREATE TABLE conversation_plan_admissions (
 run_id TEXT NOT NULL REFERENCES runs(run_id),plan_revision INTEGER NOT NULL,requirement_revision INTEGER NOT NULL,
 authorization_id TEXT NOT NULL REFERENCES conversation_authorizations(authorization_id),review_hash TEXT NOT NULL,
 actor TEXT NOT NULL,operation_id TEXT NOT NULL REFERENCES operations(operation_id),created_at TEXT NOT NULL,PRIMARY KEY(run_id,plan_revision)
) STRICT;
CREATE VIEW plan_execution_admissions AS
 SELECT run_id,plan_revision,requirement_revision,review_hash,actor,operation_id,created_at,'MANUAL' AS authorization_kind FROM plan_confirmations
 UNION ALL
 SELECT a.run_id,a.plan_revision,a.requirement_revision,a.review_hash,a.actor,a.operation_id,a.created_at,'EXECUTE' AS authorization_kind FROM conversation_plan_admissions a
 WHERE NOT EXISTS(SELECT 1 FROM plan_confirmations c WHERE c.run_id=a.run_id AND c.plan_revision=a.plan_revision);
CREATE INDEX conversations_owner ON conversations(owner_id,updated_at,conversation_id);
CREATE INDEX conversation_turns_pending ON conversation_turns(state,created_at);
CREATE TABLE conversation_changes (
 change_id TEXT PRIMARY KEY REFERENCES change_proposals(change_id),conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),
 turn_id TEXT NOT NULL UNIQUE REFERENCES conversation_turns(turn_id),input_revision INTEGER NOT NULL,
 goal_text TEXT NOT NULL,attachments_json TEXT NOT NULL,pause_key TEXT NOT NULL,adopt_key TEXT NOT NULL,
 applied_operation_id TEXT REFERENCES operations(operation_id),created_at TEXT NOT NULL
) STRICT;
