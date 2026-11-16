# Tasks

## 1. Pins and diagnostics

- [x] 1.1 新增 `content_pins` 迁移与 pin／release／list／diagnostics 命令；验证幂等、同键不同 hash 拒绝、释放不删内容与计数准确。
- [ ] 1.2 接入受保护 pin 与诊断 API，更新 OpenAPI。

## 2. GC and archive boundary

- [ ] 2.1 审计 GC 计划／提交、归档 ACK、分块日志与容量限制的缺失；明确“无删除路径”，不伪造 T22／T23。
- [ ] 2.2 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-07 台账；正式 P2-07 仍保持 NOT_STARTED。

## 备注

GC／归档删除、分块日志、容量限制与 T22／T23 不在本次增量内。

2026-11-16：完成1.1，变更1/4。迁移0051新增content_pins；pin／release／list／getStorageDiagnostics落地，幂等、同键不同hash拒绝、释放不删内容、计数准确。content-pins测试1/1通过。受保护API、GC／归档与文档同步未完成；本增量无删除路径，正式P2-07／G1不变。证据：`project/evidence/P2-07/content-pins-development-review.md`。
