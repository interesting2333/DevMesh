# P1-07 接受准备意图开发复核

日期：2026-11-13。实施／复核为同一 Codex Agent，范围是本地代码、原始执行输出和源码绑定，不是独立人员或人工验收。本次是 OpenSpec 4.1 的首批实现；完整 4.1 保持未勾选，变更仍为 7/13，正式 P1-07 等待 P1-06／G0。

## 当前行为

迁移 36 在私有 SQLite Worker 中保存独立后端策略、准确替换确认、接受准备意图和不可变历史。负责人必须提供标准 meta、当前强 If-Match、CURRENT 候选 revision／manifestHash、完整 PASS 的 reviewHash、原接受指针和完整数据方案 hash。服务端固定 Run 代际、准确镜像与原数据身份，预留原 releaseId／新 datasetId 和派生存储键。没有登记可信后端策略时关闭。

配置的后端主体只能为同一原请求取得一次 PREPARED→SENT 派发许可。SENT／UNKNOWN 在实际 Worker 重开后保留，丢许可或观察 ACK 不再发放执行许可；未核实前不能建立替代准备。当前负责人只能通过独立原键关闭准确且从未派发的 PREPARED。审查变动或成员降权使原依据变为 STALE，拒绝继续派发，历史仍保留。意图、operation、追加历史、事件和 Run 版本在一个事务中提交或回滚。

REPLACE 的独立确认代码绑定原候选、审查、已接受 release 和 dataPlanHash；本批正向数据方案只验证 INITIAL，验证了首次方案不能伪造替换确认。迭代保留／正向替换、实际准备和其凭证尚待后续验证。意图不创建数据文件、dataset 行、Release 或接受事实，没有 READY、外部准备执行、物理 fencing／健康凭证或 T5 命令；当前没有公共 HTTP／MCP 接受或策略登记入口。

## 实际执行

原始报告、输出、命令和可重建源码差异见 [retention](./development/acceptance-intents/retention.json)。失败记录保持原字节。

| 执行 | 结果与范围 |
| --- | --- |
| acceptance-build-1 | contracts／storage 构建、契约生成、根类型检查、Lint 和 OpenAPI 一致性均返回 0。构建绑定记录核对六个依赖包的 131 项一方 TS，全部与内嵌源码一致。 |
| acceptance-1 | 24 项，22 通过、2 失败：第一项在原质量／交付准备阶段被拦截；第二项已进入接受协议，用例给严格历史查询多传 expectedRevision，返回 SCHEMA_INVALID。其余 3 项接受协议、18 项契约及 1 项迁移通过。 |
| acceptance-2 | 34/34，失败／取消／跳过均 0；实际文件数据库、Worker、v1～v35 历史升级／备份、迁移失败回滚、写锁／终止恢复和存储约束。 |
| acceptance-3 | 32/32，失败／取消／跳过均 0；5 项接受准备、18 项契约、1 项迁移及共享夹具修正后的 8 项实际质量收集回归。 |

接受协议实际使用文件数据库／单写 Worker，验证并发派发仅一个许可、UNKNOWN 与丢 ACK 重开恢复、原键／历史分页、陈旧审查、权限、严格参数、未派发关闭及历史／事件故障的完整事务回滚。迁移用例从 v35 实际文件开始，故障时新表、原行和版本标记一起回滚，随后按原迁移重试到 v36。原 SQL 1～35 保持不变。

诊断复跑仅在忽略目录中给夹具副本增加观察。一次诊断发现原 Runner job 虽 exitCode=0 但 stopRequested=true，质量按规则 FAIL；策略 hash／正文一致。进一步时间轨迹显示，旧夹具提前取得 15 秒授权，提交时只余约 4 秒，一次成功轨迹直到退出只剩约 0.7 秒。这支持修正夹具的签发时点，但不能证明最初每次失败的精确停止原因，因为最初没有保留完整 Runner 时间轨迹。诊断执行不计入协议测试通过数。

该夹具没有真实 A2A Runtime 心跳。修正仅在显式 DB 授权夹具中于派发前签发 15 秒 grant，继续经过真实 Runner HTTP、权限、原文件与质量收集；不把它称为生产续租。生产 15 秒租约、10 秒作业超时及失败交付守卫未改变。质量收集回归仍验证实际失败 Job／失败断言保留 FAIL、UNKNOWN 只查原操作、内容／最终 ACK 恢复不重跑、原输出 hash 和流式大小边界。另修正历史查询测试的多余参数，协议仍为严格 schema。

早期一次直接类型检查曾报告品牌 ID 和成员空值类型错误；修复后上述保留构建和类型检查返回 0。该早期检查未保存完整原始源码／日志，不把它当作可重建的执行证据。

每次报告保存 baseCommit、源 SHA、仅变化文件 source-delta、命令、环境和退出码。三次执行过程中各自指纹均未变化；存储运行早于夹具／测试／命令清单修正，差异逐项见 [source-comparisons](./development/acceptance-intents/source-comparisons.json)，不称三组为同指纹全量重跑。当前增加 pnpm test:acceptance 并接根检查；CI 的 Foundation 步骤接入及留存后检查另有真实记录，不能称远程 CI 或干净 checkout 已执行。

留存后 CI 脚本语法／入口清单核对、Lint、台账、全部 OpenSpec 严格校验、设计主文一致性和 diff 检查均返回 0，见 [post-retention](./development/acceptance-intents/post-retention/report.json)。最终用例结束后，438 个输入中仅 `scripts/verify-foundation.mjs` 新增已经执行过的接受测试组，其余 437 个输入未变；原运行版本和最终版本 hash 见 [post-validation-source-changes](./development/acceptance-intents/post-validation-source-changes.json)。这项清单修正单独做语法／入口核对，不称产品测试再次执行。

## 后续范围

在同一准备身份上继续实现实际数据准备与原对象查询、物理关闭／排空／迁移和可信完整性、准确 Runner 归属／健康凭证，然后实现 T5 与独立发布／导出恢复。企业身份、真实模型、Linux Docker／gVisor、硬配额／宿主隔离及产品／阶段验收继续保留条件。当前人工结论、源 Git／A2A 准入、镜像／容器事实是明确夹具；实际 SQLite／Worker／文件／HTTP 验证不替代这些事实。
