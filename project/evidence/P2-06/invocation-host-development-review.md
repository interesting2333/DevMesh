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
