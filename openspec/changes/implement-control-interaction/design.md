## Context

P2-08 要求完整控制交互与断线恢复。状态展示与重连已存在；缺少操作入口。先实现暂停／恢复，取消需要真实影响审查。

## Goals / Non-Goals

**Goals**
- 工作台可发起暂停与恢复，使用当前 control revision 与 review hash。
- 操作失败不显示成功；重连后读取权威状态。
- 断线重连期间不丢控制状态。

**Non-Goals**
- 不实现取消：没有 impactReviewHash 的真实来源。
- 不实现配置调整面板、变更队列或多页面竞争。
- 不替代 P2-08 完整 E2E 或 T08。

## Decisions

1. **读取优先**：按钮动作前读取一次 `/control`，使用最新 controlRevision；恢复还需 recoveryReviewHash。
2. **失败不乐观**：请求失败只显示“未确认”，不改变本地 gate；下一次事件／重快照纠正。
3. **重连一致**：WS 快照后重新读取 `/control`，按钮可用性随权威状态变化。
4. **取消延后**：没有真实影响审查时不提供取消按钮，避免伪造哈希。

## Risks / Trade-offs

- 并发控制：另一页可能已推进 revision → 请求 409，提示刷新后重试。
- 没有影响审查 → 取消保持不可用。

## Migration Plan

无迁移；仅前端与测试。回退删除按钮与测试即可。
