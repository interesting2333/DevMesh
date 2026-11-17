## ADDED Requirements

### Requirement: Preparation endpoints are role-bound and versioned

A preparation dispatch SHALL resolve the configured role endpoint and only proceed when it advertises `devmesh.prepare.<role>` and its card hash matches the regenerated card.

#### Scenario: Prepare skill missing
- **WHEN** the role endpoint lacks the prepare skill
- **THEN** no dispatch is sent and the input stays unprocessed

### Requirement: Workbench input triggers model preparation

With preparation configured, a new project input SHALL produce a persisted requirement revision and plan revision through the configured Provider.

#### Scenario: Real understanding is persisted
- **WHEN** a project is created with preparation enabled
- **THEN** a requirement revision and a plan revision are stored and visible in the workbench

### Requirement: Plan validation is not weakened

Preparation wiring MUST NOT bypass existing plan validation.

#### Scenario: Incomplete plan is not confirmable
- **WHEN** the generated plan lacks required tester or integration outputs
- **THEN** confirmation remains blocked with the existing validation codes
