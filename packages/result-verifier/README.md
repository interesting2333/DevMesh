# ResultVerifier

纯计算入口 `evaluateQuality` 只接受固定策略、完整源码／位置范围、原执行身份和原报告字节。覆盖率按数量和位置身份合并，行／分支至少 80/70；不接受模型自报百分比。`QualityCollector` 将它连接到 SQLite、Runner HTTP 和本地内容库，默认不启动后台循环。

## 服务顺序

1. 可信部署代码注册 `qualityPolicy`，其规范哈希必须已进入 Tester 的准入 inputManifest。普通 MCP 工具不能注册或放宽策略。
2. 在固定 verification 工作区 READY、Attempt WORKING／VERIFYING 且任何流水线尚未发出时，调用 `QualityCollector.prepare(beginInput)`。需要显式注入 `QualitySourceProvider`；缺配置返回 `QUALITY_SOURCE_PROVIDER_NOT_CONFIGURED`。
3. provider 从准确 Git manifest 和独立可信工具链生成全量位置范围，返回 `QualitySourceScope`。文件名／内容哈希必须与原分配清单完全一致；providerId／toolchainHash 随 SOURCE 材料固定。禁止从待验证命中报告生成这个范围，也不能执行报告指向的宿主脚本。
4. SOURCE 字节和业务引用在内容 ACK 事务落定后，才允许 verification 工作区首次发送流水线。可信服务用 `bind` 将每个 producer 固定到原 pipeline／ordinal；必须在该 stage PENDING 时完成，之后不能改 Job。
5. PipelineCoordinator 持续核实原 Job。`collect({principalId,operationId})` 只 GET 原 Job／operation 和输出索引；验证实际 argv 哈希、镜像、退出事实、原输出 SHA／大小，再登记日志、报告和计算结果。
6. `PENDING` 返回明确待核实代码，保持原验证 PREPARED。未知 Job、缺报告、HTTP 不可用或字节不符均不能形成通过。已登记材料可从内容库重读；终态回执丢失只返回原 EVALUATED，不发起测试。

SOURCE 声明／登记与 stage 首次 SENT 的互斥由 SQLite 顺序保证，不依赖控制面和远端的时钟比较。原操作、依据、producer 绑定、材料 writeKey 和终态结果不可变；暂停后原历史可保留，但 qualification 变为 STALE。读取受当前项目成员权限约束，写入只允许原项目负责人。

## 当前边界

本包提供显式服务和可信映射 provider 接口，没有默认生产映射工具链，也没有自动将模型结论作为验证。源码、报告、结果留在专用本地内容 target，数据库保存其引用和原始依据；正文不穿过 256 KiB Worker RPC。材料最多 50 项／128 MiB，单报告最多 8 MiB，SOURCE／日志最多 16 MiB。

本地采集测试使用实际认证 HTTP、Runner SQLite、输出文件、PipelineCoordinator 和内容存储；执行后端写入固定报告，Git／准入与独立映射为明确夹具。它们不证明真实模型、OIDC、Linux／gVisor 执行或生产工具链。正式 Work 完成绑定、Runtime 自动组合、修复和候选冻结按 OpenSpec 后续任务继续实施。
