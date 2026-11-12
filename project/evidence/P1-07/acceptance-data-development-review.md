# 接受数据文件准备开发复核

日期：2026-11-13。实施与复核：Codex，同一 Agent。父工作包 P1-07，OpenSpec `implement-preview-review-and-acceptance`。起点 `5bad684`，工作树开发验证，不代表固定提交干净 checkout、独立人员或产品验收。正式工作包仍等待 P1-06／G0，变更仍为 7/13，完整 4.1 未勾选。

## Change

增加显式本地 `LocalSqliteAcceptanceDatasetBackend` 和专用 Worker，直接处理原 acceptance preparation，输出 MATERIALIZED 数据阶段证据；没有实现完整 AcceptancePreparationBackend，也不伪造 PreviewEffect、服务健康、READY、Release 或 T5。没有默认物理 custody 适配器；缺配置不派发。路径只能从节点配置及项目／dataset ID 派生。

独立 ACCEPTANCE v2 `operation.json` 固定原请求／hash／releaseId／应用 UUID，排他创建后唯一胜出者才可 acquire。原源／目标持有记录排他保存到 `fences.json`；新建前、acquire 前和快照前后发布前检查授权及准确持有代际。部分对象、失联、丢 ACK、Worker 超时、配额与授权失败保留原日志和文件，恢复只 inspect、不重授／重建／重跑迁移。未完成 staging 不能补写为成功原对象。

INITIAL／REPLACE 使用实际 SQLite EMPTY／DEMO 初始化。REPLACE 保留基线和原源 custody，物理 origin 为 null，不复制原数据。PRESERVE_MIGRATE 读取原 artifactRef 实际字节，校验 hash、显式操作者信任摘要及严格 COPY_SAME_SCHEMA 声明；仅固定 web-crud 同 schema 复制，未配置任意 SQL／脚本或跨 schema 升级。SQLite 一致备份处理已提交 WAL，独立应用 UUID／profile／完整性／容量检查后排他发布，回执绑定实际数据、journal 和持有文件摘要。

受限共同读取器保留预览 v1 和接受 v2 原用途。接受目标恢复严格核实初始文件字节和非空 WAL／journal；已接受业务源允许正常后续写入，但仍核实原操作／release／项目／Runner／marker／schema／配额。后续预览能从准确接受源取得实际独立副本。

首次测试发现模板只读模式仍执行 journal_mode=WAL，改写准备文件头。模板连接现使用 SQLite 原生 readOnly／query_only 并保留原 journal mode，另加实际 DELETE-mode 文件读取前后字节一致用例。进程锁仅表示准入，不是物理排空证明。

## Validation

最终数据／已有预览数据副本／原归属组 24/24 通过，无跳过／取消；模板类型、构建及单元／HTTP 24/24 通过，模板组最后的根 Lint 通过。原 Runner 构建、根类型检查和 Lint 通过；最终 137/137 份源码映射匹配。最终文件组与模板组执行期间捕获的输入／控制相关产物均不变，最终输入绑定确认原归属用例逐字节匹配 HEAD、运行代码及产物仍对应原构建。

首轮两项模板只读后摘要恢复失败，在定位后主动终止失败批次，退出码 1、部分 TAP 与明确 interruption 记录保留，不能称为完成的全量回归。修正后按独立文件执行完整最终组，没有删除或覆盖原失败。原始日志、driver、输入／产物指纹、模板 JSON／覆盖摘要和最终绑定保存在 [development/acceptance-data](./development/acceptance-data/)。管理与差异检查结果以该目录 post-1 原输出为准，不把前轮结果计作本轮执行。

新增测试最初误用了已有 `acceptance-datasets.test.mjs` 文件名。首次构建和失败批次使用该临时替换版本，未运行原归属用例；随后把新用例独立保存为 `acceptance-dataset-files.test.mjs`，将原文件按 HEAD blob 原字节恢复。独立最终组包含两者，不能把首轮结果归给被临时替换的原用例。

首个 driver 的源码指纹包含 packages／apps／tests／scripts，没有 templates；不补写未在起点捕获的模板输入。修正后的 driver 增加 templates／TSX，各最终组记录执行期间源码和 Runner／控制相关分发产物有无变化。受控 authority 与接受依据／OCI 身份明确为夹具；实际 SQLite 文件、WAL、副本、hash、Worker 与模板连接为真实本地执行。

## Scope and remaining work

尚未执行真实 Linux／Docker／gVisor、源／目标全写入口物理隔离、容器服务装配、正式正向迭代接受、T5／发布／导出、根 pnpm check 整条流水线或浏览器专项。本轮数据阶段不替代其验收；Windows／目标文件系统断电持久性也未演练。迁移范围只包括固定同 schema 复制，物理 custody 测试均为明确受控声明。

适配器重建用例复用受控内存 authority，专用 Worker 与 SQLite／文件是真实重开；它不覆盖真实 authority 服务的持久化重启或实际物理持有恢复。

后续继续准确接受服务用途和 Runner 归属、控制面／数据／服务的可信组合、准备终止与安全恢复，再实现 T5 原子接受及独立发布／导出。P0-07 正式缺项、P1-07 正式状态、阶段门槛与产品验收不据此关闭，OpenSpec 不归档。
