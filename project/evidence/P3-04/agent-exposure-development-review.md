# P3-04 对外 Agent Exposure 生命周期（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-agent-exposure`（父工作包 P3-04）
- 任务：1.1 `agent_exposures` 迁移与 draft／validate／publish／drain／retire／catalog
- 结论：Exposure 草稿到退役的显式状态机、Card 校验与目录过滤已实现；真实外部 Agent 与服务 grant 未执行；正式 P3-04 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0054 | `agent_exposures`：项目／agentKey／revision／状态／Card 快照与 hash／操作 |
| 草稿 | Card 名称／描述／版本非空、技能非空且唯一；同项目 agentKey 唯一；hash 为 canonical JSON SHA-256 |
| 校验 | 只允许 DRAFT；重算 hash 不一致拒绝 |
| 发布／排空／退役 | VALIDATED→PUBLISHED（记录 published_at、revision+1）→DRAINING→RETIRED；其他转换拒绝 |
| 目录 | 只返回 PUBLISHED／DRAINING |

## 测试

```powershell
node --test --test-reporter=spec tests/agent-exposure.test.mjs
```

结果：1/1 通过；日志见 [agent-exposure.txt](./agent-exposure.txt)。

覆盖：重复技能拒绝、重复 agentKey 拒绝、未校验不得发布、发布记录、目录含 DRAINING、退役后目录为空。

## 未完成与边界

- 受保护 API（1.2）、默认 Card 自动生成、服务 grant、真实外部 Agent 握手与 T18／T20 未实现。
- 不写 Registry 清单或 A2A 路由；目录可见不等于可调用。
- 正式 P3-04／G1～G4 不变。

## 追加：受保护 Exposure API（1.2）

- `POST /projects/{projectId}/exposures`、`GET .../exposures?state=`、`GET .../agent-catalog`。
- `GET /exposures/{exposureId}`、`POST /exposures/{exposureId}:validate|:publish|:drain|:retire`。
- 项目成员读写权限；非法转换 409；OpenAPI 新增七个路径（总数 93）。
- `tests/input-exposure-http.test.mjs` 1/1：草稿→校验→发布→目录→排空→退役全链路与提前发布拒绝。