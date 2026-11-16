## Context

P2-07 要求归档 ACK 与 GC。删除需要完整引用分析，当前不做；先实现可验证的归档请求／ACK 账本，为未来删除提供前置事实。

## Goals / Non-Goals

**Goals**
- 归档请求与 ACK 持久、幂等、可查询。
- ACK 丢失时内容保持不变；没有删除 API。
- ACK 记录操作者与时间。

**Non-Goals**
- 不实现删除、GC 计划／提交、分块日志或容量限制。
- 不宣称 ACK 后内容已被归档到外部存储。

## Decisions

1. **只有请求和 ACK**：状态 REQUESTED／ACKED／CANCELED；没有 DELETED 状态。
2. **ACK 不删除**：ACK 仅更新账本，内容对象与引用不变。
3. **幂等**：请求与 ACK 都是 operation；同键返回原记录。
4. **范围**：归档请求绑定项目，便于后续权限；内容 hash 仍全局。
5. **后续**：GC 必须先读取 ACK 与活跃 pin，并在同一事务复核引用；本增量不提供该路径。

## Risks / Trade-offs

- 没有实际归档介质 → 只记录 ACK 意图，不声称数据已迁移。
- 账本增长 → 查询有界。

## Migration Plan

新增向前迁移；旧库升级保留数据，失败回滚。