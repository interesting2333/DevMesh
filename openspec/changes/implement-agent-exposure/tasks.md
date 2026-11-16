# Tasks

- [x] 1.1 新增 `agent_exposures` 迁移与 draft／validate／publish／drain／retire／get／list／catalog 命令；验证状态机、Card 校验与目录过滤。
- [x] 1.2 接入受保护 Exposure API 与 OpenAPI。
- [x] 1.3 保存日志与边界，同步文档与 P3-04 台账；正式 P3-04 仍保持 NOT_STARTED。

## 备注

默认 Card 自动生成、服务 grant、真实外部 Agent 握手与 T8 不在本次增量内。

2026-11-16：完成1.1，变更1/3。迁移0054新增agent_exposures；draft／validate／publish／drain／retire／catalog落地，状态机、Card校验、目录过滤与唯一agentKey生效；agent-exposure测试1/1通过。受保护API与文档同步未完成；正式P3-04／G1不变。证据：`project/evidence/P3-04/agent-exposure-development-review.md`。

2026-11-16：完成1.2／1.3，变更3/3。Exposure API与OpenAPI接入；设计04、验收、实施文档追加记录，基线更新，OpenSpec与台账同步。正式P3-04仍`NOT_STARTED`，G0～G4未变。