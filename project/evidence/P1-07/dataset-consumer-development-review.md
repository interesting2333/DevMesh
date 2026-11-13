# P1-07 原预览数据后台消费开发复核

2026-11-13：2.2／2.3／5.1原预览数据后台消费：PreviewDatasetConsumer＋startPlatform显式previewDatasets工厂，核实DB原策略／主体／项目／backendRef／Runner；后续装配成功才启动，默认关闭且不依赖Input API／模型。listPreviewDatasetWork只扫DATASET_PREPARE未决项，保留历史；范围轮转／每项目一页与串行／最多2项目并发／tick合并。原一次派发、SENT／UNKNOWN只查；DatasetPreparer预检后复核停机并提供当前writer最终授权，实际文件Worker建原日志前询问。超时关闭线程和迟到许可但保留父授权RPC及slot直到实际排空，宿主最后关存储。consumer 13通过，lifecycle 23通过／1跳过，domain 59通过，共95通过、1跳过；完整构建／类型／Lint／契约及369条源码映射通过，旧SQL1～44／Runner持久格式／依赖未改，最终输入无漂移。首轮类型检查发现文件Worker闭包内parentPort可空的两处TS18047，Lint发现allSettled多余spread；原日志与两份源码字节／SHA保留在initial-failure。首轮consumer的REMOVE测试调用不存在的f.exec，在释放授权barrier前抛出，排空teardown因此等待；核实准确测试Node PID及命令行后只终止该叶进程，原父测试／driver退出1。原测试字节／SHA、终止脚本及原因留在test-fixture-failure；改用实际文件DB.prepare.run并finally释放barrier，没有因此改产品代码。最终重新完整构建并对相同全部输入重跑所有组，不复用旧组结果。真实控制／数据Worker、SQLite字节／原日志／宿主及超时；上游Git／OCI／候选和物理容器事实仍是明确夹具。无自动owner数据决定／预览创建／接受；真实Linux／身份、完整后继链和干净checkout继续，正式P1-07／OpenSpec8/13／门槛不变。

## 实施与边界

显式可信工厂固定原项目／policyHash／服务主体／backendRef／Runner和DatasetPreparationBackend，启动核实DB原策略；全部后续组合成功后才开始。默认无适配器、不扫描，不依赖Input API／登录／模型，也没有公共JSON／HTTP／MCP后端注册。consumer只推进已有owner持久操作，不作新数据决定或创建预览。

新增私有只读listPreviewDatasetWork，仅选DATASET_PREPARE的PREPARED／SENT／UNKNOWN；终态／其他预览effect保留而不占页。最多32项目、2项目并发、每项目串行且每轮一页，页1～20、范围预算1～32、间隔1～10秒；轮转／游标末页归零／tick合并／安全错误和单范围隔离。公开适配器方法固定、configured动态核实，内部实现与有界I/O由可信构造者负责。

原PREPARED一次grant；SENT／UNKNOWN只查原对象。DatasetPreparer预检后检查关闭，执行提供当前writer的verifyPreviewExecution最终授权，再核实停止／配置。LocalSqliteDatasetBackend的文件Worker只读预检后、建目录和原日志前询问授权；拒绝或不可用保留UNKNOWN、不建原日志。已有日志仍只查，不重新初始化。直接可信调用保留可选callback兼容，准备器与宿主始终提供回调；这不是公共授权入口。

stopAdmission立即关闭各准备器；stop真实等待pass／loop后由宿主关存储。实际Worker超时关授权／终止线程，但父授权RPC未返回就保留调用及slot；晚到true不能授权已退出线程。没有Promise竞赛取消外部资源。只改Runner数据backend／Worker授权通信，无持久格式、旧SQL1～44或依赖变化。

## 实际验证

- Original committed project/policy/service/backendRef/Runner validation, configured state, duplicate projects, all bounds and ordinary owner denial; methods pinned and tick coalesced.
- Actual application SQLite preparation followed by injected lost physical-result ACK, UNKNOWN and control Worker reopen; original immutable journal/database bytes and one prepare, no preview or Release. Committed dispatch ACK loss yields original-only inspect and never initializes.
- Stopping during paused preflight leaves PREPARED and drains the invocation. Stop or actual owner-row removal before final file-Worker authorization returns false, leaves UNKNOWN and creates no original journal.
- A real 1000ms Worker timeout with paused authority retains the parent Promise and single Worker slot beyond timeout. Releasing authority drains the call; a queued second call starts afterward, and neither declined/late authorization creates a journal.
- Three actual control Workers through an explicit local test dispatcher rotate project ranges with at most two pending calls and isolate a private scan failure. Terminal dataset history and active preview effects are excluded from the specialized data queue.
- Actual host defaults off, rejects missing storage before factory invocation, rejects mismatched scopes, cleans storage after later MCP startup failure without creating files. Stop immediately closes authorization, drains before storage closes and restarts by original inspect without Input API.
- Actual host periodically prepares file bytes for an owner-recorded dataset, persists immutable READY receipt across restart and leaves Run unaccepted. Existing data / path / preview / host regressions execute against the same final bytes.

consumer 13通过，lifecycle 23通过／1跳过，domain 59通过，共95通过、1跳过。首轮类型检查发现文件Worker闭包内parentPort可空的两处TS18047，Lint发现allSettled多余spread；原日志与两份源码字节／SHA保留在initial-failure。首轮consumer的REMOVE测试调用不存在的f.exec，在释放授权barrier前抛出，排空teardown因此等待；核实准确测试Node PID及命令行后只终止该叶进程，原父测试／driver退出1。原测试字节／SHA、终止脚本及原因留在test-fixture-failure；改用实际文件DB.prepare.run并finally释放barrier，没有因此改产品代码。最终重新完整构建并对相同全部输入重跑所有组，不复用旧组结果。所有最终组完整重建后运行，同一源码／测试／产物；运行中／之后无漂移，369条映射及681份输入／产物绑定。旧控制SQL逐字节保持，Runner格式与依赖保持。

原source／Git／OCI与候选事实、旧预览回归的容器网络是明确夹具；实际控制／文件Worker、应用SQLite／日志／宿主／定时／超时分开留证。未验证企业身份／物理Linux与gVisor／生产迁移或完整正向后继保留替换；未执行完整pnpm check／固定提交干净checkout。单Agent开发复核，非独立人员或产品签认。正式P1-07等待P1-06／G0，OpenSpec8/13与门槛不改、不归档。

原始记录：[evidence.json](./development/dataset-consumer/evidence.json)、[final-binding.json](./development/dataset-consumer/final-binding.json)、[manifest.json](./development/dataset-consumer/manifest.json)。
