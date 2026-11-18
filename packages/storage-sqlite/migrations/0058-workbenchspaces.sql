CREATE TABLE workbench_spaces (
 space_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,client_id TEXT,
 name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',directory_json TEXT NOT NULL DEFAULT 'null' CHECK(json_valid(directory_json)),
 revision INTEGER NOT NULL DEFAULT 1,is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
 deleted_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(owner_id,client_id)
) STRICT;
CREATE UNIQUE INDEX workbench_spaces_default ON workbench_spaces(owner_id) WHERE is_default=1;
INSERT INTO workbench_spaces(space_id,owner_id,name,is_default,created_at,updated_at)
 SELECT 'space_'||lower(hex(randomblob(16))),owner,'默认工作空间',1,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM (SELECT owner_id owner FROM conversations UNION SELECT owner_id FROM projects UNION SELECT owner_id FROM attachments);
ALTER TABLE conversations ADD COLUMN space_id TEXT REFERENCES workbench_spaces(space_id);
ALTER TABLE conversations ADD COLUMN directory_binding_json TEXT NOT NULL DEFAULT 'null' CHECK(json_valid(directory_binding_json));
UPDATE conversations SET space_id=(SELECT s.space_id FROM workbench_spaces s WHERE s.owner_id=conversations.owner_id AND s.is_default=1);
CREATE INDEX conversations_space ON conversations(owner_id,space_id,updated_at,conversation_id) WHERE deleted_at IS NULL;
CREATE TABLE workbench_conversation_moves (
 operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),
 from_space_id TEXT NOT NULL REFERENCES workbench_spaces(space_id),to_space_id TEXT NOT NULL REFERENCES workbench_spaces(space_id),created_at TEXT NOT NULL
) STRICT;
CREATE TABLE workbench_run_sources (
 run_id TEXT PRIMARY KEY REFERENCES runs(run_id),conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),binding_json TEXT NOT NULL CHECK(json_valid(binding_json))
) STRICT;
