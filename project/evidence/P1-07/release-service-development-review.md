# Runner 独立可写发布服务：本地开发复核

已实现 Runner v11、独立 release_service_handoffs／reservations／profiles／actions／events／proofs writer、显式 RunnerReleaseServiceBackend 和 DockerReleaseServiceDriver。组件自行查询原控制发布、正式首轮 T5、固定 basis／策略主体、原 Runner prepared proof 和完整退役结果。新建独立 RELEASE／READ_WRITE／CONTROL_GATE_FENCED 服务，使用原目标业务数据，不把原只读接受实例改成可写。作业、预览、接受服务和发布服务统一核算 slot／CPU／内存。

ARM_FENCES→源服务停止／容器与网络移除（适用时）→预留／profile→GUARD_ENFORCE→NETWORK_CREATE→CREATE→START→健康／归属→ROUTE_BIND→稳定证明。物理 Authority 必须永久撤销原准备权限，给源／目标提供严格后继 generation 和 previousHoldHash。Guard 必须覆盖后台／直接文件写及已进入的工作，准确绑定原 request／reservation／profile／dataset／fence／控制门，核实当前 PUBLISHED、接受指针、路由代际及原门版本后才准写；这是必需适配器契约，当前没有实际物理实现。路由 bind 是受保护的暂存绑定，控制事务发布后才允许对外激活，不能提前公开新服务。

所有物理阶段使用不可变原请求和一次派发许可。丢回执或 Worker terminate 后仅查询已派发步骤，不能新建下一阶段、重派、接管另一实例或从 inspect 安装 guard／绑定路由。已派发阶段确认后仍可能持续 UNKNOWN，继续协调协议待实现；配额 prepare 仅在首次许可路径执行，尚无独立阶段回执，后续协调还须补齐其原结果核实与授权衔接，不能重跑整链跳过未知状态。最终证明固定，返回成功观察前重新查询原 guard／fences／路由、实际 HTTP 健康以及原只读／源容器和网络消失。源容量释放、REMOVED、准确原 ID 消失观察及历史同一 writer 事务；失败完整回滚，旧 claim／profile／proof 与数据保留。

模板只读连接不创建 writer.lock；可写发布实例把进程锁放入 /tmp/devmesh-runtime，启动／健康检查不改变已准备数据库字节，第一项获准业务变更才切换 WAL。默认独立模板写锁仍支持原模式；临时运行目录进程锁不能证明跨容器物理排他。实际模板数据库／HTTP 写入和读取、首次控制门关闭与发布事务开门、Runner 重启后的原证明，以及旧服务清理容量回滚在本机验证。

最终 service-06 15/15；acceptance-06 84/84；runner-06 105/106（1项条件跳过）；模板 26/26，共 230 项通过、1 项条件跳过。跳过项为 Windows 上已有 Linux 条件的受控 Docker CLI 适配测试，不计为通过或实际 Linux 验收。六包构建、最终根类型检查与 Lint 通过，173/173 源码映射与当前产物一致；模板行覆盖率 93%、分支 86.53%、语句 90.02%、函数 89.79%，原 JSON 和摘要留存。未执行整个根 pnpm check、浏览器 E2E 或固定提交干净 checkout。

最终三组原生 Node 测试输入、构建产物与最终 verify-06 逐项一致，各组运行期间无变化。build-03 六包构建后 build-04 再构建 Runner，最终产物未再变化；构建期间发生的独立夹具／模板输入变化在原指纹中保留，以实际 173 份嵌入源码映射核实最终应用产物，不声称构建期间全仓源码稳定。template-05 的模板范围前后及当前一致，期间变化的根后继夹具不被模板导入；不把这解释为当时全仓输入稳定。Runner 九份历史迁移 SQL、控制迁移 1～42 与 manifest 逐字不变。

失败记录：build-01 根类型检查拒绝可空 revocation 访问，显式收窄后通过；template-03 在并发清理 dist 时，验证脚本采集产物失败，实际检查未执行；template-04 拒绝显式 undefined 的可选 runtimeRoot，改条件展开后 template-05 通过。service-01 暴露原只读连接占写锁，service-02 暴露启动切换 WAL 改变准备字节，两项产品问题均修复。service-03／04 后继私有夹具分别缺少初始结构所需项目前缀、准确 closeOperationId；修正夹具且保留严格原协议，service-source-05 独立主链路补跑通过，不叠加最终总数。

runner-05／acceptance-05／service-04 并行期间出现数据 Worker 30 秒超时、240 秒测试超时、交付策略前置及准备 UNAVAILABLE；原错误不据此判定全部同因。接受迁移断言另有旧 v10 期望，已改为最新 v11。中止并发进程树后，受控接受数据夹具使用现有 120 秒配置，脚本化质量输出在实际短租约前写好，并直接返回受控 EXITED 事实；真实 Runner 鉴权 HTTP／持久 Job／材料读取和内容发布仍执行，生产租约／执行／Worker 默认时限不改。这些夹具不验证真实构建性能。以上失败、主动中止、原变更源码及父 Git 未变对象绑定分别保留，最终串行回归重新执行，早前部分通过不计入总数。

新增发布组验证独立可写 profile／完整 OCI 原身份、缺 provider／错误组合关闭、首轮控制 ReleasePublisher 端到端、六类阶段丢 ACK 的只查询恢复、guard／fence／路由／健康变化、writer 唯一许可与严格后继、原 profile 绑定及 v10→v11 原行保留／失败回滚／摘要漂移。后继源服务的容量释放分支使用第二套实际 Runner／业务数据及显式私有控制 basis，验证的是私有 writer 与清理屏障，没有第二次正式保留迁移／替换 T5。所有 Docker、镜像来源、网络、fence／永久撤权、ALL_DATASET_WRITES guard 和路由事实仍是受控夹具。

同一 Agent 在修改中 checkout 复核代码与原始证据；真实 Linux／gVisor／quota／network isolation／全写入口 guard、实际路由／Release 访问及导出、默认平台装配、继续协调协议、正式后继保留迁移／替换和独立／人工产品验收继续。模型、OIDC 与实际 Linux Runner 按用户约定保留未配置关闭。OpenSpec 仍 8/13，完整 4.3／5.1／5.2 不勾选、不归档；正式 P1-07 仍 NOT_STARTED／未认领，等待 P1-06／G0。设计专题／完整设计、实施、验收场景、OpenSpec、Runner 使用文档及任务台账基线同步。

提交前 post-1 的台账、OpenSpec、完整设计、契约及 Lint 检查通过；diff 检查报告 7 处文档末尾多余空行，随后中止，未执行该轮 staged-diff。已清理空行并更新完整设计和基线，后续提交前检查另存 post-2；原失败报告和输出保留在同一证据清单中。

原日志及 SHA 见[清单](./development/release-service/manifest.json)，源码／产物／迁移与原失败输入见[绑定](./development/release-service/final-binding.json)。
