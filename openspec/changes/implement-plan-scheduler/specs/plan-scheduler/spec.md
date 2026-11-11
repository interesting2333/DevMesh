## ADDED Requirements

### Requirement: Plans preserve exact review and provenance

The platform SHALL validate a plan against its requirements and authorized inputs, reject invalid DAG and concurrent write scopes, and require an explicit current-basis decision before implementation.

#### Scenario: Invalid graph or stale review

- **WHEN** the graph is cyclic, has invalid references or unsequenced write overlaps, or the reviewed revision/hash is stale
- **THEN** the platform SHALL return identifiable validation details and SHALL NOT admit implementation work

### Requirement: Admission preserves fairness and capacity

The scheduler SHALL round robin among eligible projects, check capacity, dependencies and budget in the admission transaction, and persist the frozen inputs, target, operation, event and outbox.

#### Scenario: Full or unknown project does not block another

- **WHEN** one project has occupied roles or an unresolved original attempt and another has eligible work
- **THEN** the platform SHALL preserve the original attempt and consider the other project without exceeding available slots

### Requirement: A2A delivery retains original identity

The sender SHALL persist the original send before network I/O and reconcile by the original operation when the response is missing.

#### Scenario: Response lost after durable admission

- **WHEN** an A2A transport fails after the receiver saved the Task
- **THEN** the platform SHALL query and bind that original Task without creating another Attempt or inferring product success
