## ADDED Requirements

### Requirement: Content pins are durable and must block future deletion

The system SHALL persist a pin for an existing content object with its reason and creation time. A pin MUST be releasable and an active pin MUST be visible to any future deletion planning.

#### Scenario: Active pin is visible
- **WHEN** content has an active pin
- **THEN** diagnostics count it as pinned and no deletion path may treat it as unreferenced

#### Scenario: Release does not delete content
- **WHEN** a pin is released
- **THEN** the pin is no longer active and the content object still exists

### Requirement: Pinning is idempotent per operation

Replaying the same pin operation MUST return the original pin. Reusing the key for a different content hash MUST be rejected.

#### Scenario: Key reused for another hash
- **WHEN** the same idempotency key pins a different content hash
- **THEN** the system rejects it with IDEMPOTENCY_KEY_REUSED

### Requirement: Diagnostics never fabricate capacity

Storage diagnostics SHALL report counts it can verify and MUST NOT invent free disk space or deletion success.

#### Scenario: Counts only
- **WHEN** diagnostics are requested
- **THEN** the response contains verified content and active-pin counts without a fabricated byte capacity
