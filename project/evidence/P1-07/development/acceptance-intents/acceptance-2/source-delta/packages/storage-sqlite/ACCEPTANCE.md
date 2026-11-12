# 接受准备的持久意图

迁移 36 在私有 Worker 内新增接受准备协议，当前为 OpenSpec 4.1 的首批实现。没有 READY、Release 创建或 T5 提交命令。企业身份、实际外部准备、fencing／健康凭证及发布仍按后续步骤完成。

可信宿主显式调用 `registerAcceptanceBackendPolicy`；该配置入口不挂公共 HTTP／MCP。owner 的普通项目身份不能替代配置的后端主体签派发／未知观察。登记配置不证明后端实际就绪。

`beginAcceptancePreparation` 使用标准 meta、Run scope 与强 If-Match，要求准确 CURRENT 候选、完整 PASS 审查、原接受指针和 dataPlanHash。服务端固定 Run 代际、镜像、原数据身份与 schema、准确策略，预留原 releaseId／新的 targetDatasetId 和派生存储键；不创建文件或数据库对象，不将预览克隆默认替换已接受数据。原键恢复返回同一原意图的当前状态，权限仍重新校验。

REPLACE 另要求 `recordAcceptanceReplacementDecision` 的明确确认，绑定当前候选、审查、原接受 release 和完整数据方案。初始方案拒绝伪造替换确认。迭代替换与迁移的实际执行／凭证验证仍未完成，不能凭该记录直接覆盖数据。

每项目只有一个未核实准备。配置的后端通过 `markAcceptancePreparationSent` 原子获得一次派发许可；派发 ACK 丢失后再次请求仅返回 dispatch=false。SENT／UNKNOWN 跨 Worker 重开保留，只能核实原操作／requestHash／目标，不能创建替代准备。`markAcceptancePreparationUnknown` 不证明外部失败或释放目标。

当前 owner 可通过独立原键／If-Match 的 `failUnsentAcceptancePreparation` 关闭准确 PREPARED；SENT／UNKNOWN 拒绝关闭，不靠 TTL 自动重开写门。意图、追加历史、操作响应与领域事件同事务。`listAcceptancePreparations` 恢复扫描仅允许准确项目／策略的后端，游标不是变化流，每轮应从零扫描；成员查询／历史继续校验当前归属。

下一步在相同原身份上补充外部准备和只读核实、物理数据关闭／排空／迁移、Runner 归属／健康凭证，再实现 T5。当前 Worker 不自动调用外部后端，不把网关零在途或任何 HTTP 响应当作这些证据。
