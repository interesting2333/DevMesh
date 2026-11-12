# P1-07 预览容器执行开发复核

继续开发子项 2.3，补充 Runner v4 原容器动作日志、显式执行后端、Docker Driver 代码和模板容器监听。本记录不关闭完整 2.3；正式 P1-07 仍等待 P1-06／G0。实施与复核均由同一 Codex 完成，不是独立评审或人工产品／阶段验收。

## 实现与恢复边界

Runner v4 在原 v2 workspace fence、v3 容量预留之后前向迁移，旧迁移正文／SHA 不变。每份预留固定原 profile、完整请求／hash、确定性网络／容器名称与资源。NETWORK_CREATE／CREATE／START／STOP 先持久 SENT，再仅授予一次派发许可；首次原 network／container 绑定与动作观察同事务提交，已观察动作与原身份不可修改或删除。原作业、fence、活动预留与历史继续保留，SQL／迁移写入失败整体回滚。

`RunnerPreviewBackend` 显式组合 Runner store、可信路径、实际 dataset 后端、容器 Driver 和平台 `PreviewLifecycleManager`。控制面与 Runner 的原派发位均需收到明确许可；异步检查结束后、实际外部变更前再次复核当前授权。许可／执行／观察 ACK 丢失后只查原 profile 对应原对象，不补发 create／start／stop，也不继续尚未派发的下一动作。持续健康仍取固定 loopback HTTP 的受限探针；停止核实原实例 EXITED 后释放容量，业务 dataset 与准备原证据保留。

Docker Driver 代码核实 manifest 对应的 config ID、层 diffID 顺序、OS／架构及源码／构建 labels。参数和后续观察固定 runsc、非 root、只读根、cap-drop、no-new-privileges、私有 cgroup／IPC、资源限制、无自动重启、有界日志和 loopback 发布端口。每份预览独占 internal bridge；网络隔离适配器还须核实对宿主／控制面／其他网络的访问限制。可写 dataset 中的 operation／receipt／dataset 标记额外覆盖只读文件挂载。未启动容器的 endpoint 尚未分配时，只接受准确原网络名、HostConfig 完整原网络 ID 和从未启动状态；运行对象必须有真实准确 endpoint ID。

Driver 缺真实 Linux、显式硬配额或宿主网络隔离适配器即关闭，实际适配器尚未实现／配置。模板新增显式 APP_HOST：默认 loopback，仅允许可信容器监听所需的 0.0.0.0，拒绝任意主机名／IPv6／空值。此配置本身不提供公网访问授权。

CREATED 且从未启动的容器不能伪称 EXITED。当前停止对此继续返回未核实并保留占用；显式清理／移除协议、独立 Runner 到期 watchdog（含已接受 Release 保护）、真实配额／网络适配器及可信平台默认装配仍待实施。部署与恢复契约见 [PREVIEWS.md](../../../packages/runner/PREVIEWS.md)。

## 原始验证与失败保留

[containers-v25-failed](./development/containers-v25-failed/evidence.json) 保存失败日志、实际命令和当时变更源码。安装／类型／Lint／构建通过，容器测试 13/14；组合测试把停止接口返回 Preview 中的启动 operationId 当成停止操作。改用独立 stopOperationId，保留原一次派发／查询恢复守卫，未放宽业务实现。正式记录前的类型试跑曾发现联合类型未缩小、SQL 参数可为 undefined 及端口数组可空，已修正；这些手工试跑不计入通过结果。

最终 [containers-v26](./development/containers-v26/evidence.json) 保存全部原日志 SHA、实际 driver／命令数组及执行前后源码指纹。Windows x64／Node v24.13.1 执行以下适用检查：

| 检查 | 结果 |
| --- | --- |
| 离线冻结安装、类型、Lint、当前 contracts／storage／runner／platform-core／code-workspaces 构建 | 通过 |
| 容器后端／原动作针对性检查 | 14/14，属于下行 Runner 子集 |
| 容量／历史升级针对性检查 | 15/15，属于下行 Runner 子集 |
| 完整 Runner | 43 通过、1 条 Linux Docker 条件跳过 |
| 平台预览生命周期／真实 HTTP 探针 | 16/16 |
| 实际 SQLite 数据准备 | 11/11 |
| 预览意图／目录 | 14/14 |
| 工作区互斥／持久 fence | 5/5 |
| 调度 | 10/10 |
| 平台 smoke | 9 通过、1 条 POSIX 信号条件跳过 |
| 契约／OpenAPI 一致性 | 契约 18/18，一致性通过 |

主回归共 157 次测试执行，容器／容量 29 次属于重复 Runner 子集；去重 128 项，126 通过、2 条条件跳过，无失败／取消。这是当前工作目录相关回归，不是全仓库或干净 checkout 验收。

新增用例实际执行 Runner／控制面 SQLite Worker、准备真实空 dataset、原模板数据库 CRUD、原动作事务与 SQL 不可变约束、故障回滚、Worker 终止／重开以及 HTTP。v3→v4 升级在活动预留存在时注入迁移失败，核实 DDL／版本／历史回滚，再重试并逐字比较原预留与历史；分别拒绝 v2／v3／v4 迁移指纹漂移。平台组合实际走 DatasetPreparer→PreviewLifecycleManager→RunnerPreviewBackend，启动／停止执行回执丢失后只查原实例，保留一份预览和实际业务行。

[模板验证](./development/containers-v26/template/evidence.json) 单独执行第一方模板的冻结安装、类型、前后端构建、完整单元覆盖和 Chromium 浏览器测试：20/20 单元、2/2 浏览器通过，浏览器版本见原报告。覆盖分母保留全部 src，行覆盖 92.83%、分支 86.54%。包含实际 SQLite Worker／HTTP 的显式 0.0.0.0 监听与默认 loopback／错误配置检查。主回归与模板合计 150 项不同测试，148 通过、2 条条件跳过；不重复计算 Runner 子集。

原始证据保留后，核对当前源码／模板、日志、保留材料和失败源码 SHA，并检查 Lint、台账、OpenSpec、设计主文与 diff，结果记录在 [post-retention-checks.json](./development/containers-v26/post-retention-checks.json)。Git 源码检查点绑定另存；只读字节核对不等同于再次测试或干净 checkout。

## 尚未证明的能力

`ControlledContainerDriver` 提供全部网络／容器事实，不执行 Docker；健康服务器是独立 HTTP 夹具。镜像和 Docker inspect 配置测试使用明确输入，Windows 未执行 Linux CLI 路径。模板验证实际执行第一方应用和浏览器，未将任意生成应用放在控制宿主运行。这些结果均不能当成真实镜像执行、容器物理退出、gVisor、cgroup、硬配额、宿主防火墙或实际挂载保护的证据。

完整 2.3 的剩余代码和 Linux 条件验证继续实施；独立 origin／网关、T5 接受／发布、真实模型／企业 OIDC／生产迁移和产品人工验收仍未完成。OpenSpec 保持 5/13 已完成，不提前归档或更新主能力规范，不改变正式工作包和阶段门槛状态。
