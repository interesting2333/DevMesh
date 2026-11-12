# P1-07 候选审查开发复核

父工作包仍为正式 NOT_STARTED，等待 P1-06／G0；本记录是用户连续实施授权下的本地开发准备。当前仅新增 Worker 审查内核，尚无预览／dataset、接受准备／T5、发布消费者、人工审查页面或企业身份接入，不据此认定 D01～D08 产品验收完成。

迁移 30 增加不可变人工结果、当前条目指针、同 Run 证据内容外键。`getCandidateReview` 从正式冻结候选、原需求 acceptance、原计划 human-decision 和原质量策略 human 检查生成完整稳定条目；自动质量直接展示原事实。仅项目 owner 可提交观察，标准 meta、If-Match 和 previousResultId 三层保护操作与当前记录；观察绑定准确候选／manifest／itemHash、操作、原预期、实际观察、操作者和时间。新候选需要新审查，历史候选只读；纠正追加记录，原键恢复原结果，撤销成员后不能重取受保护内容。审查不改写原质量、不完成待人工 Tester、不创建 Release，也不改接受指针。

条目最多 2048／定义 512 KiB，当前完整投影 1 MiB，单请求仍 256 KiB。追加后在同一事务检查投影上限，超限整笔回滚；历史按稳定 rowid 和最多 100 条／1 MiB 分页。证据引用与当前指针、操作、资源版本和 `CandidateReviewRecorded` 事件同事务。未知条目、错误预期／hash、同条目冲突、任意人工 N/A、跨 Run 证据和非 owner 写入均拒绝。实体、证据和物理文件可用性是不同事实；此内核检查 DB 可用状态，后续接受服务仍须实际读材料并重核。

失败原记录分别保存在 development/reviews-v1-failed、v2-failed、v3-failed。v1 的审查 7/7、冻结 14/14、存储 28/28 通过，但生成 OpenAPI 先于新 contracts 构建，契约检查 16/18；已在当前构建后重新生成。v2 新增 Work human-decision 用例没有相应冻结质量检查，原 `QUALITY_REQUIRED_CHECK_MISSING` 守卫拒绝；v3 外层策略修正仍未传到会重新生成策略的嵌套夹具，继续保留同一拒绝。最终通过夹具的原 `configureQuality` 入口，在注册和准入前固定相同人工检查，生产守卫没有放宽。早期直接调试有一项误写标准错误码，已按既有 `PRECONDITION_FAILED` 修正断言，不修改契约。

最终开发检查 reviews-v4 全部通过：类型、lint、当前 contracts／storage 构建、审查 8/8、冻结 14/14、存储 28/28（含各历史版本到迁移 30 的备份升级）、契约 18/18 与 OpenAPI；运行期间源码指纹未变化。审查包含独立 Work／质量人工检查、逐条需求、真实跨 Run 读取与证据拒绝，以及无正式冻结的历史 READY 候选拒绝。原日志和指纹见 [reviews-v4/evidence.json](./development/reviews-v4/evidence.json)，固定源码字节绑定单独保存。

同一 Codex 实施和自查，未冒充独立人员或人工业务检查。SQLite／内容／认证 Runner HTTP 实际执行，源 Git 准入与 Runtime 候选来自明确的 release-freeze DB 夹具。真实模型、OIDC、Linux/runsc、真实容器、生产源码映射、构建／健康与数据迁移条件仍暂缺。
