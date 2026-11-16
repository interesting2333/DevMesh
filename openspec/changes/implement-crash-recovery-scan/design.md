## Context

P2-02 要求覆盖 Outbox／Inbox／工具／Runner／接受的崩溃切点、租约接管和迟到结果。当前各子链已有恢复逻辑，但缺少统一、只读、可复核的启动扫描。G1 未通过，因此只实现离线可验证的扫描与矩阵，不触碰真实物理资源。

## Goals / Non-Goals

**Goals**
- 重启后可一次读取：控制中的 Run、活动／未知 attempt、Outbox 未决／租用、未结束准备。
- 扫描绝不自动解除暂停、绝不自动终结未知、绝不复用旧外部动作。
- 为后续租约接管与迟到结果核实提供稳定输入。

**Non-Goals**
- 不实现物理 Runner／容器／工具的自动恢复。
- 不实现真实企业身份或模型验收。
- 不改变既有恢复协议本身。

## Decisions

1. **只读扫描**：`getRecoveryState` 只查询，不写库、不发事件、不改变 gate／attempt 状态。调用方决定后续动作。
2. **暂停优先**：PAUSING／PAUSED／CANCELLING 的 Run 单独列出，重启恢复不得把它们改成 OPEN；恢复只能通过显式 resume 或完成收尾。
3. **未知保留**：`OUTCOME_UNKNOWN` attempt 计数并保持原状态，必须按原键查询原操作，不能自动判失败或重放。
4. **Outbox 租约**：PENDING、LEASED、RECONCILE 分开统计；过期租约由既有 `claimOutbox` 转为 RECONCILE 等待原键核实，不自动重发，扫描本身不抢占。
5. **准备与执行分离**：未结束准备数量单独返回，不与 attempt 混为一谈。
6. **平台包装**：显式 `RecoveryScan` 只包装存储查询并冻结结果；默认平台不因扫描结果自动开放新执行。

## Risks / Trade-offs

- 扫描结果可能瞬时过期 → 调用方以具体 Run 的 CAS 查询为准。
- 大量待恢复对象 → 扫描使用有界列表，不用无限聚合。
- 平台尚未接入 → 文档明确当前只有存储扫描与显式包装。

## Migration Plan

不新增迁移；使用既有表与索引。只读查询失败不改变数据；回退删除包装即可。

## Open Questions

- 平台 readiness 的展示位置与阈值留待接入时确定；当前不阻塞其他执行。
