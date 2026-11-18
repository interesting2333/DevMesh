ALTER TABLE conversations ADD COLUMN deleted_at TEXT;
CREATE INDEX conversations_visible ON conversations(owner_id,updated_at,conversation_id) WHERE deleted_at IS NULL;
