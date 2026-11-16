# Tasks

## 1. Workbench control actions

- [x] 1.1 工作台暂停／恢复按钮：读取当前 control revision 与 review hash、失败不乐观、重连后保持权威状态；真实 Edge 测试验证 pause→PAUSED→断线→resume。
- [x] 1.2 审计取消、配置调整、变更队列与多页面竞争的缺口；取消需要 impactReviewHash，当前不伪造。
- [x] 1.3 协作页只读展示配置代际、变更提案与配置调整；不提供取消／编辑／决定操作。

## 2. Records

- [x] 2.1 保存日志与边界，同步设计／验收／实施文档、基线、OpenSpec 与 P2-08 台账；正式 P2-08 仍保持 NOT_STARTED。

## 备注

完整 E2E、路径五与 T08 不在本次增量内。

2026-11-16：完成1.1，变更1/3。工作台暂停／恢复按钮接入真实控制API，失败不乐观，断线重连保持PAUSED并可恢复；取消需impactReviewHash故不提供；配置调整、变更队列、多页面与完整E2E未实现。正式P2-08／G1不变。证据：`project/evidence/P2-08/control-interaction-development-review.md`。

2026-11-16：完成1.2／2.1，变更3/3。取消／配置／变更队列／多页面审计确认未实现；设计03、验收、实施文档追加记录，基线更新，OpenSpec与台账同步。正式P2-08仍`NOT_STARTED`，G0～G4未变。

2026-11-16：追加1.3，协作页只读展示配置代际／变更提案／配置调整；读取失败清空面板，不影响主流程。workbench-live 9/9通过；取消／编辑／决定仍不提供，正式P2-08与门槛不变。
