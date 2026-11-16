## Why

父工作包 P3-04 的对外 Agent 发布与发现。完整接入需要外部 Agent；离线可做的是 Exposure 草稿、校验、发布、排空与目录查询。G1 未通过，本变更作提前开发增量；正式 P3-04 仍 `NOT_STARTED`。

## What Changes

- 新增 `agent_exposures`：项目／agentKey／状态（DRAFT／VALIDATED／PUBLISHED／DRAINING／RETIRED）／Card 快照与 hash／操作。
- `createExposureDraft`、`validateExposure`、`publishExposure`、`drainExposure`、`retireExposure`、`getExposure`、`listExposures`、`getExposureCatalog`。
- Card 校验：名称／描述／版本非空、技能非空且不重复；草稿与校验重算 hash。
- 目录只返回 PUBLISHED／DRAINING。
- 不做真实外部 Agent 握手、服务 grant 或 T8。

## Capabilities

### New Capabilities

- `agent-exposure`: 对外 Agent 的草稿、校验、发布与排空状态机。

### Modified Capabilities

复用项目与操作幂等；不改变 A2A Registry 清单。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P3-04、G0～G4 不变。