# P1-07 可信接受准备消费开发复核

2026-11-13：4.1／5.1可信接受准备后台消费：AcceptancePreparationConsumer＋startPlatform显式工厂，匹配acceptancePolicies启动快照及DB原project／policy／主体／backendRef／Runner；默认不扫描。未决工作页排除失败／撤销／接受历史，有限范围／页预算、轮转、跨项目最多2并发与每项目串行、tick合并；原一次派发、SENT／UNKNOWN只查原对象，独立周期健康不改proof且GET不刷新。停机立即关闭新授权，preflight后复核，真实排空后端调用再关闭存储，不自动T5／发布／清理。新消费者13/13、宿主／导出19通过1项Windows跳过、接受／T5／撤销／契约45/45，共77通过1跳过；完整构建／类型／Lint／契约通过，301条源码映射及旧迁移1～44／Runner／依赖不变，最终全部输入无漂移。实际文件Worker／CAS／平台启停／31秒健康时效／原HTTP接受回归；物理后端和上游事实为明确夹具。无默认真实Runner／OIDC、物理迁移／清理、正向后继保留替换、完整工作台或产品验收；后端无强制取消、由适配器保证有界I/O。正式P1-07及OpenSpec8/13和门槛保持原状态。

## 实现与验证

可信工厂提供固定绑定和后端实例；不经普通JSON或HTTP／MCP安装。宿主提前复制策略映射，工厂修改调用方原映射不会更换启用策略。创建消费者先核实DB原策略主体／Runner／backendRef；重复项目、未登记／外项目／错误主体／禁用后端和无效限制拒绝。失败启动后实际重新打开同一存储，验证锁和资源已释放；没有工厂时原准备保持PREPARED且观察序号为0。

21条真实未派发关闭历史后，limit=1工作页准确读到新原准备；原历史查询仍从旧行开始，未偷改历史行为。并发tick返回同一Promise，仅一次prepare；已派发恢复只inspect，原proof摘要不变。原派发许可ACK与观察ACK在实际提交之后丢弃，重开文件Worker后不补派、不生成替代Release。真实等待31.05秒验证健康过期，普通读取没有调用后端，独立1秒周期恢复并继续刷新同一proof。

跨项目测试以明确本地dispatcher连接三个实际Worker，不将它当成分布式部署；验证轮转顺序、全局最多两个未结束后端调用，以及首个项目扫描失败后其余两个仍推进。安装时固定方法实现，调用方后续替换方法不会改变该消费者执行的方法；backend.configured仍动态检查。

停机测试在preflight或prepare内部停住真实Promise：stop未提前完成，存储仍可读；释放preflight后不取得许可，状态PREPARED。已派发调用的最终授权在stop后返回false，真实返回后才结束drain；平台stop完成后Worker拒绝新读，重新打开可查同一SENT原事实。重启只inspect，不prepare。实际撤销决定和真实本地HTTP材料预检／T5原准备不在工作页中，消费者不替用户接受或发布。

## 检查与边界

本轮77项通过、1项跳过；唯一跳过是原foundation的POSIX SIGTERM用例在Windows关闭，不冒充Linux信号验收。完整workspace构建、类型、Lint、契约漂移检查通过；所有最终组源码／测试输入无运行中或运行后变化，301条源码映射匹配当前及vendor字节，660份输入／产物绑定。旧SQL1～44、Runner与依赖未改。未执行完整pnpm check或固定提交干净checkout。

同一Codex Agent开发复核，不冒充独立人员或真实用户签认。实际平台／布局／CAS／SQLite／HTTP执行与明确源码／镜像／Runner／fence／health／人工观察夹具分开；不通过真实模型、企业身份、Linux／gVisor、物理准备／清理、正向后继保留／替换、完整工作台或D01～D08产品验收。没有强制取消适配器的能力；不返回的调用保持排空等待，外部后端资源由可信调用方管理。小扫描预算或繁忙后端可能使30秒健康到期，最终接受按当前观察保持关闭。

子步骤开发不解除P1-06／G0前置；正式P1-07仍未认领，完整4.1／4.3／5.1／5.2及OpenSpec8/13继续，不归档。

原始记录：[evidence.json](./development/acceptance-consumer/evidence.json)、[final-binding.json](./development/acceptance-consumer/final-binding.json)、[manifest.json](./development/acceptance-consumer/manifest.json)。
