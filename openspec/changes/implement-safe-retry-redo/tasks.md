# Tasks

## 1. Durable redo

- [x] 1.1 新增 `run_redos` 迁移与 `redoRun`：仅 FAILED／CANCELLED、固定 baseCommit、新 Run 为空、活动 Run 拒绝、幂等；用真实存储验证。
- [ ] 1.2 接入受保护 `:redo` API 与 OpenAPI，验证权限与 If-Match。

## 2. Retry and records

- [ ] 2.1 审计 `RetryWork`：失败 attempt 的新 attempt 重建、预算桶与材料复用边界；无法离线闭环时明确记录。
- [ ] 2.2 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-04 台账；正式 P2-04 仍保持 NOT_STARTED。

## 备注

材料复用矩阵与 T4／T10 不在本次增量内。

2026-11-16：完成1.1，变更1/3。迁移0048新增run_redos；redoRun仅接受FAILED／CANCELLED、固定baseCommit、新Run为空、活动Run拒绝、同键幂等。redo-run测试1/1通过。RetryWork、受保护API、材料复用与文档同步未完成；正式P2-04／G1不变。证据：`project/evidence/P2-04/redo-run-development-review.md`。
