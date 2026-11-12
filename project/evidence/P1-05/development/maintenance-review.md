# 原操作维护组合复核

2026-11-12，同一 Codex Agent 对实现、测试和原始日志复核，无独立人员／产品签认。

`maintenance-v4` 在源码指纹冻结期间完成类型、lint、相关构建、真实本地维护组合 2/2、保存存储 4/4、实际 Runner 屏障回归 5/5 和完整存储迁移回归 28/28。报告与日志哈希同目录保留。前两次夹具缺少 Runner 15 秒 token 收窄而拒绝 Job 的失败记录也保留；此修正只改变夹具，沿用现有 MCP token 策略。

真实组合使用 A2A 已认领 Host、控制面 SQLite、独立 Runner SQLite、带服务身份的实际 HTTP、进程文件锁、持久屏障与独立 Git 仓库。覆盖分配、repo Git、repo 文件、源码保存、完整保存、回收六种原操作；内部 repo 读取复用原域校验，在外层事务内不嵌套 BEGIN。错误 owner／Runner／workspace／原 operation 均拒绝。

排队 Job 和 RUNNING 后停止结果未知的原 Job 均阻止维护；屏障持有期间新 Job 返回 423。测试工具白名单中没有 repo 的原所有者，可由受信任维护服务保存完整原目录；Grant 未撤销时回收拒绝，撤销后的降权 read permit 只能维护原目录，不能启动 Job。真实隔离／删除后 dataset 和受控 Git 保留 ref 可读。

结合 `preservation-v4` 的完整材料／READY／哈希／原 ACK 故障测试与 `reclamation-v2` 的原目录／部分删除／替换路径及独立 receipt 恢复证据，4.1、4.2 的指定行为具备代码和实际本机证据，勾选完成。5.1 中的 Runtime 准备、启动后动态 MCP 工作区绑定与应用组合尚未完成，5.2 的最终固定提交全量验证仍待执行。

ControlledBackend 只记录受控容器事实，未启动实际容器；这不是模型、OIDC、远程 Git、Linux/runsc、掉电持久性、T05/T23 或任何阶段门槛通过的结论。父工作包仍遵守其正式前置。
