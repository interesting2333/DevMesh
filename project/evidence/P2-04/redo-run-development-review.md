# P2-04 Run 安全重做（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-safe-retry-redo`（父工作包 P2-04）
- 任务：1.1 `run_redos` 迁移与 `redoRun`
- 结论：从失败／取消 Run 重做、固定 baseCommit、不复制旧材料、活动 Run 拒绝与幂等已实现并通过测试；正式 P2-04 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0048 | `run_redos`：原 Run／新 Run／review hash／操作；两处外键指向同一项目内的 Run |
| `redoRun` | 仅 FAILED／CANCELLED；If-Match 资源版本；项目已有活动 Run 返回 ACTIVE_RUN_EXISTS；新 Run 为 PREPARING、空计划／需求、`origin_run_id` 指向原 Run |
| 不复制 | 新 Run 无 work revision、候选、审查或工作区 diff；baseCommit 沿用 `user_tasks` |
| 幂等 | 同键重放返回原新 Run，不创建第二个 Run |

## 测试

```powershell
node --test --test-reporter=spec tests/redo-run.test.mjs
```

结果：1/1 通过；日志见 [redo-run.txt](./redo-run.txt)。覆盖：活动 Run 拒绝、终态后重做、新 Run 为空、origin/task 绑定、同键重放、二次重做拒绝。

## 未完成与边界

- `RetryWork` 的 attempt 重建与预算桶未实现。
- 受保护 `:redo` API、材料复用矩阵、T4／T10 未完成。
- 真实模型／Runner／OIDC 未执行；正式 P2-04／G1～G4 不变。
