# P1-07 Runner 预览容量开发复核

本记录继续开发子项 2.3，覆盖 Runner SQLite v3 迁移、私有持久预览预留与作业统一准入。完整 2.3 保持未勾选；正式 P1-07 仍等待 P1-06／G0。实施与复核均为同一 Codex，不是独立评审或人工产品／阶段验收。

## 实际实现

`capacity-domain.ts` 在原 workspace fence v2 后执行前向 v3 迁移；v2 迁移正文／SHA 保持不变，重开分别核实 v2／v3 指纹。历史作业原身份、请求和状态不变。v3 保存预留、唯一派发位、准确原实例／首次端口、revision 及不可变事件快照，状态变更和历史同事务提交；原预留不能删除，终态不能修改。

原 `claim` 与新 `previewReserve` 在同一 Runner writer 的准入事务统计全部 controller：所有非 QUEUED／EXITED 作业，以及全部未释放预览。统一扣除 slot／CPU／内存，保留每 Run／Invocation 原并发规则及 workspace fence。RunnerManager 启动固定显式预算；同一 Worker 拒绝不同预算。Worker 重开后可以显式降低预算，但原占用保留，只停止超额新准入，不主动清理对象。

预留绑定原完整 `previewStartRequest`、canonical requestHash、runnerId 和不可变资源。原 controller／operation 只创建一份；同一 preview 或可写 dataset 即使换 controller 也不能并占。Runner 内派发位仅一次 `RESERVED→DISPATCHED`；丢 ACK 后仅查询原预留，不再次给执行许可。该位不能替代控制面原派发许可／当前授权。

只允许未派发 RESERVED 明确取消。DISPATCHED／ACTIVE／UNKNOWN 不因到期、超时或查不到对象退还资源；只有可信后端的准确原实例 EXITED 事实才释放。实例和端口核实后固定，UNKNOWN 不清空身份；新观察需原 requestHash、revision CAS、正确 preview／dataset／image 和非陈旧时间。release／数据保留仍由原控制面规则保护，本步骤不新增停止或删除 dataset 动作。

私有查询／恢复分页限定原 controller，每轮从 0 扫描；没有公共 HTTP／MCP 预留或回执入口。装配契约与恢复说明见 [PREVIEWS.md](../../../packages/runner/PREVIEWS.md)。预算／资源声明必须来自可信部署策略，不能开放给普通用户或模型。

## 验证记录

[capacity-v22-failed](./development/capacity-v22-failed/evidence.json)：离线冻结安装、类型、Lint 和构建通过；容量／升级 13/14 通过。一处到期测试同时创建了已派发及未派发两份预留，却预期只有一份占用；实际保留两份符合规则。修正断言，随后显式取消未派发预留再检查只剩一份。原失败源码和日志保留，没有放宽容量／到期规则。正式记录之前的一次类型试跑还发现分页 Zod input 的默认字段在静态类型上可省略，已在私有实现中明确使用 `??` 默认值；该手工试跑不计入通过记录。

[capacity-v23](./development/capacity-v23/evidence.json)：13 项检查全部通过，源码指纹在执行期间未变化，保存实际命令数组、driver 和原日志 SHA。针对容量的 14 项检查全通过，也包含在完整 Runner 回归中，统计时不重复计算。

| 检查 | 实际结果 |
| --- | --- |
| 离线冻结安装、类型、Lint、当前 contracts／storage／runner／platform-core 构建 | 全通过 |
| 容量与升级针对性检查 | 14/14，计入下行 Runner 集合 |
| 全部 Runner | 28 通过，1 条 Linux Docker 条件跳过 |
| 预览生命周期／真实 HTTP | 16/16 |
| 实际 SQLite 数据准备 | 11/11 |
| 原意图／目录 | 14/14 |
| 调度 | 10/10 |
| 平台 smoke | 9 通过，1 条 POSIX 信号条件跳过 |
| 契约与 OpenAPI 一致性 | 契约 18/18，一致性通过 |

主回归共 122 次测试执行，其中 14 次为 Runner 子集的重复验证；去重后 108 项，106 通过、2 条条件跳过。没有失败／取消。Windows x64／Node v24.13.1 上执行；不是全仓库或干净 checkout 验证。

为核实 v3 对原 workspace fence 的影响，补充构建当前 code-workspaces，并实际执行 [workspace-supplement](./development/capacity-v23/workspace-supplement/report.json) 的 5/5 工作区互斥测试：真实鉴权 HTTP、持久 Runner barrier、已排队／未知作业占用、真实 store 重开、丢回执和实际终止文件系统持有进程后的原 token 恢复。容器事实仍来自 ControlledBackend。补验前后与 v23 的全部源码输入一致；合计去重后 113 项，111 通过、2 条条件跳过。

证据保存后再次检查 Lint、台账、OpenSpec 严格校验、设计完整主文和 diff 格式，全部通过；[post-retention-checks.json](./development/capacity-v23/post-retention-checks.json) 同时核对 390 个当前源码／模板输入、18 份原日志、37 项保留材料及 9 个原失败源码快照的 SHA。补验命令、日志和 driver 另随 `workspace-supplement` 保留。这些记录检查不替代产品或干净 checkout 验收。

代码检查点为 `fb90480a5e8778890aff2ce3619619566471e671`；[checkpoint-binding.json](./development/capacity-v23/checkpoint-binding.json) 核对 v23 全部 390 个源码／模板输入与该 Git 提交对象字节一致。这是只读核对，不是新一轮测试或干净 checkout。完整 2.3 仍未完成。

## 边界与后续

容量测试实际执行 Node SQLite Worker、并发准入、事务回滚、SQL 不可变约束、关闭重开，以及实际等待到期后继续持有占用。镜像／容器健康／EXITED 均是明确测试值；没有真实容器、物理退出、gVisor 隔离或 cgroup／磁盘配额证据。PID／临时盘声明只固定为后续容器策略输入；本次准入实际统计 slot／CPU／内存。

当前没有生产预览容器适配器。下一步继续原容器 create／start／stop 持久动作日志、完整 OCI 对应、受控网络／挂载／配额、独立 Runner 到期 watchdog、原模板容器监听配置和可信平台装配。独立 origin／访问网关、T5 接受／发布和真实环境／人工验收继续按后续任务实施，预留成功不能显示成可打开的 Demo。
