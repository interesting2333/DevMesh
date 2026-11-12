# Local managed workspace deployment

本记录说明 P1-05 已实现的显式本地开发组合。它需要同机独立控制面和 Runner 服务、真实本地 Git、SQLite 与 MCP/A2A HTTP；没有 Docker/runsc 时可执行本地协议测试，不能据此启用不受控宿主命令。远程身份、跨节点传输、Linux/runsc 及产品验收仍另行执行。

## Configuration and initialization

1. 控制面 `dataRoot`、Runner `dataRoot`、备份根互不包含。沿用已有 storage init/migrate；升级到迁移 20 前提供已存在的独立备份目录。历史 SQL 和校验值不变，应用回滚不降级数据库。
2. Runner 使用真实认证的 `RunnerClient`。`createLocalManagedRunnerAuthority({mode:'local-development',storage,runnerId,controllerId})` 注入其执行、fence 和 cleanup 回查；controllerId 必须匹配实际认证服务身份。缺省不提供维护授权。
3. 用 `LocalRunnerWorkspaceFencer` 配置同机三根和该 Client；`LocalManagedWorkspaces`、`LocalSourceArchives`、后续保存和回收使用同一个 Worker 与实际 fencer。不能用仅内存锁替代部署中的 Runner 屏障。
4. 可信入口从批准模板子树生成独立初始提交，使用准确 SHA 和部署固定的模板 Provider 调用 `ensureRepository`。项目仓库必须 READY 后再进行角色工作区分配。初始化项目仓库本身不产生 Attempt，不改写既有 Run 的 base。
5. Scheduler 的 `prepareCodeBasis` 调用现有候选准备服务；`planResources` 仅返回当前项目仓库资源、唯一工作区资源 ID、角色快照及明确 Runner 预算。它不 checkout、不续租、不创建模型会话；Worker 在准入事务内重核当前依赖。工作区 ID 每个 Attempt 独立，不能跨 Attempt 复用。

## Trusted application wiring

下列是编程式组合关系，依赖项由可信部署入口构造；没有增加接受宿主路径的模型参数或 HTTP 管理接口。

```ts
import {
  LocalManagedWorkspaces, LocalSourceArchives,
  createLocalManagedBindingResolver, createLocalManagedRuntimeLifecycle,
  createLocalRepoAcquire,
} from '@devmesh/code-workspaces';

const allocator = new LocalManagedWorkspaces({
  mode: 'local-development', storage, runnerId,
  controlDataRoot, runnerDataRoot, backupRoot, templates, fencer,
});
const archives = new LocalSourceArchives({
  mode: 'local-development', storage,
  controlDataRoot, runnerDataRoot, backupRoot, fencer,
});
const lifecycle = createLocalManagedRuntimeLifecycle({
  mode: 'local-development', allocator, archives,
});
const repo = {
  snapshots: [],
  git: {
    bindings: [],
    resolveBinding: createLocalManagedBindingResolver({
      mode: 'local-development', storage, runnerId, runnerDataRoot,
    }),
    scratchRoot, acquire: createLocalRepoAcquire(fencer),
  },
};
```

`startPlatform` 的 `mcp(services)` 工厂负责用其实际 Worker 建立上述对象并返回 repo 与真实 MCP 服务身份／credentialRef；随后 `workspaceLifecycle(services)` 返回同一 `lifecycle`。启用它要求 Runtime 已配置。Scheduler 使用既有 `scheduler` 选项；平台按 MCP → RuntimeConsumer → Scheduler 顺序启动。缺省不配置这些工厂，不会自动扫描目录、创建托管 checkout、调用模型或打开维护能力。凭据解析仅留在可信服务配置，不写入冻结配置、工具 schema、数据库结果正文或 Git。

Runtime 在 Host 租约开始、配置冻结后，以 activationId 派生稳定的原分配操作 ID。READY 分配的物理目录和设备身份仅供可信适配器使用；模型收到 workspaceRef、allocationOperationId、baseCommit 和 manifestSha256。服务启动后才创建的 checkout 由每次请求的动态解析器读取；首次访问也验证原 ACK 身份。

## Results, recovery and reclamation

模型最终响应先完整落盘并计费，Worker 再将精确分配、原成功提交、结果内容和固定源码归档操作写入不可变 `runtime_workspace_results`。开发结果只有对应源码 ACK 后才能发布；候选内容、A2A completed 和 accepted_work FINISHED 在同一事务提交。质量通过、Work 成功、ReleaseCandidate 冻结和人工接受仍是后续独立事实。Runner 新 Job 要求原 Host 仍 ACTIVE，完成的 Host 不能继续执行。

归档或发布回执未知时保留原结果及工作区。可信维护入口使用原 `ExecutionClaim` 调用 `AgentRuntime.reconcileWorkspaceResult(claim)`；它验证当前写成员、原领取者和冻结后端配置，查询原归档 ref／清单并从原结果日志补录候选。它不发起模型调用、工具、checkout、Git 提交或对象传输，也不恢复 Grant。没有最终结果日志、缺少原 archive/ref、配置漂移、主体降权或任务取消时保持待核实；不能换一个 operationId 重跑。原 A2A 完成回执丢失时返回既有候选。

准备阶段中断且没有最终结果日志时，仅核实原分配与物理目录。当前版本不自动恢复模型循环；有会话步骤的原激活必须走已有核实流程。不要删除未知分配以“重试”。

源码 ACK 只证明提交对象保留。完整回收还须 `LocalWorkspacePreservations` 保存未提交、未跟踪和恢复材料，获得完整 ACK、Runner 本地持久 receipt，且原 Grant 明确 REVOKED、实际 Job 已退出。`LocalWorkspaceReclamations` 仅隔离原 Attempt 父目录到原 operation 的 trash；默认额外保留 24 小时。datasets、控制面仓库、备份和外部目录不在删除范围。任何未知材料、目录身份漂移或未知 Job 都保留原目录。

## Verification boundary

开发证据记录真实 Git、SQLite、认证 MCP/A2A/Runner HTTP 和脚本化 HTTP 模型协议。ControlledBackend 只返回明确的容器事实，不启动实际容器。最终固定 SHA、冻结安装和适用全量回归以单独 report 为准；开发通过不能代替 G0～G4、T05/T23、真实模型或远程身份验收。
