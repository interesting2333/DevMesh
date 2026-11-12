# 接受准备、原证明与当前可用性

迁移 36 保存原接受意图，迁移 37 保存不可变准备证明和追加的当前观察。私有控制面可计算准备 READY；它不是 Release 或用户已接受。尚无默认实际准备后端、Release 创建或 T5 提交命令；企业身份、物理准备／fencing、真实容器健康及发布继续实施和验证。

可信宿主显式调用 `registerAcceptanceBackendPolicy`；该配置入口不挂公共 HTTP／MCP。owner 的普通项目身份不能替代配置的后端主体签派发／未知观察。登记配置不证明后端实际就绪。

`beginAcceptancePreparation` 使用标准 meta、Run scope 与强 If-Match，要求准确 CURRENT 候选、完整 PASS 审查、原接受指针和 dataPlanHash。服务端固定 Run 代际、镜像、原数据身份与 schema、准确策略，预留原 releaseId／新的 targetDatasetId 和派生存储键；不创建文件或数据库对象，不将预览克隆默认替换已接受数据。原键恢复返回同一原意图的当前状态，权限仍重新校验。

REPLACE 另要求 `recordAcceptanceReplacementDecision` 的明确确认，绑定当前候选、审查、原接受 release 和完整数据方案。初始方案拒绝伪造替换确认。迭代替换与迁移的实际执行／凭证验证仍未完成，不能凭该记录直接覆盖数据。

每项目只有一个未核实准备。配置的后端通过 `markAcceptancePreparationSent` 原子获得一次派发许可；派发 ACK 丢失后再次请求仅返回 dispatch=false。SENT／UNKNOWN 跨 Worker 重开保留，只能核实原操作／requestHash／目标，不能创建替代准备。`markAcceptancePreparationUnknown` 不证明外部失败或释放目标。

当前 owner 可通过独立原键／If-Match 的 `failUnsentAcceptancePreparation` 关闭准确 PREPARED；SENT／UNKNOWN 拒绝关闭，不靠 TTL 自动重开写门。意图、追加历史、操作响应与领域事件同事务。`listAcceptancePreparations` 恢复扫描仅允许准确项目／策略的后端，游标不是变化流，每轮应从零扫描；成员查询／历史继续校验当前归属。

`AcceptancePreparer` 需显式传入可信 `AcceptancePreparationBackend`。未配置不派发；preflight 在意图外只读检查；取得唯一派发许可才调用 prepare。SENT／UNKNOWN、许可 ACK 丢失或重开后只调用 inspect，查询原请求的对象，不能重新初始化、迁移或创建实例。适配器在每个新动作前调用最后授权，持有实际持久操作日志；该接口不是一个默认启用的生产适配器。

可信后端的 READY 观察固定完整原 requestHash／候选／reviewHash／数据方案／release／Runner，目标 dataset／存储键／schema、源 release、快照 SHA／大小／完整性／迁移引用／原 journal，源逻辑关门与物理 fence、目标关闭 fence，以及准确服务 reservation／profile／实例／镜像／端点和 RELEASE_HELD claim。首次证明只写一次，后续观察不能换文件证明、fence 或实例；prepare 完成不创建控制面 dataset／Release 行。保留／替换原数据时须存在准确原关闭记录，关闭、取得物理 fence、快照和准备时间有序；原网关零在途只能作逻辑检查。

每次 inspect 返回 READY 前必须实际复核原 source／target 物理 fence 仍持有、目标写门仍关闭、Runner 原 claim 仍为 RELEASE_HELD 及原服务当前健康。新鲜观察绑定原 fence proofHash／claimHash／端点和不回退的 custodyRevision，Worker 只接受 0～30 秒健康年龄；未来时间或超时关闭当前 READY。UNKNOWN 保留原不可变证明但关闭可用性；UNKNOWN 不重置归属版本高水位。观察同时 CAS 核实开始时的 preparationRevision 与观察 sequence，二者及不可变历史和领域事件同事务；后续原准备 UNKNOWN 用持久 revision 关闭旧 READY，即使两个提交同一毫秒也不依赖时间比较。原重复 ACK 仅返回当前投影，不复活旧 READY。角色、候选或审查失效显示 STALE。

这些私有回执只有显式后端主体可写，当前没有公共 HTTP／MCP 健康或回执入口。声明的 fence／健康字段不自动证明物理事实，只有实际适配器核验原对象才能签发；受控测试后端不是实际物理验收。后续须完成真实数据准备／隔离／迁移和 Runner 装配、正向迭代保留／替换验证，再实现 T5。原 SENT／UNKNOWN 不因当前 READY 自动改写为成功，也不靠期限解除或重开旧门。

已构建依赖后用 `pnpm test:acceptance` 执行本地协议回归，根 `pnpm check` 包含该组。用例的原质量收集经过实际 Runner HTTP、文件和 SQLite，但 A2A 准入／授权、Git、OCI／容器和人工观察为明确夹具；没有真实 Runtime 心跳的授权夹具只在派发前签发 15 秒授权，生产租约和作业期限不变。
