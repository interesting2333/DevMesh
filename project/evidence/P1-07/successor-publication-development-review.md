# P1-07 同库第二次发布开发复核

2026-11-14：4.3／5.1同库第二次发布组合：同一文件控制库两轮真实候选／审查／T5后，复用ReleasePublisher与Runner原后端完成第二次发布；保留策略复制首轮HTTP业务行，明确替换新目标为空，发布后实际HTTP写入新目标、原源行保留。核实两份Release／acceptance commit／promotion Outbox、唯一当前路由generation 2、源CLOSED／RETIRED与目标OPEN／READY、原源容量按容器消失证明释放、新服务唯一占用，原T5回执和首轮发布证明不改。SOURCE_STOP／SOURCE_CONTAINER_REMOVE／SOURCE_NETWORK_REMOVE／ROUTE_BIND四处丢ACK后控制与Runner重开只查原journal／reservation，不重派已完成物理变更、不重做数据准备或T5；最终PUBLISHED控制ACK丢失恢复原事实，路由事务注入失败保留T5／旧路由／双门关闭，恢复采纳原证明。共享HTTP夹具按当前挂载dataset查门，路由夹具区分历史与项目当前绑定，源夹具沿实际首轮围栏ID严格递增。integration 10通过，regression 12通过，continuation 27通过，service 13通过，合计62项次通过、0跳过；完整构建、类型／Lint／契约、449映射和输入／产物SHA绑定通过，最终输入无漂移，全部生产源码／API／SQL1～45／Runner格式／依赖不改。首次正向探针3项通过单列并保存加容量断言前源码，不计最终总数。源／模型／Runtime准入／OCI／迁移artifact来源及物理custody／fence／guard／容器／网络／路由为明确夹具，本地HTTP不证明后台／直接文件物理隔离。独立Release网关、完整工作台／D01～D08、干净checkout、真实身份／Linux和产品验收继续；正式P1-07、OpenSpec8/13及门槛保持。

## 实际验证

- Both strategies traverse the actual second T5 and second publication. Actual template HTTP reads preserve the first business row or start with an empty target, and idempotent writes enter only the new SQLite target while old rows remain.
- Two immutable acceptance commits/releases/promotion outboxes coexist with one current project route at generation 2. Source control gate is CLOSED and dataset RETIRED, target gate OPEN and dataset READY, old source reservation removed/released and one writable slot occupied.
- Each source cleanup/route ACK-loss stage reopens both Workers; inspect has no additional mutations, recovery retains original reservation/proof, no physical stage repeats and no additional data custody acquisition or T5 occurs. UNKNOWN capacity matches the accurate source/target phase.
- Final control commit ACK loss recovers already-PUBLISHED without physical work. A failing route UPDATE rolls back the publication transaction while preserving T5, generation 1 and closed gates; after recovery the original physical proof is adopted unchanged.
- Original T5 receipt bytes and first publication proof remain unchanged. Foreign keys pass. Current HTTP gate and active route fixture follow the actual current target instead of assuming the first release remains current.

integration 10通过，regression 12通过，continuation 27通过，service 13通过。最终62项次通过、0跳过；计数包括TAP父用例，不表示同等数量的独立产品验收。首次3项正向探针不计最终总数。完整根应用构建、类型／Lint／契约通过；449份源码映射与698份输入／产物绑定，控制SQL1～45和生产实现／Runner格式／依赖字节不变。所有最终测试组顺序执行，输入无运行中或运行后漂移。

## 夹具与未完成范围

- Physical source/fence/guard/container/network/route, source/model/Runtime/admission/OCI and migration artifact provenance are explicit fixtures. Shared loopback HTTP does not prove real background/direct-file write exclusion.
- Independent Release gateway, full workbench/D01-D08, clean checkout, enterprise identity and Linux/gVisor are outstanding.
- Same-agent local development review; formal work package, OpenSpec completion, stage gates and product acceptance are separate.

没有为本增量修改生产行为；共用测试夹具的当前HTTP门和当前路由跟随实际第二轮目标。首轮已发布围栏到后继custody／交接的generation是明确受控因果，不是实际物理证明。全部首次探针日志及准确旧测试字节另存，最终增加容量断言后完整重跑。

原始记录：[evidence.json](./development/successor-publication/evidence.json)、[final-binding.json](./development/successor-publication/final-binding.json)、[probe-history.json](./development/successor-publication/probe-history.json)、[manifest.json](./development/successor-publication/manifest.json)。
