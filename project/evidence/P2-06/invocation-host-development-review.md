# P2-06 独立 Invocation 记录与状态机（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-invocation-host`（父工作包 P2-06）
- 任务：1.1 `invocations` 迁移与 create／get／list／transition
- 结论：独立 Invocation 持久化、幂等与状态机已实现并通过测试；正式 P2-06 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0050 | `invocations`：项目／主体／端点 revision／registry generation／输入与定义快照 hash／状态／操作；不引用 Run 外键 |
| `createInvocation` | 项目存在校验；同键同请求返回原记录；同键不同请求 `IDEMPOTENCY_KEY_REUSED` |
| 查询 | `getInvocation`、按项目有界 `listInvocations` |
| 状态机 | ACCEPTED → WORKING／INPUT_REQUIRED／CANCELED；WORKING → INPUT_REQUIRED／COMPLETED／FAILED／CANCELED；INPUT_REQUIRED → WORKING／CANCELED；终态不再变化 |

## 测试

```powershell
node --test --test-reporter=spec tests/invocation-host.test.mjs
```

结果：2/2 通过；日志见 [invocation-host.txt](./invocation-host.txt)。

## 未完成与边界

- 受保护 Invocation API、OpenAPI 与端点存在性检查（1.2）未完成。
- 公共 Task/Inbox、主体配额、真实取消核实与 T7/T20/T21（2.x）未完成。
- 真实模型／OIDC 未执行；正式 P2-06／G1～G4 不变。

## 追加：受保护 Invocation API（1.2）

- `POST /projects/{projectId}/invocations`：成员写权限；若 Registry 已有 active generation，则校验端点 ID／revision 与 generation，否则允许离线空 Registry 启动。
- `GET /projects/{projectId}/invocations`、`GET /invocations/{invocationId}`：成员读权限。
- `POST /invocations/{invocationId}:transition`：成员写权限与显式 expectedState／state。
- OpenAPI 新增三个读取／转换路径（总数 73）；错误码补充 Invocation 状态类。
- `tests/input-invocation-http.test.mjs` 1/1：创建、读取、列表、WORKING→COMPLETED 全链路通过。

## 追加：公共 Task/Inbox 与配额审计（2.1）

| 检查项 | 结论 |
| --- | --- |
| 公共 Task/Inbox | 只有 A2A `accepted_work`／`a2a_tasks` 的 Run 内路径；没有跨 Run 的公共 Inbox |
| 主体配额 | 没有按主体计数的 Invocation／Task 配额 |
| 取消核实 | Invocation 状态可转 CANCELED，但没有物理动作／外部 Task 停止核实 |
| T7/T20/T21 | 未执行 |
| 结论 | 公共任务内核、主体配额与取消核实保持未实现；本轮只完成审计与记录 |

因此 2.1 以“审计完成、缺口明确”记录；不宣称公共 Task/Inbox 已实现。
