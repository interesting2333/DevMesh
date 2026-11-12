# P1-07 实际 SQLite 数据准备开发复核

## 范围

覆盖 `implement-preview-review-and-acceptance` 开发子项 2.2。它承接 [持久意图记录](./preview-intent-development-review.md)，实现实际文件操作和数据准备；不是正式 P1-07／阶段或产品验收。同一 Codex 实施与复核，正式工作包继续等待 P1-06／G0。

本次真实执行 SQLite EMPTY／DEMO 初始化、SQLite backup、文件持久日志／回执、未修改的模板 `TaskDatabase` CRUD、私有控制面命令及实际控制 SQLite Worker 关闭／重开。来源／源码准入／Runtime 等上游事实沿用显式 fixture，快照测试源 Release 身份也是 fixture；没有实施 T5 接受来生成源 Release。

## 实现和恢复

| 实现 | 行为 |
| --- | --- |
| `datasetPreparationRequest` | 严格绑定原操作、requestHash、项目／Run／候选／manifest、策略、Runner／backend、准确目标／来源键、schema 和首次数据模式 |
| `LocalSqliteDatasetBackend` | 仅显式 `local-development` 配置启用；每次操作由独立 Worker 运行，默认 2 个并行 Worker、128 个等待项、30 秒超时、64 MiB 容量 |
| `dataset-profile.ts` | 固定可信 `web-crud-v1`／`web-crud-v1.schema.1` SQL；检查准确表定义、应用身份、SQLite 完整性、任务字段及任务／回执容量；模型不能提交 SQL |
| `dataset-worker.ts` | 先独占保存原 journal，再初始化／备份到本次临时 SQLite；校验后独占发布数据库、原模板 marker 和完成 receipt；文件动作位于控制面事务外 |
| `DatasetPreparer` | 组合实际私有控制命令；只有首次派发许可明确返回 true 才执行 prepare，SENT／UNKNOWN 只 inspect；使用已配置服务主体，无公共回执入口 |
| 原模板兼容 fixture | 原样读取模板 database／dataset／task 源文件，以 Node 原生 TS 转换执行，使用锁定的实际 Zod；不依赖先前模板构建产物，不修改模板 |

可信装配和操作说明见 [DATASETS.md](../../../packages/runner/DATASETS.md)。平台默认启动尚未装配此消费者；未配置时返回 `DATASET_BACKEND_NOT_CONFIGURED` 并保持 PREPARED。未知模板／schema 或跨 schema 迁移返回不可用，不将复制当迁移成功。

目标目录为独立 Runner 根下的 `datasets/<projectId>/<datasetId>/`。新增 `preparing.sqlite`、`dataset.json`、`receipt.json`；原 `operation.json` 固定原请求和新的应用 dataset UUID。所有路径来自资源 ID，数据库、日志、marker、回执和侧文件拒绝链接／硬链接。停止预览、workspace 清理及本次故障恢复不删除 dataset。

原 journal 一旦存在，同一后端的 prepare 也只能核实，不再初始化／备份。准备失败保留部分文件为 UNKNOWN；没有自动修复、重建或清理接口。派发许可 ACK 丢失时，即使尚未创建文件，也不能据此申请第二次执行。准备 ACK 丢失查原文件 receipt；观察已提交但 ACK 丢失时，重开控制 Worker 后读取原 SUCCEEDED，不再调用 prepare。

源连接只读，SQLite 读事务固定一致视图，backup 包含已提交 WAL 并排除未提交事务；副本生成新的应用身份，保留业务行。准备完成后的原 SHA／字节数描述初始快照，允许之后合法业务写入而不覆盖原 receipt。副本恢复检查自己的日志、marker、receipt 和数据库完整性，不依赖源继续兼容／可用。

## 实际验证

最终 [datasets-v16](./development/datasets-v16/evidence.json) 执行 14 项检查，源码指纹运行期间不变。134 项测试：132 通过、2 条条件跳过；没有失败／取消。全部使用 Windows x64、Node `v24.13.1`，不是干净 checkout／全仓库测试。原命令数组、实际 driver、日志 SHA 和源码指纹保存在同目录。

代码检查点为 `20c2ca9f4450dafcbcc63f6f1e87a2434bbc509f`；[checkpoint-binding.json](./development/datasets-v16/checkpoint-binding.json) 核对全部 381 个输入（包含原模板）与该提交 Git 对象字节一致。此绑定仅为只读字节核对，不是再次运行测试或干净 checkout 证明。台账／OpenSpec 严格校验、设计主文生成一致性与 Git 差异格式检查均通过，它们只验证各自记录或格式。

| 检查 | 结果 |
| --- | --- |
| 冻结离线安装、类型、Lint、当前 contracts／storage／runner／platform-core 依赖构建 | 全通过；安装使用 `--frozen-lockfile --offline --ignore-scripts` |
| 实际 dataset | 11/11 |
| 意图／目录 | 14/14 |
| 平台 smoke | 9 通过，1 条 POSIX 信号条件跳过 |
| 调度 | 10/10 |
| 审查／退回 | 13/13 |
| 原冻结 | 14/14 |
| SQLite 存储／历史迁移至 32 | 28/28 |
| Runner | 15 通过，1 条真实 Linux Docker 条件跳过 |
| 契约／OpenAPI | 契约 18/18，生成一致性通过 |

11 项新增数据测试核实：

1. EMPTY／DEMO 的实际数据库、marker、快照字节 hash、新应用身份；原模板直接读取和写入后仍恢复原完成 receipt。
2. 源已有已提交 WAL 且持有未提交事务，副本只包含已提交数据；源／副本的后续实际业务写入互不回写。
3. 同一原操作并发／重复准备及后端重建，只保留原数据库 inode／字节、journal 和 receipt，不二次初始化。
4. 明确中断文件 fixture 和损坏 receipt 保持 UNKNOWN，原部分文件不覆盖。
5. 实际 4 KiB 配额触发准备失败，保留真实临时 SQLite 和 journal；后续 prepare 只核实、不重建。
6. 已完成副本在源实际 schema 后来不兼容时，继续从自己的证据恢复，查询不改写源字节。
7. 未配置迁移、请求 hash／路径错配、源实际 schema 不兼容和硬链接回执被拒绝。
8. 未配置后端保持 PREPARED，普通 owner 不能替代策略服务主体推进原操作，没有 Release 被创建。
9. 实际准备成功后模拟丢 ACK，恢复分页只 inspect 原文件，prepare 调用次数为 1，接受指针不变。
10. 实际派发提交后模拟丢许可 ACK，后续不调用 prepare，无文件时保持 UNKNOWN，禁止创建替代 dataset。
11. 实际观察提交后模拟丢 ACK，关闭／重开真实控制 SQLite Worker，恢复原 SUCCEEDED／READY，prepare 次数仍为 1。

## 失败记录和修正

[datasets-v14-failed](./development/datasets-v14-failed/evidence.json) 的安装／类型／Lint／构建通过，但新增测试 2 通过、7 失败。诊断确定 Windows 对只读句柄执行 fsync 返回 EPERM，导致本次实际准备保留了部分文件却没有完成 receipt。仅把本次独占临时文件的刷新句柄改为 O_RDWR，源仍只读；没有放松 schema／完整性／路径检查。失败原日志和对应源码保留。

[datasets-v15](./development/datasets-v15/evidence.json) 修正后新增数据测试 9/9、意图／目录 14/14，以及安装／类型／Lint／构建通过。随后增加实际配额失败和源后来不兼容两项测试，得到最终 v16 的 11/11 与上述完整相关回归。

## 剩余边界

子项 2.3／3.x 仍待实现预览实例生命周期／真实健康／到期、独立 origin 网关和平台入口。子项 4.x／5.x 仍待接受准备、写门 fencing、T5、发布／导出、组合和最终固定干净版本验证。当前数据后端没有默认自动消费或公开服务入口。

Windows 文件 fsync 已实际执行；目录刷新只在支持的非 Windows 分支执行，本次没有验证 Linux 或突然断电后的持久性。企业 OIDC／模型／Linux Docker＋gVisor、生产迁移及人工产品／阶段验收未执行。两个条件跳过继续列为缺项，不能计为通过。
