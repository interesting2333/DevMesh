CREATE TABLE content_pins (
  pin_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  created_at TEXT NOT NULL,
  released_at TEXT
) STRICT;

CREATE INDEX content_pins_active ON content_pins(content_hash) WHERE released_at IS NULL;
