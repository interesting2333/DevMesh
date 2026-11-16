## ADDED Requirements

### Requirement: Invocations are independent and idempotent

The system SHALL persist an invocation with its own identifier, project, principal, endpoint revision and snapshot hashes. Replaying the same operation MUST return the original invocation; reusing the key for a different request MUST be rejected.

#### Scenario: Same key returns the original invocation
- **WHEN** the same invocation creation request is replayed
- **THEN** the original invocation is returned and no duplicate is created

#### Scenario: Same key with a different target
- **WHEN** the same idempotency key is used for a different project or endpoint
- **THEN** the system rejects it with IDEMPOTENCY_KEY_REUSED

### Requirement: Invocation state transitions are explicit

An invocation MUST follow the declared state machine and MUST NOT leave a terminal state. Cancellation MUST be recorded as a state transition; physical effect verification remains a separate fact.

#### Scenario: Terminal invocation cannot change
- **WHEN** a COMPLETED or FAILED invocation receives another transition
- **THEN** the transition is rejected without changing the stored state

#### Scenario: Cancel is recorded without claiming physical stop
- **WHEN** an active invocation is canceled
- **THEN** its state becomes CANCELED and no physical stop success is fabricated
