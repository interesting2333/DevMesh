# 接受准备、原证明与当前可用性

迁移 36 保存原接受意图，迁移 37 保存不可变准备证明和追加的当前观察，迁移 38 统一数据策略／准备归属及逻辑写门，迁移 39 增加独立 T5 提交。准备 READY 与用户已接受分开。当前有私有 T5 命令及可信材料核验调用层；默认实际准备后端、完整服务装配、企业身份、物理准备／fencing、真实容器健康及发布消费者继续实施和验证。

可信宿主显式调用 `registerAcceptanceBackendPolicy`；该配置入口不挂公共 HTTP／MCP。owner 的普通项目身份不能替代配置的后端主体签派发／未知观察。登记配置不证明后端实际就绪。

`beginAcceptancePreparation` 使用标准 meta、Run scope 与强 If-Match，要求准确 CURRENT 候选、完整 PASS 审查、原接受指针和 dataPlanHash。服务端固定 Run 代际、镜像、原数据身份与 schema、准确策略，预留原 releaseId／新的 targetDatasetId 和派生存储键；同事务登记 PREPARING 元数据、真实准备归属和初始 CLOSED 逻辑门，不创建业务 SQLite 文件，不将预览克隆默认替换已接受数据。原键恢复返回同一原意图的当前状态，权限仍重新校验。

`dataset_backend_policies` 区分 PREVIEW／ACCEPTANCE；原 `preview_backend_policies` 是只暴露预览策略的兼容视图。`dataset_preparations` 永久绑定准确原 operation／requestHash／dataset／项目／用途／策略与 baseReleaseId。只有 PRESERVE_MIGRATE 登记旧 dataset 为复制 origin；REPLACE 的 origin 为空，baseReleaseId 继续固定旧基线。接受准备数据暂无限期保留，retentionUntil 的 `9999-12-31T23:59:59.999Z` 是明确的无限期标记，不能按预览 TTL 清理。

`getAcceptanceDataset` 是校验成员／原后端及原 hash 的私有只读查询。原后端取得派发许可后，可用 `closeAcceptanceSourceWriteGate` 关闭原请求指定的旧门，不能自行传其他来源；expectedRevision／expectedFence 防止旧依据的新动作。闭门、递增 fence、历史和 Run 事件同事务，丢 ACK 按原请求恢复；关闭不等同 HTTP 排空、数据库只读或物理 fencing。接受目标从 fence=0 初始 CLOSED，没有伪造 OPEN→CLOSED 记录；当前没有开放或自动重开命令。

REPLACE 另要求 `recordAcceptanceReplacementDecision` 的明确确认，绑定当前候选、审查、原接受 release 和完整数据方案。初始方案拒绝伪造替换确认。迭代替换与迁移的实际执行／凭证验证仍未完成，不能凭该记录直接覆盖数据。

每项目只有一个未核实准备。配置的后端通过 `markAcceptancePreparationSent` 原子获得一次派发许可；派发 ACK 丢失后再次请求仅返回 dispatch=false。SENT／UNKNOWN 跨 Worker 重开保留，只能核实原操作／requestHash／目标，不能创建替代准备。`markAcceptancePreparationUnknown` 不证明外部失败或释放目标。

当前 owner 可通过独立原键／If-Match 的 `failUnsentAcceptancePreparation` 关闭准确 PREPARED；SENT／UNKNOWN 拒绝关闭，不靠 TTL 自动重开写门。意图、追加历史、操作响应与领域事件同事务。`listAcceptancePreparations` 恢复扫描仅允许准确项目／策略的后端，游标不是变化流，每轮应从零扫描；成员查询／历史继续校验当前归属。

`AcceptancePreparer` 需显式传入可信 `AcceptancePreparationBackend`。未配置不派发；preflight 在意图外只读检查；取得唯一派发许可才调用 prepare。SENT／UNKNOWN、许可 ACK 丢失或重开后只调用 inspect，查询原请求的对象，不能重新初始化、迁移或创建实例。适配器在每个新动作前调用最后授权，持有实际持久操作日志；该接口不是一个默认启用的生产适配器。

可信后端的 READY 观察固定完整原 requestHash／候选／reviewHash／数据方案／release／Runner，目标 dataset／存储键／schema、源 release、快照 SHA／大小／完整性／迁移引用／原 journal，源逻辑关门与物理 fence、目标关闭 fence，以及准确服务 reservation／profile／实例／镜像／端点和 RELEASE_HELD claim。首次证明只写一次，同事务将原目标元数据推进 WRITE_FROZEN，后续观察不能换文件证明、fence 或实例；不创建 Release。保留／替换原数据时须存在准确原关闭记录，关闭、取得物理 fence、快照和准备时间有序；原网关零在途只能作逻辑检查。

每次 inspect 返回 READY 前必须实际复核原 source／target 物理 fence 仍持有、目标写门仍关闭、Runner 原 claim 仍为 RELEASE_HELD 及原服务当前健康。新鲜观察绑定原 fence proofHash／claimHash／端点和不回退的 custodyRevision，Worker 只接受 0～30 秒健康年龄；未来时间或超时关闭当前 READY。UNKNOWN 保留原不可变证明但关闭可用性；UNKNOWN 不重置归属版本高水位。观察同时 CAS 核实开始时的 preparationRevision 与观察 sequence，二者及不可变历史和领域事件同事务；后续原准备 UNKNOWN 用持久 revision 关闭旧 READY，即使两个提交同一毫秒也不依赖时间比较。原重复 ACK 仅返回当前投影，不复活旧 READY。角色、候选或审查失效显示 STALE。

这些私有回执只有显式后端主体可写，当前没有公共 HTTP／MCP 健康或回执入口。声明的 fence／健康字段不自动证明物理事实，只有实际适配器核验原对象才能签发；受控测试后端不是实际物理验收。真实数据准备／隔离／迁移和 Runner 装配、正向迭代保留／替换继续验证。原 SENT／UNKNOWN 不因当前 READY 或后续 T5 改写派发历史，也不靠期限解除或重开旧门。

`commitReleaseAcceptance` 只允许当前 owner，使用独立 meta／Run scope／强 If-Match 与明确 ACCEPT_RELEASE。输入固定原 preparationOperationId／requestHash／expectedPreparationRevision、最新 expectedObservationSequence／proofHash、准确 candidate revision／manifest／reviewHash、原接受指针与 dataPlanHash。新命令在单一 writer 事务重新核实全部依据、当前 HELD 健康／fence、READY 材料及无未知写，原子保存 Release、指针 CAS、acceptance_commits、必要人工完成、Run COMPLETED、专用 release_promotion_outbox、事件和原操作响应。任一步失败回滚；事务无文件或网络 I/O。

`ReleaseAcceptor` 是显式可信调用层，先通过内容权限读取实际冻结材料、核对全部 SHA 与大小限制，再调用该命令。它不建立准备后端或签发物理证明。原键已存在时直接由 writer 核实权限／原正文并恢复，因此 ACK 丢失、Run 终态或材料后续不可用不导致重接受。`getAcceptedRelease` 只读返回迁移 39 提交时的原接受收据（含提交时 PENDING）；旧 Release 不伪造迁移回填，实际发布观察独立。

原准备的 resolution 投影为 UNRESOLVED／UNSENT_FAILED／COMMITTED／ABORTING，与派发 state 分开；已提交不再占项目未核实准备名额，SENT／UNKNOWN 无提交结论继续阻塞，包括 ABORTING。准备器跳过已提交和撤销中的对象，不重新准备或追加旧 READY。MANUAL_PENDING 只对冻结时已核实的最终 Tester 追加 work_acceptance_completions，绑定原 assessment 和具体人工结果，结束 Attempt／释放 slot；原自动评估、质量、候选 manifest 和 proof 不覆盖。

`requestAcceptanceAbort` 为当前 owner 的独立命令：准确 Run scope、强 If-Match、原准备 operation／hash／revision、原因与明确 ABORT_ACCEPTANCE_PREPARATION。在同一 writer 内确认原 SENT／UNKNOWN 尚未接受及原指针未切换，保存不可变 acceptance_abort_decisions、事件、Run 资源版本和原操作结果。决定固定完整原准备、实际已存 proofHash（尚无 proof 则 null）、操作者与时点。过期候选／Run 代际不阻止 owner 撤销；未派发对象沿用 failUnsentAcceptancePreparation，已接受对象不能撤销。相同键恢复原结果，仍复核当前 owner；新键不能替换原决定。

迁移 40 只增加决定和反向屏障，不改旧迁移。ABORTING 立即关闭 verify／当前 READY／新观察／UNKNOWN 更新／源闭门和 T5，保留原 proof、观察、派发 state、目标 CLOSED 与项目未核实占用；数据库也拒绝迟到证明、观察、接受提交和目标开门。准确重复旧观察只读返回关闭投影。`getAcceptanceAbortDecision` 允许原后端或当前成员按原 hash 恢复决定；未配置公共 HTTP／MCP 破坏性入口。

该决定不发 Docker stop／rm，不释放物理 fence／Runner 资源、不删除 dataset、不重开旧门，也不生成 ABORTED。决定前已获许可的在途外部动作仍可能完成；控制面拒收迟到 READY 不证明物理动作已停止。后续清理必须核实同一决定与原对象，逐步保存明确结果；只有旧源可恢复、目标服务停止和 fence 交接等独立事实齐全后才能解除占用。失联或清理结果未知保留 ABORTING。完整安全撤销仍待实施。

专用 promotion 意图固定完整原准备、准确 proof 与接受 operation，普通 A2A Outbox 不消费。T5 只保存 ACCEPTED／提交时 PENDING，不切路由、不开写门、不确认 OWNED、不导出；这些消费者及明确未提交后的安全撤销继续实施，失败不能倒退接受事实。Release、提交结论、人工覆盖层及发布意图禁止更新和删除。

新 T5 要求 `devmesh.acceptance-service-claim.v1` 的完整 ACCEPTANCE 用途与绑定。旧预览 claim 仍可读取历史准备证明，但不能用作新接受服务的用途证明；不会自动升级、重新签 claim 或替换原实例。

已构建依赖后用 `pnpm test:acceptance` 执行本地协议回归，根 `pnpm check` 包含该组。用例的原质量收集经过实际 Runner HTTP、文件和 SQLite，但 A2A 准入／授权、Git、OCI／容器和人工观察为明确夹具；没有真实 Runtime 心跳的授权夹具只在派发前签发 15 秒授权，生产租约和作业期限不变。

## 撤销完成（迁移41）

私有原后端getAcceptanceAbortRecovery／completeAcceptanceAbort校验原不可变准备和策略，不依赖当前候选资格。完整证明绑定原决定、Runner清理摘要、数据abort请求／原journal及永久撤权，已保存proof还要求准确原fences和service。源存在时要求旧接受指针、冻结manifest镜像、恢复后fence与RELEASE_OWNED／READ_WRITE服务、30秒内健康，原写DISPATCHED／UNKNOWN全部核实后才提交。

acceptance_abort_completions、源门重开及历史、Run版本／事件同一writer原子保存。只重开本准备准确关闭的源门，fence／revision各加一；原OPEN门保持原历史，目标永久CLOSED。ABORTED解除本准备占用，保留原SENT／UNKNOWN及proof／决定／数据。准确重复返回原完成回执，改证据失败。此API不清理物理资源，不接公共HTTP成功标志；真实物理恢复及发布服务转换仍须独立实现。
