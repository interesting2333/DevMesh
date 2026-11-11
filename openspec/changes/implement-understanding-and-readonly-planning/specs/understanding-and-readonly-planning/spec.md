## Purpose

为已保存项目输入提供可追溯的需求理解、澄清回答和实施确认前的只读规划。它保证答案保存、模型解释、计划草稿及用户实施确认具有可分别核实的事实和权限边界，支持部分回答与解释失败后的安全重试。

## ADDED Requirements

### Requirement: Preparation is bounded and requires current authority

The system SHALL allow read-only preparation before an implementation plan exists, subject to current project permission, Run control gate, epoch, frozen input and role capacity. It MUST NOT execute generated code or authorize repository writes from preparation. Missing model configuration SHALL leave saved input visibly waiting without model invocation.

#### Scenario: No model resources
- **WHEN** an authorized user saves input and no model is configured
- **THEN** the input and original processing operation remain queryable as waiting, and no understanding success or execution is reported

#### Scenario: Late response after pause
- **WHEN** a preparation response arrives after its control or input basis has changed
- **THEN** its historical response can be retained but cannot overwrite current understanding or start implementation

### Requirement: Understanding preserves source and question versions

The system SHALL preserve immutable understanding revisions with locatable authorized source references, explicit conflicting sources and question versions. Required unanswered questions MUST prevent implementation, and a model-proposed default MUST require an explicit user choice.

#### Scenario: Contradictory materials
- **WHEN** understanding identifies conflicting input statements
- **THEN** the conflict exposes references to both sources and does not silently choose either as a user decision

#### Scenario: Forged source
- **WHEN** structured output references an unknown or foreign source
- **THEN** publication is rejected and existing understanding remains unchanged

### Requirement: Partial answers and interpretation have separate durable outcomes

The system SHALL validate the entire submitted answer batch against current question versions and atomically save its answers and interpretation operation. It SHALL preserve partial answers during pause. Retrying failed interpretation MUST use the saved answer set without duplicating answers or increasing user intervention counts.

#### Scenario: One question was superseded
- **WHEN** a batch contains an answer for an obsolete question revision
- **THEN** no answer in the batch is applied and the caller can retain its draft for reconciliation

#### Scenario: Interpretation fails after answer persistence
- **WHEN** interpretation fails after valid partial answers were saved
- **THEN** the saved answers remain visible and retry creates only a new interpretation operation using the original answers

### Requirement: Preparation uses durable A2A admission and known result recovery

The system SHALL admit preparation through authenticated configured A2A role endpoints with durable request deduplication, task ownership and queryable results. A lost reply or model outcome MUST NOT trigger blind retransmission or duplicate execution; unresolved attempts MUST retain their occupied capacity.

#### Scenario: Submission reply is lost
- **WHEN** the caller resends an identical authorized preparation request after losing its reply
- **THEN** it receives the original Task and the model is not invoked twice

#### Scenario: Process stops after model send
- **WHEN** a process stops after sending a model request without a complete persisted response
- **THEN** recovery records an unresolved outcome and does not silently start a replacement model request

### Requirement: Planning produces a reviewable draft on an exact requirement basis

The system SHALL publish only a bounded declarative draft tied to its exact requirement revision, preserve prior drafts and require explicit valid user confirmation before implementation. A2A completion and valid model JSON MUST NOT represent implementation verification or human acceptance.

#### Scenario: Understanding changes while planning
- **WHEN** a plan draft completes against an obsolete requirement basis
- **THEN** it cannot replace or confirm the current plan and its original response remains available for inspection

#### Scenario: Draft while a required question remains
- **WHEN** a plan draft exists but a necessary question remains unanswered
- **THEN** the draft is visible and implementation admission remains blocked
