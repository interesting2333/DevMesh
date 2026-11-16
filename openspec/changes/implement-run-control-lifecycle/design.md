## Context

依据技术设计 D4 §4～5、实施文档 P2-01。Run 已有 `control_gate`（OPEN／PAUSING／PAUSED／CANCELLING）、`control_revision`、`run_epoch` 与 work 级 `work_epoch`；存储已有 pause／cancel 的控制意图和 `control-stop` Outbox，但没有 resume、逐目标收尾记录、材料保存重试和 30 秒核实提示。P1 的前置尚未正式验收，本变更只记录提前开发增量。

## Goals / Non-Goals

**Goals**
- pause／resume／cancel 有明确、幂等、可恢复的控制事务。
- 每个需要停止的宿主目标都有独立持久状态与证据，未知不被吞掉。
- 恢复必须经过审查 hash，且只从已保存材料建立新 attempt，不序列化被杀掉的调用栈。
- 超过 30 秒未完成时给出可观察的核实提示。

**Non-Goals**
- 不实现真实 Docker／runsc 停止；物理退出仍由 Runner 后端提供并单独验收。
- 不实现 P2-08 的完整控制交互页面；本变更只提供 API 与事件投影。
- 不改变 A2A、接受、发布或工具准入语义。

## Decisions

1. **命令与并发**：`pauseRun`、`resumeRun`、`cancelRun` 各自是 operation；都要求 `If-Match` 当前 `control_revision`。resume 额外要求 `recoveryReviewHash` 与当前保存的恢复审查依据一致。重复原键返回原回执。
2. **状态机**：`pause` → OPEN／PAUSING → PAUSED；`cancel` → CANCELLING；`resume` 仅从 PAUSED → OPEN。pause 不能覆盖已保存的取消意图；terminal run 不再接受控制命令。每次有效转换推进 `run_epoch` 与 `control_revision`。
3. **逐目标收尾**：新增 `run_control_targets`，按 run 记录目标类型与准确 ID、状态（PENDING／STOPPING／SAVED／RELEASED／UNKNOWN）、尝试次数、证据与检查时间；目标必须全部 RELEASED（或明确无资源）才允许 run 完成 PAUSED／CANCELLED。
4. **材料保存**：保存失败只把该目标置为 SAVED 失败并重试保存，不重复停止动作；停止动作本身不因保存失败重发。
5. **30 秒提示**：`ControlProgress` 事件携带控制状态、未解决目标数、最近检查时间；超过 30 秒不自动成功，也不把 UNKNOWN 改成 RELEASED。提示只是可观察状态，不是新的业务终态。
6. **恢复**：只有 PAUSED 且旧 attempt 已终结、材料目标已保存才允许 resume；resume 推进 epoch 并使旧的 in-flight 授权失效；需要重新执行的 work 由后续派发创建新 attempt，澄清类会话可继续原 attempt 的条件由现有准入规则判定。
7. **后端边界**：control-stop 消费通过显式后端接口；未配置后端时保留 UNKNOWN，不伪造停止；真实 Runner 停止仍由 P0-07／P1-07 验收。

## Risks / Trade-offs

- 目标记录与停止动作之间可能崩溃 → 以原目标状态和证据恢复，只查不重发。
- 目标无法确认 → run 停在 PAUSING／CANCELLING，不释放未证明的资源。
- 控制 revision 冲突 → 409，客户端重新读取后明确重试。
- 提前实现可能与后续 G1 设计调整冲突 → 用 OpenSpec 增量与台账记录范围，正式状态不提前。

## Migration Plan

新增向前迁移，只增加控制目标表与必要索引；旧 run 保持原字段与行为。迁移失败原子回滚；升级前按既有备份流程执行。回退保留数据库与目标记录，不删除未知目标证据。

## Open Questions

- 控制目标与现有 Runner job／preview 记录的准确关联字段，需在实现时对齐现有 schema；若无法一一绑定，保留原始 ID 与 UNKNOWN，不猜测。
