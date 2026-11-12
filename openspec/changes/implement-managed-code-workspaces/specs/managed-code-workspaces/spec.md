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

#### Scenario: An MCP service starts before an Attempt workspace is allocated

- **WHEN** a trusted dynamic backend resolves a later READY allocation
- **THEN** each tool call SHALL require its original owner, configured Runner, exact resources and persisted allocation identity without accepting model supplied host paths

#### Scenario: The first dynamic tool call observes a replaced directory

- **WHEN** the current directory differs from the physical identity in the original allocation acknowledgement
- **THEN** the call SHALL be rejected without adopting that replacement as the original workspace or changing its bytes

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

#### Scenario: A source retention acknowledgement is lost

- **WHEN** the original operation has prepared a frozen manifest but transfer or acknowledgement has an uncertain result
- **THEN** recovery SHALL inspect the original retained refs, repository identity, exact commit and manifest without replaying object import or ref mutation; missing proof SHALL preserve the workspace and block a replacement archival operation

#### Scenario: The original host is paused after committing its source

- **WHEN** source retention is requested for its already proven original commit
- **THEN** current membership and original owner, allocation, scope and cleanup resource authority SHALL be required; successful source retention SHALL NOT authorize new execution or reclamation of unarchived materials

### Requirement: Integration produces a distinct candidate without accepting it

The system SHALL integrate verified development inputs serially into a candidate, revalidate the current dependency basis, preserve immutable original-operation facts, and leave the project acceptance pointer under the separate acceptance workflow.

#### Scenario: Independent development branches diverge from the same base

- **WHEN** their approved changes can be merged without conflict
- **THEN** integration SHALL preserve both changes in an exact candidate SHA and SHALL NOT silently overwrite one branch

#### Scenario: The integration response is lost

- **WHEN** the original candidate update may already have committed
- **THEN** recovery SHALL inspect its original retained operation fact and SHALL NOT repeat the integration as a new operation

#### Scenario: A dependency changes after an integration was prepared

- **WHEN** the confirmed plan, Run or Work generation, latest predecessor Attempt or verified source basis no longer matches the frozen integration inputs
- **THEN** the system SHALL preserve any original Git operation fact for reconciliation and SHALL NOT expose it as a qualified current scheduling input

#### Scenario: The newest project candidate contains unrelated changes

- **WHEN** scheduling a Work whose current dependency closure differs from that candidate's frozen source set
- **THEN** the system SHALL require a matching verified snapshot or reject code-basis admission rather than substituting the newest candidate

### Requirement: Integration conflicts preserve all three source versions

The system SHALL preserve conflict paths and exact base, ours and theirs source references with hashes, return an explicit conflict outcome, and keep the previous candidate available.

#### Scenario: Two branches conflict on an approved file

- **WHEN** automatic integration cannot resolve that file
- **THEN** all three versions and conflict metadata SHALL be retrievable by authorized users, and no automatic ours or theirs overwrite SHALL resolve the conflict

#### Scenario: A directory rename conflict has messages but no stages

- **WHEN** Git reports a conflict only through message paths without stage entries
- **THEN** conflict material collection SHALL include those paths and preserve exact file, directory or absent versions from the original source trees without treating an absent version as an empty file

#### Scenario: A conflict report contains a virtual merge base

- **WHEN** a computed conflict depends on virtual stage-one blobs that are not reachable through an original ancestor commit
- **THEN** the persisted report SHALL retain and verify their bytes, and recovery SHALL use that original report rather than rerunning the merge

#### Scenario: Conflict content publication is interrupted

- **WHEN** any required report or source material lacks verified publication and an atomic business content reference
- **THEN** the original integration SHALL remain unresolved, its prior candidate SHALL remain unchanged, and no complete conflict acknowledgement SHALL be recorded

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

#### Scenario: A failed developer produced no source commit

- **WHEN** its original workspace is preserved
- **THEN** the exact admitted base and all required current, untracked, ignored and recovery material SHALL be retained without requiring or inventing a successful development commit

#### Scenario: A workspace contains additional Git references or a changed index

- **WHEN** those source bytes lack the original controlled retention proof
- **THEN** complete archival and reclamation SHALL be rejected rather than excluding the only copies as Git metadata

#### Scenario: A complete acknowledgement reply is lost

- **WHEN** original retained refs, immutable material hashes and the committed complete archive record can be verified
- **THEN** recovery SHALL recover that original ACK and Runner receipt without replaying a Git mutation or allocating a replacement operation

#### Scenario: Recovery files have been saved but their owner is unknown

- **WHEN** reclamation is requested while an original file operation or private recovery directory remains unverified
- **THEN** saved bytes SHALL remain readable and SHALL NOT authorize reclamation or resurrect execution authority

#### Scenario: A live Host has no current Runner jobs

- **WHEN** its original execution Grant still permits future job admission
- **THEN** destructive reclamation SHALL be refused even when source and file materials are fully acknowledged

#### Scenario: The isolation acknowledgement is interrupted

- **WHEN** the original directory has moved into its unique operation trash path but the control record has not acknowledged that move
- **THEN** recovery SHALL verify the original physical identity, frozen materials and Runner receipt before recording that same isolation fact

#### Scenario: Deletion is interrupted after removing some original entries

- **WHEN** the original delete intent and isolation receipts remain verifiable
- **THEN** recovery MAY finish removal only after verifying every remaining entry against the frozen original identity and material set, and SHALL preserve unknown additions, modified bytes, replacements and new external links

#### Scenario: A completed reclamation path is reused

- **WHEN** a retry observes the original durable DELETED fact while a later directory occupies its former path
- **THEN** the retry SHALL return the original fact without deleting that later directory

#### Scenario: A verification checkout has only read execution access

- **WHEN** its original owner has current project writer membership, the original execution Grant is revoked, the complete archive is acknowledged and the separate maintenance barrier is authorized
- **THEN** the maintenance operation MAY reclaim only that original checkout without granting any new execution or source write access
### Requirement: Managed runtime publication and original result recovery

托管模式 SHALL 在模型调用前完成精确工作区分配，并在发布开发候选前保存原成功提交的源码 ACK。最终角色结果、原分配和归档操作 SHALL 先写入不可变结果日志。未知结果 MUST 保留原操作供核实。

#### Scenario: Source acknowledgement gates a runtime candidate

- **WHEN** 托管开发 Runtime 已保存最终模型响应
- **THEN** Worker 只接受属于原激活、原分配和精确成功提交的结果日志，未有对应源码 ACK 不发布候选或完成 Task

#### Scenario: Recovery publishes an existing result without new execution

- **WHEN** 原领取者核实丢失的源码 ACK 或发布回执且当前仍为写成员
- **THEN** 仅查询原归档并从原结果日志补录候选，不调用模型、执行工具或重新传输源码，也不恢复 Grant；已取消任务仍拒绝发布
