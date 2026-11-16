## Why

父工作包 P2-06。`InvocationDelegation` 与 permits 已有契约，但没有独立 Invocation 表组或存储命令；公共 Task/Inbox、配额与取消核实无法落地。G1 未通过，本变更只作提前开发增量。

## What Changes

- 新增独立 Invocation 记录：项目、主体、端点 revision、状态、输入／定义快照 hash 与创建操作。
- `createInvocation`：操作幂等；同键同目标返回原记录，同键不同请求被拒绝；记录主体与目标绑定，不借用 Run 外键。
- `getInvocation`／`listInvocations`／`transitionInvocation`：显式状态机（ACCEPTED／WORKING／INPUT_REQUIRED／COMPLETED／FAILED／CANCELED），终态不可回退。
- 公共 Task/Inbox、主体配额、真实取消核实与 T20/T21 留给后续任务。

## Capabilities

### New Capabilities

- `invocation-host`: 独立 Invocation 持久化与状态机。

### Modified Capabilities

复用操作幂等与 registry revision 概念，不放宽 Run 外键。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P2-06、G0～G4 不变。
