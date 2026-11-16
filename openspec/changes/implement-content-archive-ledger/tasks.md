# Tasks

- [x] 1.1 新增 `content_archive_requests` 迁移与 request／ack／get／list 命令；验证幂等、ACK 不删除、丢失 ACK 保持 REQUESTED。
- [ ] 1.2 接入受保护归档 API 与 OpenAPI。
- [ ] 1.3 保存日志与边界，同步文档与 P2-07 台账；正式 P2-07 仍保持 NOT_STARTED。

## 备注

GC 删除、分块日志、容量限制与 T22／T23 不在本次增量内；本增量没有删除路径。

2026-11-16：完成1.1，变更1/3。迁移0053新增content_archive_requests；request／ack／get／list落地，同键幂等、ACK不删除、丢失ACK保持REQUESTED；content-archive测试1/1通过。受保护API与文档同步未完成；本增量无删除路径，正式P2-07／G1不变。证据：`project/evidence/P2-07/content-archive-development-review.md`。
