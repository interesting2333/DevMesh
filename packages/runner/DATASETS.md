# 本地 SQLite 数据准备

`LocalSqliteDatasetBackend` 是显式 `local-development` 适配器，准备实际的模板业务数据。默认平台启动不会创建它，也不会自动消费预览意图。生产迁移与容器启动／健康属于后续配置和实施。

可信装配必须先初始化 Runner store，并在控制面内部登记准确的预览后端策略。配置的 `runnerId`、`backendRef`、模板和 schema 必须与原 DATASET_PREPARE 请求一致。只有策略配置的服务主体能够通过 `DatasetPreparer` 读取、派发和记录该操作；项目 owner 的普通身份不能提交成功回执。没有适配器时操作停留在 PREPARED，返回 `DATASET_BACKEND_NOT_CONFIGURED`。

当前只支持固定的 `web-crud-v1`／`web-crud-v1.schema.1`：首次 EMPTY 或 DEMO，后续使用源 dataset 的 SQLite backup 一致副本。副本包含已提交 WAL，使用新的应用数据集身份，保留业务记录；后续写入彼此隔离。未知模板、schema 或跨版本迁移返回不可用，模型不能提供 SQL 或任意文件路径。

文件按 Runner layout 保存，独立于 workspace、控制数据库和备份：

```text
datasets/<projectId>/<datasetId>/
  operation.json       # 原请求、hash、新应用身份；独占创建，永久保留
  preparing.sqlite     # 只在本次准备中创建；失败保留
  app.sqlite           # 校验后独占发布
  dataset.json         # 与原模板兼容的应用数据集身份
  receipt.json         # 原准备完成证据；独占创建，永久保留
```

后端在独立 Worker 执行文件和 SQLite 操作，控制面短事务只提交意图、一次派发许可和观察结果。默认最多 2 个 Worker，排队最多 128 个；每次操作有超时，默认数据上限 64 MiB。源数据库只读，副本完成前验证模板 schema、身份、行容量与 SQLite 完整性。数据目录、数据库和侧文件拒绝链接／硬链接。

恢复遵循原对象协议：

- `DatasetPreparer.advance(operationId)` 仅在首次成功取得 PREPARED→SENT 许可后调用 `prepare`；已发送或未知状态只调用 `inspect`。
- `operation.json` 一旦存在，同一后端的 `prepare` 也只能核实原文件，不能重建或覆盖。不存在、部分文件、损坏证据或配额失败保持 UNKNOWN。
- `recoverPage` 扫描配置项目／策略的原操作，每一轮从游标 0 开始。派发许可回执丢失但未真正执行时，也不猜测为安全重发。
- 已完成副本独立核实自己的日志、回执、身份及完整性；不依赖源数据库继续可用。回执中的 hash／字节数描述准备完成时的快照，后续合法业务写入不会改写原回执。

失败恢复不提供清理、修复或重建接口；保留原文件用于后续人工核实。停止预览／清理 workspace 不删除 dataset。不能把准备成功视为预览健康或版本接受。

Windows 使用可写临时文件句柄执行 `fsync`；目录刷新只在支持的非 Windows 系统执行。当前 Windows 验证不构成 Linux 或突然断电后的持久性验收。实际兼容性、快照隔离、故障与回执丢失测试见 `tests/verification-datasets.test.mjs`，使用未修改的模板数据库实现；来源／准入与测试源 Release 身份仍为明确夹具。
