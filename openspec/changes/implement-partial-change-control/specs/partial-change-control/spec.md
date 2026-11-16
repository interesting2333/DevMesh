## ADDED Requirements

### Requirement: Change proposals are durable and source-unique

The system SHALL persist a change proposal with its project, Run, source message and current basis hash. A repeated proposal for the same source message MUST return the original operation instead of creating a second proposal.

#### Scenario: Duplicate source message
- **WHEN** the same source message is proposed twice
- **THEN** the system returns the original proposal and keeps one record

### Requirement: Decisions require the current basis

A decision MUST be accepted only when the submitted basis hash equals both the stored proposal basis and the basis recomputed from the current Run. A PROPOSED proposal MUST move to CONFIRMED or REJECTED only through an explicit decision.

#### Scenario: Stale plan basis
- **WHEN** the plan or requirement revision changed after proposal and a decision still submits the old basis
- **THEN** the system rejects the decision with CHANGE_BASIS_SUPERSEDED and leaves the proposal PROPOSED

#### Scenario: Terminal decision cannot change
- **WHEN** a CONFIRMED or REJECTED proposal receives another decision
- **THEN** the system rejects it without changing the stored state
