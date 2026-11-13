# P1-07 原撤销后台消费开发复核

2026-11-13：4.1／5.1原撤销后台协调：AcceptanceAbortConsumer＋startPlatform显式acceptanceAbort工厂，按DB原策略／项目／主体／backendRef／Runner核实，只消费已有决定无completion的原准备；不依赖新接受入口或原owner仍为成员。RunnerAcceptanceAbortCoordinator串联原服务清理与数据／源恢复finalizer；有界轮转／最多2项目并发／tick合并。停机关闭原阶段／driver／数据最终授权并排空调用；数据Worker超时退出后保留未结束authority RPC和名额，返回后只查原结果。consumer 10通过，lifecycle 48通过／1跳过，domain 94通过，共152通过1跳过；完整构建／类型／Lint／契约通过，367条源码映射、旧控制SQL1～44／Runner存储格式／依赖未改，所有最终输入无漂移。首轮类型2处／Lint1条失败及3份源码原字节保留，修正后重新完整构建；两条旧超时测试按新排空契约提前调整后再验证。真实控制／Runner／数据文件Worker和宿主启停；物理Driver／永久撤权／fence／健康仍为明确夹具。完整后继链／真实身份及Linux／容器／全量干净checkout验收继续；正式P1-07／OpenSpec8/13／阶段门槛保持原状态。

## 可信装配与原决定

acceptanceAbort工厂提供固定项目／policyHash／主体／backendRef／Runner及执行后端；原DB策略须完全匹配，所有后续宿主组合成功后才启动。普通JSON、HTTP／MCP不能安装此可执行工厂；默认关闭。恢复已确认决定只要求持久存储，不依赖新接受入口或原owner仍为成员。实际宿主测试验证默认关闭、错配拒绝、后续MCP工厂失败未开始清理，以及失败后原存储可重新打开。

私有工作页只返回有原决定且无completion的准备，旧准备历史保留；完成历史不挡新原决定。原后台权限来自既定后端策略，移除原owner后仍完成其已授权清理，不允许因此新增决定。预算最多32项目、跨项目最多2个调用、每项目串行、有界页／范围和轮转，重复tick合并；三个实际Worker由明确本地dispatcher连接验证并发／故障隔离，不冒充分布式部署。

## 实际清理组合与恢复

Runner协调器核实清理器和finalizer的Runner／controller／主体／backendRef一致，固定原方法并传递停止信号。实际控制Worker上的准备／用户撤销决定，配合Runner原持有服务／原清理动作、数据文件Worker日志／receipt与控制面completion串联；物理容器、网络、fence和永久撤权声明仍由明确夹具提供。完成ACK在实际writer提交后丢弃，重开原控制／Runner Worker后不再执行清理或撤权，只返回同一completion；数据文件字节保留，没有Release，目标门仍CLOSED。

STOP内部暂停真实Promise后停止，最终授权为false，排空前不结束。原已派发STOP不重发；测试明确注入独立EXITED物理观察后，恢复只查询原STOP结果并继续后续原阶段。外部撤权已保存原结果但调用尚未返回时停止，drain仍等待，返回后不立即完成控制面；重开后查原结果完成，撤权调用计数仍为1。

## Worker退出与外部调用

修复数据abort父进程原先在Worker超时／退出时提前结束advance的问题：父进程保留全部未结束authority RPC，真实排空后才resolve／reject及释放Worker名额。新测试在5秒Worker超时后检查advance仍未结束，第二请求不开始新authority查询；原调用返回后第一请求报告UNKNOWN，后续请求只inspect原唯一结果。原两条3秒超时用例在执行前同步修订为排空／排队语义，验证延迟最终授权关闭、原文件日志保留、没有重发撤权。接口不能强制取消外部动作；未返回适配器继续占位，适配器自行提供有界I/O，外部资源由构造者管理。

## 验证与边界

consumer 10通过，lifecycle 48通过／1跳过，domain 94通过，共152通过、1跳过。唯一跳过是原foundation的Windows POSIX SIGTERM条件，不冒充Linux信号验收。最终完整构建、类型、Lint、契约检查通过；367条源码映射匹配当前源码／vendor，672份输入／产物绑定；所有最终组无运行中／运行后源码测试漂移。旧控制SQL1～44、Runner持久格式及依赖未改；Runner修改限原abort停止／排空、协调器、导出与说明。未跑完整pnpm check或固定提交干净checkout。

首轮静态检查发现分页counter错误导入、operationId未解析品牌类型和多余Set展开Lint警告；保留原type／lint失败、对应3份源码SHA及全部早期构建记录。修复后重新完整构建、类型／Lint／契约，再调整两条原超时测试并完整重建，最终全部组在相同最终输入执行。未在早期失败字节运行测试，未复用早期构建作最终产物证据。

同一Codex Agent开发复核，没有独立人员／人工产品签认。真实文件／日志／SQLite／Worker／平台生命周期与明确物理Driver／fence／health夹具分开；真实模型、企业OIDC、Linux／gVisor、物理源恢复、正式后继保留／替换及完整工作台继续验收。完整4.1／5.1／5.2未因局部装配完成而关单，OpenSpec仍8/13、不归档；P1-07仍等待P1-06／G0，不改变正式状态或门槛。

原始记录：[evidence.json](./development/abort-consumer/evidence.json)、[final-binding.json](./development/abort-consumer/final-binding.json)、[manifest.json](./development/abort-consumer/manifest.json)。
