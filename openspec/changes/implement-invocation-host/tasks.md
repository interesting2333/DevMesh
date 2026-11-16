# Tasks

## 1. Durable invocation

- [x] 1.1 新增 `invocations` 迁移与 create／get／list／transition 命令；验证幂等、同键不同请求拒绝、状态机与终态保护。
- [ ] 1.2 接入受保护 Invocation API 与 OpenAPI；验证主体/项目绑定与端点检查。

## 2. Public task kernel and records

- [ ] 2.1 审计公共 Task/Inbox、主体配额与取消核实范围；记录缺口，不伪造实现。
- [ ] 2.2 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-06 台账；正式 P2-06 仍保持 NOT_STARTED。

## 备注

公共 Task/Inbox 消费者、主体配额、真实取消核实与 T7/T20/T21 不在本次增量内。

2026-11-16：完成1.1，变更1/4。迁移0050新增invocations；create／get／list／transition落地，同键幂等、同键不同请求拒绝、显式状态机与终态保护；invocation-host测试2/2通过。受保护API、公共Task/Inbox、配额与文档同步未完成；正式P2-06／G1不变。证据：`project/evidence/P2-06/invocation-host-development-review.md`。
