CREATE TABLE verified_findings (
  issue_id TEXT PRIMARY KEY REFERENCES issues(issue_id),
  work_verification_id TEXT NOT NULL REFERENCES work_verifications(operation_id),
  quality_operation_id TEXT NOT NULL REFERENCES quality_verifications(operation_id),
  check_id TEXT NOT NULL,
  failure_json TEXT NOT NULL CHECK(json_valid(failure_json)),
  failure_sha256 TEXT NOT NULL CHECK(length(failure_sha256)=64),
  created_at TEXT NOT NULL,
  UNIQUE(work_verification_id,check_id)
) STRICT;
CREATE TABLE verified_issue_commands (
  operation_id TEXT PRIMARY KEY REFERENCES issue_operations(operation_id),
  principal_id TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  result_json TEXT NOT NULL CHECK(json_valid(result_json))
) STRICT;
CREATE TRIGGER immutable_verified_finding BEFORE UPDATE ON verified_findings
BEGIN SELECT RAISE(ABORT,'VERIFIED_FINDING_IMMUTABLE'); END;
CREATE TRIGGER retain_verified_finding BEFORE DELETE ON verified_findings
BEGIN SELECT RAISE(ABORT,'VERIFIED_FINDING_RETAINED'); END;
CREATE TRIGGER immutable_verified_issue_command BEFORE UPDATE ON verified_issue_commands
BEGIN SELECT RAISE(ABORT,'VERIFIED_ISSUE_COMMAND_IMMUTABLE'); END;
CREATE TRIGGER retain_verified_issue_command BEFORE DELETE ON verified_issue_commands
BEGIN SELECT RAISE(ABORT,'VERIFIED_ISSUE_COMMAND_RETAINED'); END;
