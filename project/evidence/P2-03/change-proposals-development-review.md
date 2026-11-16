# P2-03 变更提案与依据决定（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-partial-change-control`（父工作包 P2-03）
- 任务：1.1 变更提案迁移；1.2 `proposeChange`／`decideChange`／`getChange`／`listChanges`
- 结论：提案持久化、来源唯一、依据 hash 与旧依据拒绝已实现并通过测试；正式 P2-03 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0047 | `change_proposals`：项目／Run／来源消息／正文／状态／依据 hash／决定操作；`UNIQUE(run_id,source_message_id)` |
| `proposeChange` | 需当前资源版本 If-Match；同来源消息返回原提案；依据 hash 由 run／plan／requirement／resource revision 派生 |
| `decideChange` | 仅 PROPOSED 可决定；提交 hash 必须同时等于提案记录与当前重算值，否则 `CHANGE_BASIS_SUPERSEDED`；确认／拒绝落库 |
| `getChange`／`listChanges` | 有界读取，不暴露内部路径 |

## 测试

```powershell
node --test --test-reporter=spec tests/change-proposals.test.mjs
```

结果：2/2 通过；日志见 [change-proposals.txt](./change-proposals.txt)。

覆盖：同来源重复提案只保留一条、确认后不可再决定、错误依据被拒、Run 依据变化后旧 hash 被拒且提案仍为 PROPOSED。

## 未完成与边界

- 影响图、局部冻结（A/C 冻结而 B 继续）、应用／复验与 T3 未实现。
- HTTP API 与 OpenAPI 接入（2.1）未完成。
- 真实模型未接入；提案正文只来自用户输入。
- 正式 P2-03／G1～G4 不变。

## 追加：受保护变更 API（2.1）与验证（3.1）

- `POST /runs/{runId}/changes`：要求当前资源版本 If-Match、成员写权限；返回 202 receipt。
- `POST /changes/{changeId}:decide`：先按 change 读取所属 Run 再复核写权限；契约的 `analysisId` 改为可选（影响图未实现）。
- `GET /runs/{runId}/changes`、`GET /changes/{changeId}`：只读成员检查。
- 契约新增 `CHANGE_NOT_PROPOSED`、`CHANGE_BASIS_SUPERSEDED`；OpenAPI 增加变更读取路径（路径总数 67）。
- 验证：change 存储测试 2/2、HTTP 测试 1/1；日志见 [change-http-and-storage.txt](./change-http-and-storage.txt)。
