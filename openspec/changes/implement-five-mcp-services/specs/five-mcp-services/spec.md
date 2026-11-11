## Purpose

为研发 Agent 提供分别可授权、可查询和可核实的仓库、文档、测试、缺陷及流水线服务，使工具的真实结果具有固定来源和原操作身份，恢复时能够区分未发送、成功、失败与未知。

## ADDED Requirements

### Requirement: Document results preserve authorized fixed sources

The docs service SHALL read and search only authorized, fixed-version input sources and return the original reference, content hash and exact bounded offsets.

#### Scenario: A source is unauthorized or changes

- **WHEN** a document is outside the permit or its bytes differ from the frozen hash
- **THEN** the service SHALL reject the request without returning another version or host data

### Requirement: Issues retain revisions and original mutation results

The issues service SHALL preserve source ownership, immutable revision history, explicit fix links and verification evidence, with mutation identity and revision checks.

#### Scenario: A mutation reply is lost

- **WHEN** the client queries the original operation after the issue was durably updated
- **THEN** it SHALL obtain the original result without creating another issue or revision

### Requirement: Repository writes remain within approved scope

The repo service SHALL bind writes to an authorized workspace, base commit and write scope, and retain operation identities and resulting commit facts for recovery.

#### Scenario: An attempted commit escapes its scope

- **WHEN** changed files exceed the approved write scope or the base commit differs
- **THEN** the service SHALL reject the mutation and SHALL NOT integrate the changes into the project

#### Scenario: A Git acknowledgement is lost

- **WHEN** the original operation has a durable prepared SHA and its atomic operation ref exists
- **THEN** recovery SHALL return that original commit fact without writing another commit or updating the project again; an unprepared or unproven operation SHALL remain unknown

#### Scenario: Integration acceptance is not configured

- **WHEN** the trusted workspace allocator or integration acceptance check is absent
- **THEN** the corresponding write tool SHALL NOT be registered and a Git commit fact SHALL NOT imply candidate acceptance

### Requirement: Pipelines and tests have independent execution facts

The pipeline service SHALL preserve its own identity and frozen stages, execute only approved stages, and retain per-stage jobs and results independently from tests.

#### Scenario: A stage fails or becomes unknown

- **WHEN** an earlier stage fails or has an unresolved result
- **THEN** subsequent stages SHALL NOT start and the original stage operation SHALL remain queryable

### Requirement: Every service uses current authority and frozen capabilities

All five services SHALL use separate authenticated identities and actual protocol calls; every action SHALL enforce the current host, grant, role policy and resource scope. Unknown mutations SHALL be reconciled by original identity before any new write.

#### Scenario: Current write admission closes

- **WHEN** a Run pauses or the original grant is revoked
- **THEN** new writes SHALL be rejected while original-job query and stop SHALL use restricted cleanup authority

#### Scenario: A claimed host renews a long action

- **WHEN** the current active host renews while its original grant is still valid
- **THEN** the same owner, generations and resource scope SHALL retain a fifteen-second lease window; a paused, expired or stale host SHALL NOT revive or expand the grant
