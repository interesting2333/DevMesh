## Why

父工作包 P2-02。Outbox、Inbox、工具、Runner、接受的崩溃切点已分别在 P0/P1 的恢复逻辑与测试中出现，但没有统一的启动恢复扫描：重启后哪些 Run 仍处于暂停／取消中、哪些 attempt 未知、哪些 Outbox 仍被租用、多少准备仍未结束，目前只能逐个查询。G1 未通过，本变更只作为提前开发增量，正式 P2-02 保持 `NOT_STARTED`。

## What Changes

- 新增只读恢复扫描：一次性返回暂停／取消中的 Run、活动与未知 attempt、Outbox 未决与已租用数量、未结束准备数量。
- 扫描不自动把 PAUSING／PAUSED 改回 OPEN，不把 UNKNOWN attempt 自动判终态，不重放任何外部动作。
- 平台层提供显式 `RecoveryScan` 包装与结果投影，供启动时记录与 readiness 展示；默认不因此自动开放新执行。
- 崩溃矩阵测试：手动暂停跨重启保持、未知 attempt 跨重启保留、Outbox 租约过期可被接管、原键仍查原事实。
- 真实 Runner／容器、工具和外部接受后端的物理恢复仍单独验收。

## Capabilities

### New Capabilities

- `crash-recovery-scan`: 启动恢复扫描、状态投影和崩溃矩阵。

### Modified Capabilities

复用既有 Run 控制、attempt、Outbox 与准备表，不改变 A2A、接受、发布或工具语义。

## Impact

影响 `packages/storage-sqlite`（只读扫描命令与类型）、`packages/platform-core`（显式扫描包装）、对应测试与文档。正式 P2-02、G0～G4 与真实资源验收不因本变更自动通过。
