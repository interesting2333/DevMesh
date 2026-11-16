## ADDED Requirements

### Requirement: Project statistics are read-only and accurate

The system SHALL return project-scoped counts for members, runs (total/active/terminal), messages, artifacts and releases without writing any state.

#### Scenario: Unknown project is rejected
- **WHEN** statistics are requested for a project that does not exist
- **THEN** the request is rejected and no data is invented

### Requirement: Configuration export excludes secrets

The export SHALL include project name, member roles and Registry generation/bindings, and MUST NOT include credentials, endpoint addresses or card hashes.

#### Scenario: Export contains no secret material
- **WHEN** a configuration export is produced
- **THEN** it contains no credentialRef, address, cardHash or secret value