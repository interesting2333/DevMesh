## Context

P2-07 要求分块日志、归档 ACK、存储 pin、GC 互斥、容量限制与恢复引用保护。删除型 GC 需要完整引用分析，当前不具备；先实现 pin 与诊断，为后续 GC 建立“有活跃 pin 不得删除”的硬前置。

## Goals / Non-Goals

**Goals**
- 内容 pin 持久、可释放、可按 hash 查询。
- 诊断返回内容对象与活跃 pin 计数。
- pin 的存在可被后续 GC 计划读取；本增量不删除任何内容。

**Non-Goals**
- 不实现 GC 计划／提交／删除、分块日志、归档 ACK 或容量限制。
- 不实现 T22／T23。
- 不猜测磁盘剩余空间。

## Decisions

1. **pin 模型**：`content_pins` 引用 `content_objects`，记录 pinId、hash、原因、创建／释放时间；活跃 pin 为 `released_at IS NULL`。
2. **幂等**：pin 是 operation，同键返回原 pin；重复 pin 不同 hash 被 `IDEMPOTENCY_KEY_REUSED` 拒绝。
3. **释放**：只能释放本 pin；重复释放返回原结果，不删除内容。
4. **诊断**：只返回计数，不伪造字节容量；内容对象数量由现有表统计。
5. **GC 边界**：本增量没有删除路径；任何未来 GC 必须先读取活跃 pin 并在同一事务复核引用。

## Risks / Trade-offs

- 没有 GC 时磁盘仍可能增长 → 明确记录为未实现，不假装已控制容量。
- 引用分析不完整 → 不做删除，避免误删。

## Migration Plan

新增向前迁移 `content_pins`；旧库升级保留数据，失败回滚。
