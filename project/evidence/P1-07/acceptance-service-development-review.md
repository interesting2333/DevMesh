# 接受服务原日志与容量开发复核

日期：2026-11-13。实施与复核：Codex，同一 Agent。父工作包 P1-07，OpenSpec `implement-preview-review-and-acceptance`。起点 `4d24342`，工作树开发验证，不代表固定提交干净 checkout、独立人员或产品验收。正式 P1-07 仍等待 P1-06／G0，完整 4.1 未勾选，变更仍为 7/13。

## Change

增加准确 ACCEPTANCE 原服务请求，固定完整原接受依据、实际数据回执与原源／目标 fences，不创建预览 effect。Runner v7 新增独立服务预留／不可变历史、只读 profile、唯一 network／create／start 日志；v2～v6 迁移正文及其原摘要保持不变。接受服务与预览分开分页与恢复，不进入预览 watchdog／清理。

作业 claim、预览 reserve 和接受服务 reserve 在一个 Runner writer 内核算全局 slot／CPU／内存，跨 controller／用途 dataset 独占。UNKNOWN／重启继续占用；只有原从未派发取消或准确原实例 EXITED 观察释放。profile 固定原资源／目录／仓库／网络与容器名，唯一 dispatch／动作 SENT 和前置对象核验阻止丢 ACK 后重派或替换。观察绑定原实例、端口、CAS 及时间，历史故障回滚状态和容量。

独立 `devmesh.acceptance-service-claim.v1` 绑定原接受 hash、serviceRequestHash、reservation／profile、release／project／Run／candidate／manifest／review／数据方案／dataset／image／实例。新鲜准确健康后才可取得 RELEASE_HELD，原 claim 不可替换，丢 ACK 恢复同一归属；HELD 不表示 T5 或 OWNED。旧预览入口明确保留旧 schema，控制面 prepared proof 兼容读取原 claim 并增加新服务 claim 绑定校验。

## Validation

最终 service-1 12/12、regression-1 15/15、migrations-1 2/2 通过；具体选择范围、测试数量、跳过／取消计数和实际命令见原始 report／TAP。六包构建、根类型检查及 Lint 通过，140/140 份运行源码映射匹配，v2～v6 的 5 份原迁移正文逐字节匹配 HEAD。首轮六包构建成功、根类型检查失败（旧预览 alias 缺少用途边界），原始日志保留；修正明确预览 schema 后重新验证通过。

原始命令、输出、输入／产物指纹、映射与最终绑定保存在 [development/acceptance-service](./development/acceptance-service/)。迁移专项使用明确 test-name-pattern，仅运行相关历史升级用例；不视为整个 cleanup／watchdog 文件的全量回归。管理与差异检查以该目录 post-1 的本轮实际结果为准。

本轮 render／project check、全部 OpenSpec 严格校验（16 项）、完整设计、contracts、Lint、未暂存及已暂存差异检查共 8/8 通过。上述三个测试组共 29/29 通过，均无跳过或取消；执行期间各组输入及产物未变化。

构建日志中的打包插件警告原样保留；运行源码／产物绑定另行核实，不把声明文件插件警告当作运行时代码一定匹配或不匹配的证据。新增 JavaScript 控制面 claim 用例在第二轮包构建完成后、根 TypeScript 检查期间加入，属于 tsconfig 外的 `.mjs`，实际差异保留；不能称整个第二轮 build driver 的全部输入不变。运行时 TypeScript 未再修改，随后 Lint 与测试包含该用例。各正式测试组期间的输入／产物变化按实际报告记录。

## Scope and remaining work

本轮 Runner SQLite／Worker、实际接受数据文件、迁移及事务故障为本地真实执行。接受依据、OCI 身份、网络／容器、HEALTHY／EXITED 与物理 fence 均为明确的受控测试事实；没有执行真实 Docker／gVisor、实际容器 HTTP 健康或物理写入隔离。

当前尚无接受服务 Driver 和完整 AcceptancePreparationBackend 的可信装配，不提供 T5、RELEASE_OWNED、已核实未提交后的安全撤销／停止或发布／导出恢复。Runner 日志仅为后续服务准备提供准确持久原对象，不能称为完整 READY 或正式正向接受。新服务没有预览 TTL，已派发未知对象继续保留归属及占用，专用停止／撤销协议必须继续完成。

未执行根 `pnpm check` 全流水线、浏览器专项、真实 Linux、固定提交干净 checkout、独立评审或产品验收。正式工作包与门槛不据此关闭，OpenSpec 不归档；后续继续真实用途服务适配／数据与控制面组合，再推进完整准备、T5 与发布。
