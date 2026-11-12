# P1-06 固定源码检查点复核

源码提交 `facf9ef7a4c59e3dd1755e7570e4bddcf6b9bd1a`，2026-11-12 在独立干净 Windows checkout 使用 Node v24.13.1／固定 pnpm 离线冻结安装，并完成全部 22 项适用检查。报告时间为 UTC 07:38:00～07:56:52。共 423 项测试，421 通过、2 项环境条件跳过、零失败／取消；质量验证 111/111、工作区 103/103、存储 28/28。工具链、vendor、完整构建、类型、lint、OpenAPI、台账、严格 OpenSpec 和设计合成一致性均通过。

原报告、逐项原日志和安装前置记录见 [windows-facf9ef/evidence.json](./windows-facf9ef/evidence.json)、[report.json](./windows-facf9ef/report.json) 和 [preflight.json](./windows-facf9ef/preflight.json)。结束后核对 checkout HEAD 与清洁状态、393 个输入文件的实际字节哈希、锁文件及每份日志 SHA-256；没有在运行中修改该 checkout。此源码检查点不包含随后开始的 P1-07 审查代码，不能将其回归结果扩写为后续代码通过。

两项跳过分别为 Windows 不适用的 POSIX SIGTERM，以及 Linux Docker 适配器受控 CLI 用例；后者即使在 Linux 通过也不能替代真实 Docker／gVisor 验收。原跳过行在 smoke 与 runner 原日志中保留。

T10 开发复核确认：覆盖 79/80、69/70 与精确整数阈值、全业务范围与共享源码去重、零分支规则及空业务集合拒绝；必要测试失败／跳过／缺失、准确 SHA／配置／命令／报告原字节校验；原失败不可变、准确新 SHA 修复复验与两轮前向预算；候选不能使用历史兼容证明、旧最终 Tester 报告或未知副作用放行；原材料实际读取、引用／GC 互斥、冻结事务回滚与原键恢复。人工项在候选中保持 PENDING，冻结后接受指针不变。

完整本地组合与限制见 [composition-development-review.md](./composition-development-review.md)，显式部署顺序／恢复入口见 [local-service-wiring.md](./local-service-wiring.md)。组合实际使用同一 Run 的 SQLite、Git、A2A／模型协议／MCP／Runner HTTP 和内容库；模型响应、Runner 报告／构建／OCI 字节仍是受控夹具，生产独立覆盖映射工具链未配置。本轮没有验证真实模型质量、企业 OIDC、Linux/runsc、生成应用实际构建／启动／Demo 健康、真实数据迁移、语义／脱敏导出或人工产品验收。

结论：同一 Codex 实施 Agent 已复核本地开发记录，OpenSpec 的 5.1／5.2 按其明确范围完成。正式 P1-06 仍等待前置和 G0；父工作包、独立评审和阶段／产品签认不由本次本地回归推导。变更暂保留未归档，后续真实环境验证条件继续追踪。
