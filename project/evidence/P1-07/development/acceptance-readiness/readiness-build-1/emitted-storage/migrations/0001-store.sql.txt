CREATE TABLE store_metadata (
  singleton_id INTEGER PRIMARY KEY CHECK(singleton_id=1),
  store_id TEXT NOT NULL UNIQUE,
  layout_version INTEGER NOT NULL CHECK(layout_version=1),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE content_objects (
  content_hash TEXT PRIMARY KEY CHECK(length(content_hash)=64),
  byte_size INTEGER NOT NULL CHECK(byte_size>=0),
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('READY','MISSING','QUARANTINED','DELETING')),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX content_objects_state ON content_objects(state,created_at);
