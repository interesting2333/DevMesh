## Purpose

让每次研发尝试拥有可核实的固定代码起点、独立工作区和完整源码保存依据，使候选集成、冲突处理及工作区回收都能追溯原操作，并在响应丢失、并行开发或节点故障时保留真实代码与恢复材料。

## ADDED Requirements

### Requirement: Workspaces preserve the exact admitted code basis

The system SHALL allocate an isolated workspace for the admitted Attempt from its exact authorized base SHA and preserve the original allocation identity, repository ownership and approved write scope.

#### Scenario: The caller requests another basis or workspace

- **WHEN** a requested base, owner or workspace does not match the admitted Attempt
- **THEN** allocation or mutation SHALL be rejected without substituting the latest project revision

#### Scenario: Workspace preparation acknowledgement is lost

- **WHEN** preparation has an unresolved result
- **THEN** recovery SHALL inspect the original allocation and workspace identity before creating or reusing any checkout

### Requirement: Git mutations require exclusive current authority

The system SHALL serialize project integration and fence workspace mutations against active or uncertain Runner jobs and editors using current host, membership, control generation and resource authority.

#### Scenario: A workspace still has an uncertain job

- **WHEN** a Git write or reclamation is requested while an owning job may still be active
- **THEN** the request SHALL be rejected and the original job SHALL remain available for query and stop

#### Scenario: A paused original file mutation needs reconciliation

- **WHEN** the original owner requests a filesystem reconciliation barrier after write admission has closed
- **THEN** separate current membership, original-operation and resource authority SHALL be required; the cleanup barrier SHALL retain Runner exclusion and SHALL NOT authorize a new edit or Job

### Requirement: Development commits are verified and retained in the controlled repository

The system SHALL verify a development commit's repository, original host, fixed base, ancestry and approved diff scope, transfer its objects to the controlled project repository, and retain a durable reference before acknowledging source archival.

#### Scenario: A commit exists only in the temporary checkout

- **WHEN** its transfer, verification or retention acknowledgement is incomplete
- **THEN** the commit SHALL NOT be treated as safely archived and its only workspace SHALL NOT be reclaimed

### Requirement: Integration produces a distinct candidate without accepting it

The system SHALL integrate verified development inputs serially into a candidate, revalidate the current dependency basis, preserve immutable original-operation facts, and leave the project acceptance pointer under the separate acceptance workflow.

#### Scenario: Independent development branches diverge from the same base

- **WHEN** their approved changes can be merged without conflict
- **THEN** integration SHALL preserve both changes in an exact candidate SHA and SHALL NOT silently overwrite one branch

#### Scenario: The integration response is lost

- **WHEN** the original candidate update may already have committed
- **THEN** recovery SHALL inspect its original retained operation fact and SHALL NOT repeat the integration as a new operation

### Requirement: Integration conflicts preserve all three source versions

The system SHALL preserve conflict paths and exact base, ours and theirs source references with hashes, return an explicit conflict outcome, and keep the previous candidate available.

#### Scenario: Two branches conflict on an approved file

- **WHEN** automatic integration cannot resolve that file
- **THEN** all three versions and conflict metadata SHALL be retrievable by authorized users, and no automatic ours or theirs overwrite SHALL resolve the conflict

### Requirement: Verification workspaces use an immutable candidate SHA

The system SHALL create verification inputs from the exact candidate SHA and preserve its source manifest rather than testing an evolving developer directory.

#### Scenario: Development continues after a verification checkout is created

- **WHEN** a developer workspace changes
- **THEN** the verification input SHA and its files SHALL retain the original candidate basis

### Requirement: Reclamation requires a durable complete archive acknowledgement

The system SHALL retain source commits and required uncommitted, untracked and recovery materials until a verified archive manifest has a durable acknowledgement; reclamation SHALL affect only the original workspace and preserve datasets and protected project repositories.

#### Scenario: Archive acknowledgement is missing or a hash changes

- **WHEN** reclamation is requested
- **THEN** it SHALL be refused and the original materials SHALL remain available for reconciliation
