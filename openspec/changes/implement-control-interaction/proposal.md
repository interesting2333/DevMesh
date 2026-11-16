## Why

父工作包 P2-08。工作台已有控制状态展示与断线重连（P2-01），但没有暂停／恢复操作按钮；配置调整、变更队列、取消和多页面竞争也没有统一交互。G1 未通过，本变更作为提前开发增量。

## What Changes

- 工作台“执行控制状态”区域增加暂停／恢复按钮：读取当前 control revision 与 recovery review hash，调用受保护 API；失败只提示未确认，不伪造成功。
- 暂停后状态经事件与重快照刷新；恢复按钮只在 PAUSED 且 review hash 存在时可用。
- 取消按钮不在本增量：`CancelRun` 需要 impactReviewHash，当前没有真实影响审查，不伪造哈希。
- 配置调整、变更队列、多页面竞争与完整取消交互留给后续任务。

## Capabilities

### New Capabilities

- `control-interaction`: 工作台暂停／恢复操作与状态保持。

### Modified Capabilities

复用既有控制 API、ControlProgress 事件与工作台状态区，不改变后台语义。

## Impact

影响 `packages/input-api/src/web`、浏览器测试与文档。正式 P2-08、G0～G4 不变。
