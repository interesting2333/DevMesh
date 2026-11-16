## ADDED Requirements

### Requirement: Redo starts only from a failed or cancelled Run

The system SHALL allow a redo only when the source Run is FAILED or CANCELLED and the project has no other active Run. The new Run MUST keep the original project, Task and baseCommit.

#### Scenario: Active Run blocks redo
- **WHEN** the project already has a non-terminal Run
- **THEN** the redo is rejected with ACTIVE_RUN_EXISTS and no new Run is created

### Requirement: Redo never copies unaccepted material

The new Run MUST start with no plan revision, no requirement revision, no candidate, no review and no workspace diff from the source Run. Only the `origin_run_id` link is recorded.

#### Scenario: New Run starts empty
- **WHEN** a failed Run is redone
- **THEN** the new Run is PREPARING with null plan/requirement revisions and no copied candidate or diff

### Requirement: Redo is idempotent and auditable

Each redo MUST record the source Run, new Run, review hash and operation. Replaying the same key MUST return the original new Run.

#### Scenario: Replay returns the original new Run
- **WHEN** the same redo operation is submitted again
- **THEN** the system returns the original new Run and creates no second Run
