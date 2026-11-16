## ADDED Requirements

### Requirement: Backups are consistent snapshots with verification

The system SHALL create a SQLite snapshot in an existing absolute directory outside the database directory, verify it with `quick_check` and `foreign_key_check`, and return its SHA-256 and byte size.

#### Scenario: Overlapping directory is rejected
- **WHEN** the destination directory is inside the database directory or does not exist
- **THEN** no snapshot is created and the request is rejected

#### Scenario: Verification failure is not success
- **WHEN** the snapshot fails integrity verification
- **THEN** the copy is removed and the request fails without reporting a usable backup

### Requirement: Backup does not claim restore

The increment MUST NOT implement restore, root migration or remote upload, and MUST NOT report those capabilities as available.

#### Scenario: Only snapshot is reported
- **WHEN** a backup succeeds
- **THEN** the result contains the snapshot path, hash and size only