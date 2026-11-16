## ADDED Requirements

### Requirement: Pause, resume and cancel are explicit control operations

The system SHALL expose pause, resume and cancel as idempotent operations bound to the current control revision. A resume MUST require a recovery review hash and MUST only be accepted from the PAUSED state.

#### Scenario: Resume requires current control revision and recovery review
- **WHEN** a client submits ResumeRun with a stale control revision or an unknown recovery review hash
- **THEN** the system rejects the operation with a conflict and leaves the run PAUSED

#### Scenario: Pause cannot overwrite a saved cancellation
- **WHEN** a run already has a saved CANCELLING intent and a pause is submitted
- **THEN** the pause is rejected and the cancellation intent is preserved

### Requirement: Per-target cleanup is durable and bounded

The system SHALL record every host target that must be stopped (attempt, preparation, preview, Runner job) with an explicit state, and MUST NOT mark a run PAUSED or CANCELLED while any required target is UNKNOWN or unreleased.

#### Scenario: Unknown target keeps the run in progress
- **WHEN** a target's physical stop cannot be confirmed
- **THEN** the run remains PAUSING or CANCELLING, the target stays UNKNOWN, and no capacity is released as if it exited

#### Scenario: Save failure retries only the save
- **WHEN** persisting a target's material fails after the stop action was already dispatched
- **THEN** the system retries only the material save and does not resend the stop action

### Requirement: Verification remains observable after thirty seconds

The system SHALL emit control progress with unresolved targets and the latest check time, and MUST NOT report success automatically after thirty seconds.

#### Scenario: Long verification is visible
- **WHEN** control cleanup has not completed after thirty seconds
- **THEN** ControlProgress reports the unresolved targets and last check time, and the run is not marked PAUSED or CANCELLED

### Requirement: Epochs gate resumed execution

The system SHALL advance the run epoch on control transitions and MUST allow a new attempt to work only under the current gate, grant and both run/work epochs.

#### Scenario: Old attempt cannot resume under a new epoch
- **WHEN** an attempt admitted under an older run epoch attempts to return to WORKING
- **THEN** the system rejects it with ADMISSION_CLOSED and requires reconciliation
