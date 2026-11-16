# P2-06 公共任务内核：队列、租约与配额（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-public-task-kernel`（父工作包 P2-06）
- 任务：1.1 `public_tasks` 迁移与 enqueue／claim／complete／get／list
- 结论：公共任务队列、主体配额、租约与终态完成已实现并通过测试；正式 P2-06 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0052 | `public_tasks`：项目／主体／kind／payload／状态／租约／尝试次数／操作 |
| `enqueuePublicTask` | 项目存在校验；同键幂等；按主体统计 QUEUED／LEASED，超过 quota（默认 100）返回 `PUBLIC_QUOTA_EXCEEDED` |
| `claimPublicTask` | 领取最老 QUEUED 或过期 LEASED；写 owner／到期／attempts |
| `completePublicTask` | 仅当前租约 owner；终态不可回退 |
| 查询 | `getPublicTask`、按项目／主体／状态有界 `listPublicTasks` |

## 测试

```powershell
node --test --reporter=spec tests/public-tasks.test.mjs
```

结果：2/2 通过；日志见 [public-tasks.txt](./public-tasks.txt)。覆盖幂等、配额、错误 worker 完成、终态、过期租约重领。

## 未完成与边界

- 受保护公共任务 API（1.2）与文档同步（1.3）未完成。
- 缺信息补齐“只准入一次”、真实取消核实、外部 Agent 调用与 T7/T20/T21 未实现。
- 正式 P2-06／G1～G4 不变。

## 追加：受保护公共任务 API（1.2）

- `POST /projects/{projectId}/public-tasks`：成员写权限；quota 可选。
- `GET /projects/{projectId}/public-tasks?state=`：成员读权限。
- `POST /projects/{projectId}/public-tasks:claim`：成员写权限；按项目领取最老任务或过期租约。
- `GET /public-tasks/{taskKey}`、`POST /public-tasks/{taskKey}:complete`：按任务所属项目复核权限。
- OpenAPI 新增四个路径（总数 80）；错误码补充配额／租约／终态。
- `tests/input-public-task-http.test.mjs` 1/1：入队、幂等、配额 429、claim、错误 worker 409、完成与列表。
