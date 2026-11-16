# Tasks

## 1. Workbench control actions

- [x] 1.1 工作台暂停／恢复按钮：读取当前 control revision 与 review hash、失败不乐观、重连后保持权威状态；真实 Edge 测试验证 pause→PAUSED→断线→resume。
- [ ] 1.2 审计取消、配置调整、变更队列与多页面竞争的缺口；取消需要 impactReviewHash，当前不伪造。

## 2. Records

- [ ] 2.1 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-08 台账；正式 P2-08 仍保持 NOT_STARTED。

## 备注

完整 E2E、路径五与 T08 不在本次增量内。

2026-11-16：完成1.1，变更1/3。工作台暂停／恢复按钮接入真实控制API，失败不乐观，断线重连保持PAUSED并可恢复；取消需impactReviewHash故不提供；配置调整、变更队列、多页面与完整E2E未实现。正式P2-08／G1不变。证据：`project/evidence/P2-08/control-interaction-development-review.md`。
