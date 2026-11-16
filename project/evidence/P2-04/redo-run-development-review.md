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

## 追加：受保护 redo API（1.2）

- `POST /runs/{runId}:redo`：要求 If-Match 资源版本、成员写权限；返回 202 receipt，资源指向新 Run。
- 新增 `REDO_REQUIRES_TERMINAL` 错误码；OpenAPI 重新生成。
- `tests/input-redo-http.test.mjs` 1/1：缺 If-Match 428、活动 Run 409、终态后 202 且新 Run 为 PREPARING。

## 追加：RetryWork 审计（2.1）

| 检查项 | 结论 |
| --- | --- |
| `RetryWork` 契约 | 存在（workId、failedAttemptId、retryReviewHash） |
| 存储／HTTP 实现 | **未实现**；没有 attempt 级重试命令 |
| 现有相近能力 | `verified-repairs` 产生修复 Work；candidate rejection 生成修复审查；Runner 发布 continuation；均不是同一 failed attempt 的新 attempt |
| 独立预算桶 | 调度有 maximumAttempts，但没有面向 retry 的独立预算桶 |
| 结论 | attempt 级 `RetryWork` 与材料复用矩阵、T4／T10 保持未实现；本轮只完成审计与记录，不勾选为已实现 |

因此 2.1 以“审计完成、缺口明确”记录；正式 P2-04 不因此完成。
