# P1-06 本地服务组合与恢复说明

适用源码检查点 `facf9ef7a4c59e3dd1755e7570e4bddcf6b9bd1a`。本说明描述已有显式服务的调用顺序，没有默认开启后台自动执行或增加普通模型工具权限。当前应用不自动推断模型、OIDC、Runner、Git 或映射配置；本地协议组合测试采用脚本化模型 HTTP 和受控 Runner 输出，不能作为真实模型或生成应用可交付的证明。

## 配置与存储

- 使用仓库固定的 Node 24／pnpm 版本，应用依赖执行 `pnpm install --frozen-lockfile`；OpenSpec 管理工具另执行 `npm ci --prefix tools/openspec`。
- 先按既有 storage 初始化流程建立控制面、Runner 和备份三个独立目录。SQLite 通过 Worker 单写，材料放本地内容库，Runner 工作区与项目 Git 库各自隔离；不得把测试夹具目录当作运行数据根目录。
- `LocalManagedWorkspaces`、`LocalSourceArchives`、`LocalCandidateIntegrations`、`LocalRunnerWorkspaceFencer` 和 `createLocalManagedRuntimeLifecycle` 是显式 `local-development` 适配器。Runner 身份、凭据引用、镜像 digest、批准命令和资源上限由可信部署配置注入，不从模型输出生成。
- 质量策略与交付清单在 Tester 准入前固定，`qualityPolicyHash(policy)` 必须进入原 inputManifest 的 checkConfigHash；修复／复验延用原模板和质量配置。普通 MCP 不提供注册或降门槛入口。
- `QualitySourceProvider` 必须来自可信独立工具链，以准确 Git manifest 和实际源码建立完整位置范围。生产工具链尚未提供；组合测试的单行 export 映射仅适用于其明确夹具，不作为默认 provider。

## 显式调用顺序

1. 负责人发布并确认当前计划；Scheduler 的 `prepareCodeBasis` 调用 `integrations.prepareWorkInput`，资源规划只读，准入和 A2A 受理由原 Worker／Registry 守卫核实。角色配置、模板与配置哈希按 Run 固定。
2. Runtime 使用托管 lifecycle 分配准确代码工作区。Developer 的写入、提交经认证 MCP 和资源围栏，Runtime 保存原结果日志、保留实际 Git 归档 ACK 后原子发布候选并进入 VERIFYING。调用 `WorkVerifier.verify` 生成正式评估及完成事实，不提交模型自报 success。
3. Tester 的托管工作区 READY 后，可信控制代码以持久原 operationId 调用 `QualityCollector.prepare`。独立 SOURCE 材料 ACK 后才允许发送原流水线。创建 pipeline 后用 `collector.bind` 固定 producer 到原 stage；缺准备或绑定时，Coordinator 不发送 stage，不能靠时间先后猜测来源。
4. PipelineCoordinator 持续核实原作业。`collector.collect` 只 GET 原 Job／输出，保存日志和报告并独立计算；未知保持 PENDING，不启动替代 Job。EVALUATED 后 `collector.references` 实际读取原 REPORT／RESULT 字节并发布稳定 artifact 引用。可信服务将这些准确引用交给 Tester 上下文；模型不能绑定其他报告作为原质量事实。
5. Tester Runtime 发布结构化候选后，负责人调用 `WorkVerifier.verify`，同时提交原 qualityOperationId。原失败产生 completed-with-findings 和不可变缺陷；人工项 PENDING 不提前完成。没有原质量操作、准确来源或必要材料时不能通过。
6. 确定失败可调用 `RepairPlanner.prepare`／`publish`，保存新前向修复／复验节点。新计划仍须负责人明确确认 reviewHash 和 carryForwardHash；未确认不派发。需求／接口变化、扩写范围、未知副作用、超过两轮或 30 Work 拒绝自动规划。
7. 新 Developer／Tester 必须分别获得准确修复归档和新合并 SHA 的正式证明。负责人以 `recordVerifiedFindingResult` 关联原缺陷与新 Attempt；原失败保留，只有匹配原检查及准确新源码的全部必要检查通过才关闭。
8. 全部必要证明就绪后，最终 `integrations.integrate` 使用 `purpose: run-candidate` 和已测试工作输入的 originOperationId。适用来源必须完全相同，实际 Git 校验原 refs／manifest 后发布同一已测试提交；不为新合并 SHA 沿用旧通过。
9. 负责人登记与原质量策略 delivery 清单完全一致的交付策略，`DeliveryCollector.collect` 只读原 Job／输出并核对构建、OCI 字节、准确数据方案及必要材料。失败、不完整、陈旧、未经批准替换数据均拒绝；此步不启动镜像或执行迁移。
10. `CandidateFreezer.freeze` 接标准 meta、当前 If-Match、准确源码／交付操作，实际读材料后在单一事务重核依据并追加候选、内容外键、REVIEW 和事件。人工检查逐项保留 PENDING。接受指针不变，P1-07 仍须独立完成审查、数据准备、预览健康及接受前核验。

## 中断与恢复

原 operationId、meta、稳定内容键、质量 producer／stage 绑定及 source origin 均需保留。SENT／未知 Job 或 Git 外部动作只查询原对象；缺少回执不代表未执行。Runtime 已发送模型或工具后不能直接从头 execute；使用原恢复接口和日志核实，不重放提交、归档、构建或测试。Plan／Run epoch、权限、控制门或原来源变化时，不创建新证明来掩盖旧操作。

质量／交付采集和 artifact 发布分别保留原内容与结果，丢回执用原操作恢复。候选原键恢复返回原修订；新材料／源码需新操作及重新验证，旧候选显示 STALE，历史正文不覆盖。实际缺失或损坏内容由内容库标记，冻结不能只依靠数据库 READY 标志。外键阻止已引用内容 GC；备份与保留按既有存储流程执行。

冻结详情正文最多 192 KiB，正文与预检哈希集合合计最多 240 KiB；最多 2048 个预检对象／512 MiB，单对象 64 MiB。单个实际 Runner 作业输出收集仍最多 64 MiB（含日志），交付格式的较大理论上限不扩大 Runner 能力。超限返回明确错误，不截断或丢弃证明。

## 验证边界

运行 `pnpm test:verification` 可验证解析、原来源、持久验证、引用发布、修复、交付、候选冻结及同一 Run 的本地组合；固定提交干净 checkout 使用 `node scripts/verify-foundation.mjs --commit <完整 SHA> --output <目录>`，要求 checkout 干净且依赖已按锁文件安装。完整报告和原日志保存为证据，不能用格式检查或本地受控事实替代产品验收。

仍需外部条件才能验证：真实模型质量与预算、企业身份配置、Linux／Docker＋gVisor 执行与停止核实、真实生产覆盖映射、生成应用构建／启动／Demo 健康、真实数据准备与迁移、导出语义／脱敏、人工接受及阶段签认。缺这些资源时继续保留缺项，不把受控夹具记为相关能力通过。
