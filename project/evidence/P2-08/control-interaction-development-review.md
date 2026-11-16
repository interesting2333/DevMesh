# P2-08 工作台暂停／恢复交互（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-control-interaction`（父工作包 P2-08）
- 任务：1.1 工作台暂停／恢复按钮与断线保持
- 结论：暂停／恢复真实 API 交互与断线重连保持已实现并通过 Edge 测试；取消、配置调整、变更队列与多页面竞争未实现；正式 P2-08 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 暂停 | 读取当前 `/control` 的 controlRevision，使用 `If-Match` 调用 `:pause`；失败只提示未确认 |
| 恢复 | 仅 PAUSED 且有 recoveryReviewHash 时显示；使用正文 controlRevision＋hash 调用 `:resume` |
| 状态刷新 | ControlProgress 事件与 WS 重快照后重新读取 `/control`，按钮随权威 gate 变化 |
| 取消 | **不提供**：`CancelRun` 需要 impactReviewHash，当前没有真实影响审查，不伪造哈希 |

## 测试

```powershell
node --test --test-reporter=spec --test-name-pattern="pause and resume controls" tests/browser/workbench-live.test.mjs
```

结果：1/1 通过；日志见 [control-interaction.txt](./control-interaction.txt)。

覆盖：初始 OPEN、点击暂停→PAUSING、协调器完成后 PAUSED、销毁实际 WS 重连后仍 PAUSED、点击恢复→OPEN。

## 未完成与边界

- 取消（需 impactReviewHash）、配置调整面板、变更队列、多页面竞争与完整 E2E／T08／路径五未实现。
- 真实模型／OIDC 未执行；正式 P2-08／G1～G4 不变。

## 追加：取消／配置／变更队列／多页面审计（1.2）

| 检查项 | 结论 |
| --- | --- |
| 取消 | 存储 `cancelRun` 与 API 已存在；UI 需要 `impactReviewHash`，当前没有真实影响审查服务，故不提供按钮、不伪造哈希 |
| 配置调整 | 存储与 API 已存在（P2-05），工作台没有调整面板；应用后仍暂停由后端保证 |
| 变更队列 | 存储与 API 已存在（P2-03），工作台没有队列／决定 UI |
| 多页面竞争 | 草稿／命令有 IndexedDB CAS 与多页测试；控制命令没有专门的双页 409／412 浏览器用例 |
| 完整 E2E／T08／路径五 | 未执行 |
| 结论 | 取消、配置面板、变更队列、控制多页竞争与完整 E2E 保持未实现；本轮只完成审计与记录 |

因此 1.2 以“审计完成、缺口明确”记录，不宣称完整控制交互完成。

## 追加：协作页只读配置／变更面板（1.3）

- 协作 tab 显示：配置代际、变更提案数、配置调整数，以及最多 5 条最近变更正文／状态与配置调整状态。
- 数据来自 `GET /runs/{id}/changes`、`GET /runs/{id}/config-adjustments`、`GET /config/generation?runId=`；读取失败时清空面板，不影响主流程。
- 只读，没有取消、编辑或决定操作。
- `workbench-live` 新增用例 1 条，全量 **9/9 通过**；日志见 [collaboration-panel.txt](./collaboration-panel.txt)。
