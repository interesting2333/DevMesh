## Why

父工作包 P2-04。契约已有 `RetryWork`／`RedoRun`，但没有存储或 API 实现。当前无法从已失败／取消的 Run 安全创建新 Run，也无法保证不复用旧未接受 diff 或旧计划。G1 未通过，本变更仅作提前开发增量。

## What Changes

- 新增 `run_redos` 记录每次重做：原 Run、新 Run、审查 hash、操作。
- 实现 `redoRun`：只允许 `FAILED`／`CANCELLED` 的原 Run；固定原项目／Task／baseCommit；在同一操作中创建新的 `PREPARING` Run，设置 `origin_run_id`，不复制旧计划、需求版本、候选或未接受 diff。
- 项目已有活动 Run 时拒绝；同一幂等键返回原新 Run。
- `RetryWork`、材料复用矩阵与 T4/T10 的完整交互留给后续任务。

## Capabilities

### New Capabilities

- `safe-retry-redo`: Run 重做的持久记录与新建语义。

### Modified Capabilities

复用既有 Run 表、操作幂等与 baseCommit；不改变实施 DAG。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P2-04、G0～G4 不变。
