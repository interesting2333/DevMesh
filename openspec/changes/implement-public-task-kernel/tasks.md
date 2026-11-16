# Tasks

- [x] 1.1 新增 `public_tasks` 迁移与 enqueue／claim／complete／get／list 命令；验证幂等、主体配额、租约重领、owner 校验与终态保护。
- [ ] 1.2 接入受保护公共任务 API 与 OpenAPI。
- [ ] 1.3 保存日志与边界，同步文档与 P2-06 台账；正式 P2-06 仍保持 NOT_STARTED。

## 备注

缺信息补齐、取消核实、外部 Agent 调用与 T7/T20/T21 不在本次增量内。

2026-11-16：完成1.1，变更1/3。迁移0052新增public_tasks；enqueue／claim／complete／get／list落地，同键幂等、主体配额、租约重领、owner校验与终态保护；public-tasks测试2/2通过。受保护API与文档同步未完成；正式P2-06／G1不变。证据：`project/evidence/P2-06/public-task-kernel-development-review.md`。
