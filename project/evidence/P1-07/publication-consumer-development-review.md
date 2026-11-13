# P1-07 已接受发布消费开发复核

2026-11-13：4.3／5.1已接受发布后台消费：ReleasePublicationConsumer＋startPlatform显式releasePublication工厂，固定原project／policy／主体／backendRef／Runner并核实DB策略，后续宿主组合成功才启动。无需Input API或新接受入口仍开启，默认无物理发布器。私有工作页只取当前已接受未决发布，保留完整历史；原一次publish、SENT／UNKNOWN先inspect并按原授权resume续接Runner阶段，不重建Release／T5或重做迁移。范围轮转、最多2并发、项目串行和tick合并；停机关闭publish／resume最终授权、真实排空后关闭Worker。consumer 16通过，lifecycle 32通过／1跳过，domain 112通过，共160通过1跳过；完整构建／类型／Lint／契约通过，302条源码映射及旧SQL1～44／Runner／依赖不变，所有最终输入无漂移。真实文件Worker／T5／发布事务／宿主启停；物理后端和上游事实为明确夹具，后继历史仅显式元数据投影。未执行完整pnpm check／固定提交干净checkout；真实身份／Linux／容器／物理迁移与正式后继业务链继续验收，正式P1-07／OpenSpec8/13／阶段门槛保持原状态。

## 实现与原状态

原ReleasePublisher／RunnerReleaseServiceBackend已有逐阶段续接；本轮把它们接入显式可信宿主消费者。工厂提供固定五项绑定及可执行后端实例，不能从公开HTTP／MCP或普通JSON安装。原接受策略匹配后才创建消费者，后续宿主组合全部成功后才启动。存储缺失、原策略／主体／Runner不匹配拒绝启动；失败后实际重新打开原存储验证锁已释放。后续MCP工厂失败时后端调用次数仍为0。

发布恢复不要求新接受入口仍启用；宿主用例只有实际持久存储，没有Input API／新接受策略快照。原PENDING只获一次publish许可；SENT／UNKNOWN查询原对象，仅在当前continuation授权及显式resume存在时续接。实际Runner阶段许可与未知已派发步骤查询规则沿用既有实现及回归，不因后台循环重发原阶段。原writer仍核实当前接受指针、原Outbox／proof／闭门／未知写与发布证明，完整证明原子保存后才开目标门。

工作页排除PUBLISHED与非当前接受历史；完整历史查询保留。测试中的后继记录使用明确元数据投影，只核实查询过滤，不能当成第二次正式T5或保留／替换业务链。原接受表、指针、Outbox与Run终态不因路由失败回滚，发布完成后原接受回执仍显示当时PENDING。

## 恢复与停机

在实际Worker提交原派发许可／观察后分别丢ACK，重开同一文件Worker后不重复publish；许可丢ACK走inspect／授权resume，观察已提交则工作页不再返回。周期续接使用同一原Release；缺resume保持UNKNOWN，动态禁用后端不扫描／执行。跨项目测试使用显式本地dispatcher连接三个实际Worker，验证轮转、最多两个未结束调用以及单范围失败不阻塞其他范围；不冒充分布式部署。

在preflight／publish／inspect／resume中暂停真实Promise并停止，drain在释放前不完成，Worker仍可用。preflight返回后不取许可；已派发publish／resume最终授权返回false；inspect返回后不再开始resume。宿主stop完成后Worker拒绝请求，重新打开可查原UNKNOWN事实，重启只inspect／resume不publish。适配器没有强制取消能力；不返回的调用须保持排空等待，实际适配器自行有界I/O，外部资源由构造者管理。

## 验证与复核边界

consumer 16通过，lifecycle 32通过／1跳过，domain 112通过，总计160通过、1跳过。唯一跳过是原foundation的POSIX SIGTERM在Windows关闭，不当作Linux信号通过。完整workspace构建、类型、Lint、契约检查通过；最终源码／测试输入无运行中或运行后变化，302条源码映射匹配当前源码／vendor字节，665份输入／产物绑定。历史SQL1～44、Runner及依赖未修改。未执行完整pnpm check或固定提交干净checkout。

本次是同一Codex Agent开发复核，没有独立人员或用户产品签认。实际本地Worker／布局／CAS／T5／发布事务／宿主生命周期与明确上游源码／Runner／物理退役／路由／fence／health夹具分开。没有真实模型、企业OIDC、Linux／gVisor、物理迁移、正式后继保留／替换或完整工作台验收；默认CLI仍无物理发布器。完整4.3／5.1／5.2继续，OpenSpec仍8/13，不归档；P1-07仍未正式认领，不解除P1-06／G0前置。

原始记录：[evidence.json](./development/publication-consumer/evidence.json)、[final-binding.json](./development/publication-consumer/final-binding.json)、[manifest.json](./development/publication-consumer/manifest.json)。
