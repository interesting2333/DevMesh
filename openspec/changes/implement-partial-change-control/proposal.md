## Why

父工作包 P2-03。契约里已有 `ProposeChange`／`DecideChange`，但存储、领域与 HTTP 都没有实现，项目目前无法登记变更提案，也无法拒绝基于旧计划／需求依据的决定。G1 未通过，本变更作为提前开发增量，正式 P2-03 保持 `NOT_STARTED`。

## What Changes

- 新增变更提案持久化：项目／Run／来源消息、提议正文、状态、依据 hash、决定操作。
- 实现 `proposeChange`：同来源消息唯一、幂等，记录当前计划／需求／资源版本派生的依据 hash。
- 实现 `decideChange`：仅 PROPOSED 可决定；要求客户端提交的依据 hash 等于当前依据且等于提案记录，旧依据一律拒绝；确认／拒绝分别落库。
- 提供有界变更列表与单条读取。
- 影响图、局部冻结、应用／复验与 T3 交互留给后续任务；真实模型／OIDC／Linux 不执行。

## Capabilities

### New Capabilities

- `partial-change-control`: 变更提案、依据比较、决定与查询。

### Modified Capabilities

复用现有 Run 资源版本、操作幂等与消息语义，不改变实施 DAG 或接受流程。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、`packages/contracts`（可能的投影）、`packages/input-api`（API）与测试。正式 P2-03、G0～G4 不变。
