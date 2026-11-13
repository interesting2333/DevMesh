# P1-07 验收数据准备外部调用排空开发复核

2026-11-13：4.1／5.1验收数据准备RPC排空：LocalSqliteAcceptanceDatasetBackend保留父进程未结束的preflight／authorize／migration／acquire／inspect／verify；Worker超时关闭迟到授权并终止线程，真实排空后才结束调用和释放名额。原不完整日志只查不重做，完整原回执字节保持；实际消费者停止／重开验证同一准备、无新服务或Release。drain 10通过，lifecycle 15通过，domain 75通过，共100通过、0跳过；完整构建／类型／Lint／契约通过，367条源码映射、控制SQL1～44／Runner持久格式／依赖未改，最终所有输入无漂移。首轮Lint多余spread告警及原测试字节保留，修正后完整重建再测试。真实文件／控制／Runner Worker；物理custody／容器／OCI为明确夹具。外部调用无法强制取消，未返回则继续占位；真实身份／Linux与完整后继链／干净checkout验收继续，正式P1-07／OpenSpec8/13／门槛保持原状态。

## 修复与原操作约束

数据准备父进程原来在文件Worker退出时立即结束调用／交还名额，实际父进程内的authority、最终授权或loadMigration仍可能未返回。现在每个Worker保留自己的未结束RPC集合；超时先关闭迟到授权、终止文件线程，exit等待全部RPC真实settle后才resolve／reject，最后释放名额。排队请求不会绕过maximumWorkers。外部适配器必须自己提供有界I/O，无法用Promise竞赛声称物理动作已取消。

无原日志的只读预检可以重新请求，不宣称发生了派发；一旦保存原日志，无完整本地receipt就保持UNKNOWN并只查询原操作。不从外部已保存custody伪造丢失的本地fence ACK，不重做acquire、初始化或迁移，不删除原文件。完整原对象继续精确查询同一receipt。未改普通预览Worker、持久格式、控制SQL或依赖，也没有默认装配物理Authority。

## 实际验证

- Actual file Worker timeouts during preflight, final authorization and trusted COPY_SAME_SCHEMA loading keep the caller/slot occupied until the controlled call returns. Queued work does not invoke another authority early; no target journal is manufactured and original source bytes remain unchanged.
- Timeout before acquisition denies late physical authorization; timeout after acquisition retains the original custody result but no forged local fence ACK. Verification timeout retains exact journal/fences and no initialized database. Query-only recovery never repeats acquire or initialization.
- Timeout during custody inspection of a materialized original retains the slot. Once drained, queued inspection returns the identical actual receipt/database/journal without another acquisition.
- Actual control/Runner/data Worker composition stops while original acquisition has saved custody but has not returned. Consumer stop remains pending through the file Worker timeout, final authorization is false, control storage remains usable, and restart queries only the same incomplete original without service creation or Release.
- The existing file timeout case was revised before execution to assert actual external drain rather than early rejection. No inventory source or dist rebuild occurred while selected tests ran.

drain 10通过，lifecycle 15通过，domain 75通过，共100通过、0跳过。最终完整构建、类型／Lint／契约检查通过；367条源码映射匹配当前源码与vendor，673份输入／产物绑定；所有最终组执行期间及之后无源码／测试漂移。控制SQL1～44与Runner持久格式保留，Runner改动仅数据准备wrapper和说明。未跑完整pnpm check或固定提交干净checkout。

首轮Lint发现新测试条件对象外层多余spread一条告警，保存失败日志及原测试文件SHA／原字节后去掉多余spread。修正后重新完整构建、类型／Lint／契约，通过后才开始测试；未在失败字节运行测试。旧文件超时测试事先同步新排空契约，没有删除该用例。

同一Codex Agent开发复核，不是独立人员或人工产品签认。文件SQLite／Worker／控制事务为实际执行，物理custody／围栏／容器／OCI与上游事实仍为明确夹具；真实身份、Linux／gVisor、物理迁移和完整后继业务链继续验收。完整4.1／5.1／5.2不因本修复关单，OpenSpec仍8/13、不归档；P1-07仍等待P1-06／G0，正式状态及阶段门槛不变。

原始记录：[evidence.json](./development/acceptance-data-drain/evidence.json)、[final-binding.json](./development/acceptance-data-drain/final-binding.json)、[manifest.json](./development/acceptance-data-drain/manifest.json)。
