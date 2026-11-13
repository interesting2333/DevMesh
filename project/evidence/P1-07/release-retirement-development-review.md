# Runner 发布前只读服务退役：本地开发复核

已实现 Runner 前向迁移10、私有退役writer与显式RunnerReleaseRetirementBackend。组件自行查询控制库原SENT／UNKNOWN和策略主体／固定basis，绑定正式T5、原接受controller、Runner稳定prepared proof、只读profile和准确容器／网络。原接受事实不回退，组件不实施完整ReleasePublicationBackend、不创建可写服务或返回PUBLISHED。

独立release_retirements登记和REVOKE_PREPARATION→STOP→CONTAINER_REMOVE→NETWORK_REMOVE阶段唯一派发。永久物理撤权Authority须封禁原准备的acquire／renew／写入，并核实在途动作终止；缺配置关闭，SQLite记录不替代物理保证。Driver最后核实原授权，准确ID的成功消失查询、REMOVED、容量释放及服务历史同一writer事务；历史故障全部回滚，原数据、profile、claim和proof保留。网络消失独立核实。dataset交接占用持续保留，其他controller的preview／acceptance不能在容量释放后抢占；原abort决定与交接互斥。

登记／阶段ACK丢失或重启后，只查询已持久原动作，不重派、不启动下一未派发阶段。已核实一步不等于整体完成，跨步骤中断可能持续未完成，继续协调协议待实施。按controller有界分页仍包含容量已释放而网络尚未清理的记录；准确原proof可只读重放，迟到服务事实不能复活原实例。

最终runner-03 105/106（1项条件跳过）；acceptance-03 224/224，共329项通过、1项条件跳过，无失败或取消；跳过项为既有Linux条件Docker适配器（受控CLI）测试，在Windows跳过，不计为通过；实际Linux／gVisor验收仍未执行。六包构建、根类型检查和Lint通过，168/168源码映射匹配。最终两组全部输入和产物逐项匹配build-03，运行期间没有变化；未执行整个根pnpm check。原Runner、接受准备／撤销和控制发布组回归随新迁移执行，原1～42控制迁移和manifest、Runner八份历史SQL逐字不变。

新增16项本地退役测试覆盖真实控制／Runner SQLite Worker、正式首轮候选／审查／T5、真实业务数据文件及稳定proof；并发唯一登记／阶段许可、四种物理ACK丢失、Runner SQLite Worker terminate后原查询、错误对象／时间／hash、撤权失败、消失查询失败、历史写故障回滚、dataset防抢占、controller隔离、有界恢复及v9→v10失败／成功升级与摘要漂移关闭。互斥逆向分支直接给私有writer注入显式决定夹具，只验证writer屏障，不表示控制面允许T5后撤销。物理撤权、OCI、容器／网络以及控制发布成功证明均为显式夹具，未证明真实Linux操作或所有业务入口已排空。

首轮build-01包构建成功而根类型检查拒绝联合claim的serviceRequestHash访问，Lint未执行；显式收窄原claim后build-02及03通过。原15份变更输入按记录SHA保存，467份未变输入绑定父Git对象；单份domain由准确补丁反推并核对原输入SHA。首轮retirement-01为15/15，后增加dataset preview抢占和私有abort互斥覆盖，最终Runner组重跑16项。build-02的测试中间输入曾保留新迁移失败断言的错误最新版本期望，测试执行前已改回v9并在build-03固定；该错误未作为测试失败或覆盖记录。中间成功记录不叠加最终通过总数。

v9历史兼容夹具仅在专用临时测试库移除空v10新表／触发器，固定原identity／history为9，再实际执行生产9→10迁移；不执行生产降级。已有HELD服务、profile、actions、events、proof、jobs及原历史逐行比较，外键保持启用；DDL／history故障恢复旧版本且不回填退役许可。

设计专题／完整设计、实施、验收场景、OpenSpec、Runner使用文档及任务台账基线同步。证据为修改中checkout的同一Agent本地开发复核；独立可写服务及容量／阶段日志、物理guard／后继fence、实际路由／Release访问和导出、恢复协调、默认平台装配、后继正式保留迁移／替换、固定提交干净checkout与独立／人工产品验收继续。OpenSpec仍8/13，完整4.3／5.1／5.2不勾选、不归档；正式P1-07仍NOT_STARTED／未认领，等待P1-06／G0。

原日志及SHA见[清单](./development/release-retirement/manifest.json)，源码／产物／迁移与原失败输入见[绑定](./development/release-retirement/final-binding.json)。
