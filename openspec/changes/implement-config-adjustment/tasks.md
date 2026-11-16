# Tasks

## 1. Durable config adjustment

- [x] 1.1 新增 `config_control` 与 `config_adjustments` 迁移，以及 propose／confirm／get／list 命令；验证 PAUSED 前置、代际 CAS、应用后仍暂停、同键幂等与重启保留。
- [x] 1.2 接入受保护配置调整 API 与 OpenAPI；验证 If-Match、权限与原键。

## 2. Registry boundary and records

- [x] 2.1 记录 Registry 同步沿用既有 manifest／projection、停用／退役与回退拒绝测试的范围；不重写既有同步逻辑。
- [x] 2.2 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-05 台账；正式 P2-05 仍保持 NOT_STARTED。

## 备注

配置正文与 Registry 端点的逐字段映射、真实配置后端与 T16／T17 产品验收不在本次增量内。

2026-11-16：完成1.1／1.2／2.1／2.2，变更3/3。config_control与config_adjustments落地，PAUSED前置、代际CAS、应用后仍暂停、重启保持；受保护API/OpenAPI；Registry同步沿用既有manifest/projection测试。配置测试2/2通过；正式P2-05仍NOT_STARTED，G0～G4未变。
