CREATE TABLE runtime_activations (
 activation_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(attempt_id),
 grant_id TEXT NOT NULL REFERENCES execution_grants(grant_id), session_id TEXT NOT NULL REFERENCES agent_sessions(session_id),
 endpoint_id TEXT NOT NULL, task_id TEXT NOT NULL, worker_id TEXT NOT NULL, claim_token TEXT NOT NULL,
 config_hash TEXT NOT NULL, config_json TEXT NOT NULL CHECK(json_valid(config_json)),
 max_steps INTEGER NOT NULL CHECK(max_steps>0), token_limit INTEGER NOT NULL CHECK(token_limit>0),
 tokens_used INTEGER NOT NULL DEFAULT 0 CHECK(tokens_used>=0), unknown_usage INTEGER NOT NULL DEFAULT 0 CHECK(unknown_usage IN (0,1)),
 state TEXT NOT NULL CHECK(state IN ('RUNNING','WAITING','FINISHED','FAILED','RECONCILE')),
 reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 FOREIGN KEY(attempt_id,activation_id) REFERENCES execution_grants(attempt_id,activation_id),
 FOREIGN KEY(endpoint_id,task_id) REFERENCES a2a_tasks(endpoint_id,task_id)
) STRICT;
CREATE TABLE runtime_model_accounting (
 session_id TEXT NOT NULL, step_no INTEGER NOT NULL, activation_id TEXT NOT NULL REFERENCES runtime_activations(activation_id),
 input_tokens INTEGER NOT NULL CHECK(input_tokens>=0), output_tokens INTEGER NOT NULL CHECK(output_tokens>=0),
 source TEXT NOT NULL CHECK(source IN ('provider','estimated')), created_at TEXT NOT NULL,
 PRIMARY KEY(session_id,step_no), FOREIGN KEY(session_id,step_no) REFERENCES model_steps(session_id,step_no)
) STRICT;
CREATE TABLE runtime_tool_calls (
 operation_id TEXT PRIMARY KEY REFERENCES tool_operations(operation_id),
 activation_id TEXT NOT NULL REFERENCES runtime_activations(activation_id),
 session_id TEXT NOT NULL, step_no INTEGER NOT NULL, tool_call_id TEXT NOT NULL,
 args_hash TEXT NOT NULL REFERENCES content_objects(content_hash), response_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 result_message_id TEXT REFERENCES session_messages(message_id),
 state TEXT NOT NULL CHECK(state IN ('PREPARED','SENT','SUCCEEDED','FAILED','OUTCOME_UNKNOWN')),
 error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(session_id,step_no,tool_call_id), FOREIGN KEY(session_id,step_no) REFERENCES model_steps(session_id,step_no)
) STRICT;
CREATE TRIGGER immutable_runtime_configuration BEFORE UPDATE ON runtime_activations
 WHEN NEW.activation_id<>OLD.activation_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.grant_id<>OLD.grant_id OR NEW.session_id<>OLD.session_id OR NEW.config_hash<>OLD.config_hash OR NEW.config_json<>OLD.config_json OR NEW.max_steps<>OLD.max_steps OR NEW.token_limit<>OLD.token_limit OR NEW.endpoint_id<>OLD.endpoint_id OR NEW.task_id<>OLD.task_id OR NEW.worker_id<>OLD.worker_id OR NEW.claim_token<>OLD.claim_token
 BEGIN SELECT RAISE(ABORT,'RUNTIME_CONFIGURATION_IMMUTABLE'); END;
CREATE TRIGGER immutable_runtime_tool_identity BEFORE UPDATE ON runtime_tool_calls
 WHEN NEW.activation_id<>OLD.activation_id OR NEW.session_id<>OLD.session_id OR NEW.step_no<>OLD.step_no OR NEW.tool_call_id<>OLD.tool_call_id OR NEW.args_hash<>OLD.args_hash OR NEW.response_hash<>OLD.response_hash
 BEGIN SELECT RAISE(ABORT,'RUNTIME_TOOL_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER immutable_runtime_accounting BEFORE UPDATE ON runtime_model_accounting
 BEGIN SELECT RAISE(ABORT,'RUNTIME_ACCOUNTING_IMMUTABLE'); END;
CREATE TABLE runtime_results (
 activation_id TEXT PRIMARY KEY REFERENCES runtime_activations(activation_id),
 artifact_id TEXT NOT NULL UNIQUE REFERENCES artifacts(artifact_id),
 step_no INTEGER NOT NULL, session_id TEXT NOT NULL,
 FOREIGN KEY(session_id,step_no) REFERENCES model_steps(session_id,step_no)
) STRICT;
