## ADDED Requirements

### Requirement: Public tasks are durable and idempotent

The system SHALL persist public tasks with project, principal, kind, payload, state, lease and operation. Replaying the same enqueue operation MUST return the original task.

#### Scenario: Same key does not enqueue twice
- **WHEN** the same enqueue request is replayed
- **THEN** the original task is returned and one record exists

### Requirement: Principal quota bounds active tasks

The system SHALL reject a new task when the principal already has the maximum number of active (QUEUED or LEASED) tasks.

#### Scenario: Quota exceeded
- **WHEN** a principal with the maximum active tasks enqueues another
- **THEN** the request is rejected with PUBLIC_QUOTA_EXCEEDED and no task is created

### Requirement: Leases are explicit and terminal completion is final

A claim MUST lease the oldest queued task (or an expired lease) to one worker. Only the current lease owner may complete it, and a terminal task MUST NOT change.

#### Scenario: Only the lease owner completes
- **WHEN** a different worker tries to complete a leased task
- **THEN** the request is rejected and the task state is unchanged

#### Scenario: Completed task is terminal
- **WHEN** a completed task receives another completion
- **THEN** it is rejected without changing state
