## Context

P2-06 的公共 Task/Inbox 与主体配额尚缺。先实现不依赖外部 Agent 的持久队列、租约与配额，作为后续 Invocation/Task 内核基础。

## Goals / Non-Goals

**Goals**
- 公共任务持久化、幂等入队、租约领取、终态完成。
- 主体活跃任务配额可配置并有界。
- 过期租约可被显式重新领取。

**Non-Goals**
- 不实现缺信息补齐的完整语义、跨任务依赖或优先级。
- 不实现真实取消核实、外部 Agent 调用或 T7/T20/T21。
- 不做 UI。

## Decisions

1. **独立表**：`public_tasks` 只引用项目，不引用 Run/Attempt；payload 为有界 JSON。
2. **配额**：按 `principal_id` 统计 QUEUED／LEASED 数量，默认 100，可由请求显式降低；超限返回 `PUBLIC_QUOTA_EXCEEDED`。
3. **幂等**：入队与完成均为 operation；同键同请求返回原回执。
4. **租约**：claim 选择最老 QUEUED；过期 LEASED 在同一事务内被重新租用；worker 与到期时间落库。
5. **完成**：只有当前租约 owner 能完成；终态不可变。
6. **查询**：按项目/主体/状态有界列出。

## Risks / Trade-offs

- 过期租约直接重领可能造成重复执行 → 调用方必须按 taskKey 幂等处理；后续可加更严格的 ACK。
- 无取消：保持明确缺口。

## Migration Plan

新增向前迁移 `public_tasks`；旧库升级保留数据，失败回滚。
