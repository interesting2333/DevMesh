# Tasks

## 1. Durable proposals and decisions

- [x] 1.1 新增变更提案迁移（项目／Run／来源消息／正文／状态／依据 hash／决定操作）与唯一约束；验证升级与回滚。
- [x] 1.2 实现 `proposeChange`／`decideChange`／`getChange`／`listChanges`：依据 hash 派生、旧依据拒绝、终态保护与幂等；验证同来源唯一。

## 2. HTTP and contracts

- [ ] 2.1 接入受保护的变更提案与决定 API，更新 OpenAPI 与错误码；验证权限、If-Match 与原键。

## 3. Verification and records

- [ ] 3.1 用真实存储验证提案、决定、旧依据拒绝、重复来源与重启保留；保存日志与边界。
- [ ] 3.2 同步设计／验收／实施文档、基线、OpenSpec 与 P2-03 台账；正式 P2-03 仍保持 NOT_STARTED。

## 备注

影响图、局部冻结、应用／复验与 T3 不在本次增量内。

2026-11-16：完成1.1／1.2，变更2/4。迁移0047新增`change_proposals`（来源消息唯一、依据hash）；proposeChange／decideChange／getChange／listChanges落地，旧依据拒绝、终态保护与重复来源幂等。change-proposals测试2/2通过。影响图／局部冻结／应用复验、HTTP API与文档同步未完成；正式P2-03／G1不变。证据：`project/evidence/P2-03/change-proposals-development-review.md`。
