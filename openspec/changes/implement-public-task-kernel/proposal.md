## Why

父工作包 P2-06 的已知缺口：现有 A2A Task 只在 Run 内，没有跨 Run 的公共 Task/Inbox 与主体配额。G1 未通过，本变更作为提前开发增量；正式 P2-06 仍 `NOT_STARTED`。

## What Changes

- 新增 `public_tasks`：项目／主体／kind／payload／状态（QUEUED／LEASED／COMPLETED／FAILED）／租约／操作。
- `enqueuePublicTask`：操作幂等；主体活跃任务数达到配额时拒绝。
- `claimPublicTask`：按时间领取最老 QUEUED；过期 LEASED 可被重新领取；返回租约。
- `completePublicTask`：仅限被同一 worker 租用的任务，终态不可回退。
- `getPublicTask`／`listPublicTasks`。
- 缺信息补齐的“只准入一次”与真实取消核实仍未实现，后续任务处理。

## Capabilities

### New Capabilities

- `public-task-kernel`: 跨 Run 公共任务队列、租约与主体配额。

### Modified Capabilities

复用项目与操作幂等；不引入 Run 外键。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P2-06、G0～G4 不变。
