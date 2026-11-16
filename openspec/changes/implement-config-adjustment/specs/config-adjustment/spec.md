## ADDED Requirements

### Requirement: Config adjustments require a paused Run

The system SHALL allow a config adjustment proposal only for a PAUSED Run. The proposal MUST record the current config generation and the submitted config snapshot.

#### Scenario: Active Run cannot adjust config
- **WHEN** a config adjustment is proposed on a non-PAUSED Run
- **THEN** the system rejects it with CONFIG_REQUIRES_PAUSED and records nothing

### Requirement: Confirmation uses a current-generation CAS

A confirmation MUST be accepted only when the proposal is PROPOSED and its base generation equals the current config generation. A stale generation MUST be rejected with CONFIG_BASIS_SUPERSEDED.

#### Scenario: Old generation cannot be applied
- **WHEN** another adjustment already advanced the generation and an older proposal is confirmed
- **THEN** the confirmation is rejected and the Run stays PAUSED

### Requirement: Applying config keeps the Run paused

A successful confirmation SHALL advance the config generation and MUST NOT reopen the Run. Restarting storage MUST leave the Run PAUSED.

#### Scenario: Pause survives config application and restart
- **WHEN** a config adjustment is confirmed and storage is reopened
- **THEN** the Run control gate is still PAUSED and the new generation is durable
