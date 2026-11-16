## Context

P2-06 要求 AgentInvocation 独立宿主、公共 Task/Inbox、T7、主体配额与授权映射。当前只有契约。G1 未通过，先实现可离线验证的 Invocation 记录与状态机。

## Goals / Non-Goals

**Goals**
- Invocation 有独立主键与项目/主体/端点绑定，不复用 Run 外键。
- 创建幂等：同键同目标返回原记录；同键不同请求被拒绝。
- 状态机显式，终态不可回退。

**Non-Goals**
- 不实现公共 Task/Inbox 消费者、主体配额、真实取消核实或 T7/T20/T21。
- 不接真实模型或外部身份。
- 不改变 A2A 现有 Run 外键。

## Decisions

1. **独立表**：`invocations` 只引用项目与操作，不引用 Run/Attempt；端点 revision 记录为字段，绑定校验留给 API/Registry。
2. **幂等**：创建是 operation；请求 hash 含项目、主体、端点、快照 hash；同键不同 hash 返回 `IDEMPOTENCY_KEY_REUSED`。
3. **状态机**：ACCEPTED → WORKING／INPUT_REQUIRED／CANCELED；WORKING → INPUT_REQUIRED／COMPLETED／FAILED／CANCELED；INPUT_REQUIRED → WORKING／CANCELED；终态不再变化。
4. **快照 hash**：输入清单与定义快照各存 64 位 hash；正文不进入本表。
5. **取消核实**：本增量只允许状态转换；真实外部动作核实与配额在后续任务。
6. **查询**：按项目/主体有界列出。

## Risks / Trade-offs

- 未校验端点存在 → API 层需在创建前做 registry 检查；存储不制造假绑定。
- 状态机不覆盖全部外部事实 → 终态取消仍标记为后续核实项，不宣称物理停止。

## Migration Plan

新增向前迁移 `invocations`；旧库升级保留数据，失败回滚。
