# P1-07 D01～D08 与 T5 覆盖记录（5.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-preview-review-and-acceptance`（父工作包 P1-07）
- 任务：5.1 将准确候选、审查、实际本地数据副本和 HTTP 预览／发布组合验证，逐项记录 D01～D08 与 T5 的实际覆盖；受控后端不代替真实构建／健康或产品验收
- 结论：组合验证由固定提交 `9ab99fe` 干净 checkout 的 `test:acceptance` 321/321、`test:preview-browser` 6/6、`test:review-browser` 4/4 实际运行承载；下表逐项记录覆盖与明确未覆盖项。**不宣称真实 OIDC／Linux／容器／物理健康或产品验收通过**

## 依据

- [clean-checkout-9ab99fe.md](./clean-checkout-9ab99fe.md)
- [acceptance.log](./clean-checkout-9ab99fe/acceptance.log)
- [preview-browser-rerun2.log](./clean-checkout-9ab99fe/preview-browser-rerun2.log)
- [review-browser.log](./clean-checkout-9ab99fe/review-browser.log)

## D01～D08

| 场景 | 实际覆盖 | 证据 | 未覆盖／边界 |
| --- | --- | --- | --- |
| D01 逐项检查需求，一项失败或未验证 | 逐项审查、自动事实与人工结论分离、未完成不开放接受 | `tests/candidate-review.test.mjs`、`tests/verification-freeze.test.mjs`、`tests/acceptance-entry.test.mjs`、`tests/browser/review-entry.test.mjs` | 人工观察与上游来源为显式夹具 |
| D02 必要人工检查未完成 | 人工 PASS／FAIL 单独记录；全自动最终 Work 不伪造人工完成 | `tests/candidate-review.test.mjs`、`tests/acceptance-commit.test.mjs`（“T5 accepts a fully automatic final Work without inventing human completions”） | 真实人工签认未执行 |
| D03 退回原范围问题再提新增功能 | 原范围退回、分类纠正、撤回与新增范围分别记录；用户可纠正系统判断 | `tests/candidate-rejection.test.mjs`、`tests/browser/review-entry.test.mjs`、`tests/acceptance-successor.test.mjs` | 新增范围的后续执行不在本变更验收内 |
| D04 审查期间代码变化后接受旧内容 | 审查依据、reviewHash、候选冻结与旧依据拒绝；审查变化使固定接受依据失效 | `tests/candidate-basis.test.mjs`、`tests/verification-freeze.test.mjs`、`tests/acceptance-intents.test.mjs`（“a changed human review invalidates the fixed basis”） | 真实 Git 仓库变化用夹具提交 |
| D05 接受保存失败／接受后打包失败 | 每个写入边界回滚与原键恢复；打包失败保留接受版本与成果，只重试导出 | `tests/acceptance-commit.test.mjs`（“rolls back every boundary and recovers exact committed acceptance”）、`tests/release-export.test.mjs`、`tests/browser/release-export-entry.test.mjs` | 真实打包工具与远程制品存储未执行 |
| D06 下载部分成果、打开预览但不接受；错误用途／撤权／到期／票据并发／iframe 隔离 | 独立访问票据与短期会话、用途／成员／目标复核、单次兑换、父页面存储与 Service Worker 隔离 | `tests/release-export.test.mjs`、`tests/preview-access.test.mjs`、`tests/preview-sessions.test.mjs`、`tests/release-access.test.mjs`、`tests/browser/preview-entry.test.mjs`、`tests/browser/preview-isolation.test.mjs` | 真实 HTTPS／可注册域与容器为本地证书／主机映射与夹具 |
| D07 预览到期／重启／取消；仅创建未启动与移除丢回执 | 原实例／到期／watchdog、REMOVED 证明、容量与历史同事务；停止未接受预览不连带旧 release／dataset | `tests/preview-lifecycle*`、`tests/preview-watchdog`、`tests/preview-cleanup`、`tests/preview-container`、`tests/runner-preview-*.test.mjs` | 真实 Docker/runsc、宿主网络与硬配额未执行 |
| D08 新版本影响数据；写门并发／回执丢失／重启；接受／撤销竞态 | 原 fence 串行、UNKNOWN 保留、原键重试、不可变撤销决定与 T5 互斥、ABORTING 关闭准备与 READY | `tests/acceptance-data-drain.test.mjs`、`tests/acceptance-datasets.test.mjs`、`tests/acceptance-abort*.test.mjs`、`tests/dataset-consumer.test.mjs`、`tests/release-publication.test.mjs`、`tests/storage-acceptance-*.test.mjs` | 实际物理数据迁移、容器与源恢复未执行；真实业务库为本地 SQLite |

## T5

| 覆盖点 | 实际证据 |
| --- | --- |
| T5 原子 Release／接受指针／必要人工完成／Run 终态／Outbox／事件 | `tests/acceptance-commit.test.mjs` 覆盖每个写入故障回滚、并发 CAS、原键恢复、缺项／未知写阻塞；干净 checkout `test:acceptance` 通过 |
| 准确材料预检先于 HTTP T5，ACK 恢复只保留一份 Release | “actual material preflight precedes HTTP T5 and committed ACK recovery preserves one accepted release” |
| 数据准备 → 模板 HTTP → T5，无预览副作用 | “formal control preparation composes actual data and template HTTP then commits exact T5 without preview effects” |
| 第二轮 PRESERVE／REPLACE 与第二次 T5 | `tests/acceptance-successor.test.mjs`、`tests/release-successor-publication.test.mjs`（“formal successor PRESERVE_MIGRATE … commits a second T5”“REPLACE … second T5”） |
| 发布阶段 continuation 与丢 ACK 只查原阶段 | `tests/release-continuation.test.mjs`、`tests/release-publication.test.mjs` |

## 结论与边界

- 本记录完成的是**受控组合覆盖**：准确候选、审查、数据副本、HTTP 预览、T5、发布与导出在真实本地 SQLite／HTTP／Worker／Edge 上组合运行；未把受控容器、OCI、fence、健康或浏览器身份当作真实产品验收。
- 明确未覆盖：企业 OIDC、真实 Linux Runner／Docker/runsc、真实容器与网络隔离、真实迁移执行、真实 HTTPS 可注册域、人工产品验收。
- 据此 5.1 记录完成；2.3／4.1／4.3 与正式 P1-07／G0 状态不变。
