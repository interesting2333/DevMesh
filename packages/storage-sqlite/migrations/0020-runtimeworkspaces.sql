CREATE TABLE runtime_workspace_results (
 activation_id TEXT PRIMARY KEY REFERENCES runtime_activations(activation_id),
 allocation_operation_id TEXT NOT NULL REFERENCES workspace_allocations(operation_id),
 commit_operation_id TEXT REFERENCES repo_operations(operation_id),
 archive_operation_id TEXT UNIQUE,
 step_no INTEGER NOT NULL CHECK(step_no>0),
 content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
 output_json TEXT NOT NULL CHECK(json_valid(output_json)),
 created_at TEXT NOT NULL,
 CHECK((commit_operation_id IS NULL)=(archive_operation_id IS NULL))
) STRICT;
CREATE TRIGGER runtime_workspace_result_immutable BEFORE UPDATE ON runtime_workspace_results BEGIN
 SELECT RAISE(ABORT,'RUNTIME_WORKSPACE_RESULT_IMMUTABLE');
END;
CREATE TRIGGER runtime_workspace_result_retained BEFORE DELETE ON runtime_workspace_results BEGIN
 SELECT RAISE(ABORT,'RUNTIME_WORKSPACE_RESULT_RETAINED');
END;
