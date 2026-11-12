# P1-07 dataset／预览持久意图开发复核

## 范围与事实

本记录覆盖 `implement-preview-review-and-acceptance` 的开发子项 2.1：迁移 32、私有 Worker dataset／预览意图域、可信后端原操作恢复、Runner 受控数据目录解析。它不代表正式 P1-07 开工／完成、G0／G1 通过或产品验收。P1-07 仍等待 P1-06 和 G0；同一 Codex 实施与复核，不冒充独立评审。

后续子项 2.2 已实现实际本地 SQLite 数据准备，见 [数据准备开发复核](./dataset-preparation-development-review.md)。下面的能力与“尚未完成”描述保留 2.1 检查点的历史范围，当前进度以变更 tasks 和后续记录为准。

真实执行：当前迁移的 SQLite 事务、实际 SQLite Worker 关闭／重新打开与恢复扫描、实际初始化的本地 Runner store、文件／目录／硬链接／Windows junction 边界、工作空间清理后数据文件保留。

明确夹具：沿用 release-freeze fixture 的源码准入／Runtime 等来源事实；dataset 成功、预览健康／退出回执由受控测试直接提供；保护测试中的 Release 为显式插入。它们不是实际 SQLite 快照、容器运行、T5 接受或产品验证。实际数据适配器、预览服务和人工页面尚未实现。

## 存储与接口

| 实现 | 作用与边界 |
| --- | --- |
| `preview_backend_policies` | 固定项目、配置 hash、可信后端主体、Runner、template／schema、数据能力和保留天数；配置记录不可变。当前只允许可信内部装配使用，无公共配置／回执路由 |
| `datasets` | 固定原候选、原准备操作、源接受版本／dataset、受控存储键、schema 与独立保留期；不得通过停止预览或清理 workspace 删除 |
| `previews` | 每个 dataset 绑定一个预览，固定原候选／镜像／dataset／到期时间／实例；保存独立 revision 和停止操作 |
| `preview_effects` | DATASET_PREPARE、PREVIEW_START、PREVIEW_STOP 各保存原 operation、requestHash、remoteKey 与 PREPARED／SENT／UNKNOWN／SUCCEEDED／FAILED |
| `preview_effect_observations` | 原操作观察追加历史；观察、对象状态、Run revision／事件原子提交，终态回执不能覆盖 |
| `createPreviewDataset`／`createPreviewIntent` | owner、标准 meta、If-Match、准确当前候选；意图提交成功不表示外部动作成功 |
| `getPreviewDataset`／`getPreview` | 现有成员只读；保存 Run／项目归属，不接受版本；READY 且未到期且 dataset 可用才显示 AVAILABLE |
| `stopPreviewIntent` | owner、独立 previewRevision／impactReviewHash；固定原实例，Release 归属保护，无退出证据不显示停止 |
| `getPreviewEffect`／`listPreviewEffects` | 只有原策略配置的后端主体可读取原操作／分页扫描。恢复扫描每轮从 0 开始，游标是分页位置，不是状态变更订阅 |
| `markPreviewEffectSent` | 只有首次 PREPARED→SENT 得到 dispatch=true；后续一律 false。当前候选失效、首次启动已到期或已接受实例的停止均拒绝派发 |
| `recordPreviewEffectObservation` | 核实可信主体、原请求 hash 与准确 receipt；UNKNOWN 只允许核实原对象，不能申请第二次执行许可 |

通用 `operations.status=SUCCEEDED` 只表示创建意图事务已经提交。消费者必须继续读取 `preview_effects.state`，不得把通用成功状态当作 dataset READY、容器健康或停止核实。原键恢复返回同一资源的当前状态，不新建操作或实例。

SENT／UNKNOWN 的对象保持待核实，新的 dataset／预览创建被阻止。未取得任何派发许可的过时 PREPARED，可由原可信后端以 FAILED／absenceVerified 关闭；这样可以释放后续准入，又不编造一次外部执行。实际后端操作、网络、文件创建和快照必须在 Worker 事务外完成。

首次数据按冻结 INITIAL 方案明确 EMPTY／DEMO。迭代预览按原接受指针克隆原 dataset；即使接受方案为 REPLACE，也不在预览阶段清空旧数据。跨项目、源不可用、接受指针漂移、schema 不一致或未配置的迁移拒绝继续。这里只核实持久依据；实际副本／迁移完整性仍属于子项 2.2。

## 目录与保留

`RunnerDatasetPaths` 从身份匹配、已初始化的 Runner layout 解析：

```text
<runnerRoot>/datasets/<projectId>/<datasetId>/
  app.sqlite
  operation.json       # 为后续适配器保留；本步骤不声称已有实际动作日志
  app.sqlite-wal       # 如存在，同样检查
  app.sqlite-shm       # 如存在，同样检查
```

路径只由合法资源 ID 生成，不接受绝对路径、路径跳转或替代存储键；Runner、控制面、备份根必须互斥。逐级拒绝链接目录及数据库／日志／侧文件链接，拒绝硬链接文件。实际测试证明删除对应 workspace 后原 dataset 文件仍在。当前没有 dataset 到期 GC，也没有删除接口；本步骤不声称已证明恶意并发文件置换下的整个快照适配器安全。

## 验证记录

- [previews-v8-failed](./development/previews-v8-failed/evidence.json)：类型／lint／依赖构建通过，意图测试 5/7；发现预览 INSERT 占位值多一个。保留日志和失败源码，修正值数，不放宽守卫。
- [previews-v9](./development/previews-v9/evidence.json)：类型／lint／依赖构建与原 8 项意图测试通过。
- [previews-v10-failed](./development/previews-v10-failed/evidence.json)：8 项意图测试通过，4 项目录测试因测试清理顺序失败。Windows 不允许先删正在使用的 SQLite；仅停止经核实属于本次目录测试的进程，修正为先关闭 Runner 再删临时目录。
- [previews-v11](./development/previews-v11/evidence.json)：修正清理顺序后，类型／lint／依赖构建和 12 项协议／目录测试通过。
- [previews-v12](./development/previews-v12/evidence.json)：补齐已到期意图禁止首次派发后，完成 10 项检查；102 项测试中 101 通过、1 条受控 Linux Docker 条件跳过。覆盖协议／目录 13、原审查退回 13、原冻结 14、存储 28（历史版本升级至 32）、Runner 16、契约 18，以及类型／lint／当前依赖构建／OpenAPI。不是全仓库或干净 checkout 检查。
- [previews-v13](./development/previews-v13/evidence.json)：补齐私有原操作扫描后的当前源码检查；类型／lint／当前依赖构建及协议／目录 14/14。与 v12 的源码差异及不受影响检查复用依据见同目录 `reused-validation.json`；不冒充重新执行完整 v12 回归。

每轮保存真实时间、命令步骤、退出码、原日志 SHA-256 和运行时源码输入指纹；失败轮次另留实际失败源码。当前检查点字节绑定保存在 v13 的 `checkpoint-binding.json`。绑定仅证明 Git 对象与测试输入一致，不是额外测试或干净检出证明。

源码检查点为 `35ba520f593ccab06eac1bc837e89d2d3a1ed611`，v13 全部 341 个源码输入与该提交对象字节一致。v13 相对 v12 新增的两处生产源码已按准确新增文本还原并核对 v12 原 hash，确认既有写入／状态迁移分支未变化；还原依据随 `reused-validation.json` 保存。

## 尚未完成

子项 2.2：可信文件动作日志与原操作查询、首次 EMPTY／DEMO 实际初始化、SQLite 一致隔离快照、失败／ACK 丢失不重建、真实生产迁移未配置关闭。

子项 2.3／3.x：真实预览实例启动／健康／停止／到期消费者、持续可用性核实、独立 origin 网关、短期访问凭据、平台入口与 iframe。当前只有私有领域方法与路径解析器，没有预览后台消费者或公开访问地址。

子项 4.x／5.x：接受准备、fencing／数据决策、T5 事务、发布／导出恢复及完整组合／固定干净版本验证。企业认证、真实模型、Linux Docker／gVisor、真实迁移及人工产品／阶段验收仍未执行。
