## ADDED Requirements

### Requirement: Release manifest reports facts only

The manifest SHALL be generated from repository files and MUST NOT contain a releasability, acceptance or gate-pass claim.

#### Scenario: Gates stay as recorded
- **WHEN** the manifest is generated while gates are PENDING
- **THEN** the manifest lists them as PENDING

#### Scenario: No readiness claim
- **WHEN** the manifest is generated
- **THEN** it contains no `releasable`, `accepted` or `passed` field

### Requirement: Manifest is consistent with source files

The manifest's schema version and digests MUST match the migration manifest and OpenAPI artifact at generation time.

#### Scenario: Digest mismatch is impossible
- **WHEN** the manifest is generated
- **THEN** each recorded digest equals the SHA-256 of the corresponding file