CREATE TABLE content_archive_requests (
  archive_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL REFERENCES content_objects(content_hash),
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  state TEXT NOT NULL CHECK(state IN ('REQUESTED','ACKED','CANCELED')),
  requested_by TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE REFERENCES operations(operation_id),
  requested_at TEXT NOT NULL,
  acked_by TEXT,
  acked_at TEXT
) STRICT;

CREATE INDEX content_archive_state ON content_archive_requests(content_hash,state);
CREATE INDEX content_archive_project ON content_archive_requests(project_id,state);