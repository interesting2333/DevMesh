# ResultVerifier

纯计算入口 `evaluateQuality` 只接受固定策略、完整源码／位置范围、原执行身份和原报告字节。覆盖率按数量和位置身份合并，行／分支至少 80/70；不接受模型自报百分比。`QualityCollector` 将它连接到 SQLite、Runner HTTP 和本地内容库，默认不启动后台循环。

## 服务顺序

1. 可信部署代码注册 `qualityPolicy`，其规范哈希必须已进入 Tester 的准入 inputManifest。普通 MCP 工具不能注册或放宽策略。
2. 在固定 verification 工作区 READY、Attempt WORKING／VERIFYING 且任何流水线尚未发出时，调用 `QualityCollector.prepare(beginInput)`。需要显式注入 `QualitySourceProvider`；缺配置返回 `QUALITY_SOURCE_PROVIDER_NOT_CONFIGURED`。
3. provider 从准确 Git manifest 和独立可信工具链生成全量位置范围，返回 `QualitySourceScope`。文件名／内容哈希必须与原分配清单完全一致；providerId／toolchainHash 随 SOURCE 材料固定。禁止从待验证命中报告生成这个范围，也不能执行报告指向的宿主脚本。
4. SOURCE 字节和业务引用在内容 ACK 事务落定后，才允许 verification 工作区首次发送流水线。可信服务用 `bind` 将每个 producer 固定到原 pipeline／ordinal；必须在该 stage PENDING 时完成，之后不能改 Job。
5. PipelineCoordinator 持续核实原 Job。`collect({principalId,operationId})` 只 GET 原 Job／operation 和输出索引；验证实际 argv 哈希、镜像、退出事实、原输出 SHA／大小，再登记日志、报告和计算结果。
6. `PENDING` 返回明确待核实代码，保持原验证 PREPARED。未知 Job、缺报告、HTTP 不可用或字节不符均不能形成通过。已登记材料可从内容库重读；终态回执丢失只返回原 EVALUATED，不发起测试。
7. 本地 Runtime 将原角色候选、A2A 完成和已调度 Attempt 的 VERIFYING 状态在同一事务发布；共享 Registry 守卫核实当前 Run／Work epoch、控制门和非终态。原回执重放不会重复变更状态；暂停恢复可保留原产物，不推进已关闭的工作。项目负责人随后调用 `WorkVerifier.verify({principalId,operationId,runId,attemptId,qualityOperationId})`。服务读取原候选和材料字节；Worker 从当前计划／需求／Work revision／epoch、原归档或质量操作及完成条件派生评估。Developer 无法证明的检查保留 MISSING；Tester 不能用模型 PASSED 覆盖原失败。未解决候选缺陷及缺失引用也不能变为成功，独立质量计算仍保留原结果。
8. Work 评估正文与 artifact 在同一内容 ACK 事务登记，随后完成事务重核依据并应用固定的 outcome／outputs／commit／evidence。PASS 可完成，Tester 的确定 findings 单独保留；必要人工项待处理时保持未完成。原键恢复只查询原证据和完成操作，不调用模型或 Runner。只读成员可查询历史，不通过该服务以负责人身份写入或重放。
9. Tester 的独立、可复现原失败与 Work 完成原子生成缺陷。每个缺陷固定检查、准确 SHA／配置、原命令和执行身份、需求验收文本、原材料哈希；模型声明和基础设施故障保留原评估，不据此自动创建业务修复。
10. 项目负责人通过私有 Worker 命令 `linkVerifiedFindingFix` 关联已确认的前向修复 Work，再以 `recordVerifiedFindingResult` 记录原复验事实。仅新的 APPLIED Developer／Tester 证明、包含原修复归档的准确合并候选、相同检查及需求依据、全部必要检查通过且无待人工项，才允许关闭原缺陷。旧 SHA、模型自报及历史兼容结果不能关闭；再次失败和待核实分别追加 FAILED／NOT_VERIFIED 历史。普通 MCP 无权改写这类缺陷。

SOURCE 声明／登记与 stage 首次 SENT 的互斥由 SQLite 顺序保证，不依赖控制面和远端的时钟比较。原操作、依据、producer 绑定、材料 writeKey 和终态结果不可变；暂停后原历史可保留，但 qualification 变为 STALE。读取受当前项目成员权限约束，写入只允许原项目负责人。

## 当前边界

本包提供显式服务和可信映射 provider 接口，没有默认生产映射工具链，也没有自动将模型结论作为验证。源码、报告、结果留在专用本地内容 target，数据库保存其引用和原始依据；正文不穿过 256 KiB Worker RPC。材料最多 50 项／128 MiB，单报告最多 8 MiB，SOURCE／日志最多 16 MiB。

新的 `recordVerifiedWork` 只接受已 ACK 的不可变 Work 评估及其稳定 completionKey，调用方不能自行提交 success；一般 `transitionAttempt` 不能直接进入 SUCCEEDED。历史已提交操作按原键重放，旧结果保留。测试用历史数据只在测试文件中显式种入，不向应用提供 fixture 开关。Work 评估及质量材料的外键会阻止 GC，缺失或变更的来源不能复用为当前证明。

本地采集测试使用实际认证 HTTP、Runner SQLite、输出文件、PipelineCoordinator 和内容存储；执行后端写入固定报告，Git／准入与独立映射为明确夹具。正式 Tester 完成用例明确种入原 Runtime 候选等数据库事实；Developer 链路另用真实本地模型协议 HTTP 夹具、Runtime、认证 MCP、Git 提交／归档和 Worker 测试。缺陷测试实际执行 WorkVerifier、原报告计算、内容 ACK 和缺陷事务，明确种入 Git／准入／Runner／Runtime 候选事实。这些用例不证明真实模型、OIDC、Linux／gVisor 执行或生产工具链。生产映射 provider、Runtime 自动组合、前向修复规划和候选冻结继续按 OpenSpec 实施。
