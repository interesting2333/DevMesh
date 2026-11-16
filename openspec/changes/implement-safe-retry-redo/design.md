## Context

P2-04 要求安全重试、准备重做、材料复用与失效计算。当前只有契约。先实现可离线验证的 Run 重做核心，`RetryWork` 的 attempt 重建依赖后续调度细节。

## Goals / Non-Goals

**Goals**
- 仅从失败／取消的 Run 重做；新 Run 固定原项目／Task／baseCommit。
- 新 Run 不复制旧计划、需求版本、候选、审查或未接受 diff。
- 每个项目最多一个活动 Run；同操作幂等。

**Non-Goals**
- 不实现 `RetryWork` 的 attempt 级重建与预算桶。
- 不做材料复用矩阵、T4 完整原子重建或 T10。
- 不调用模型。

## Decisions

1. **仅终态可重做**：原 Run 必须 `FAILED`／`CANCELLED`；活动 Run、已完成 Run 一律拒绝。
2. **固定 baseCommit**：新 Run 不新增 baseCommit 字段，沿用既有 `user_tasks.base_commit`；不复制旧工作区或未接受 diff。
3. **新 Run 全新**：phase=`PREPARING`、无 current_plan／requirement、control 与 event 计数从初始值开始；`origin_run_id` 指向原 Run。
4. **唯一活动 Run**：项目已有非终态 Run 时返回 `ACTIVE_RUN_EXISTS`。
5. **审计记录**：`run_redos` 保存原 Run、新 Run、review hash 与操作；同键重放返回原结果。
6. **后续**：材料复用与失效计算在 T4 中单独实现。

## Risks / Trade-offs

- 新 Run 立即成为项目活动 Run → 调用方需确认旧 Run 终态；约束在事务内检查。
- 旧审查 hash 仅记录不验证 → 真实审查服务接入后补充；当前不伪造通过。

## Migration Plan

新增向前迁移 `run_redos`；旧库升级保留数据，失败回滚。

## Open Questions

- RetryWork 的新 attempt 预算与材料复用规则待 P2-04 后续任务确定。
