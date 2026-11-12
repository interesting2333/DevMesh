# Managed code workspaces（实施中）

本包提供显式 `local-development` 后端。默认平台与 CLI 尚未启用它；构造服务必须提供实际目录边界及 fencing。控制面、Runner、备份根目录分开，跨节点不共享可写 `.git`。

## 实现与验证状态

| 组件 | 行为 | 当前证据 |
| --- | --- | --- |
| `ControlledGit` | 固定 argv／环境、物理目录身份、有界源码清单和 pack、固定 checkout、多 ref CAS、三方合并及全部最佳祖先 | 真实 Git／交叉历史用例通过；`development/integration-v1` |
| `LocalManagedWorkspaces` | 原操作先落库，独立项目仓库和 Attempt checkout；未知目录不接管、READY 目录丢失不重建 | 迁移 13 与分配开发验证通过；最终全量待复核 |
| `LocalRunnerWorkspaceFencer`／`createLocalRepoAcquire` | 组合进程文件锁、Runner 持久屏障、当前许可或独立 cleanup 权威；活动／未知 Job 排斥写入 | 实际 Runner 管理、MCP 文件／Git 联调通过；`development/fence-refresh-v1` |
| `LocalSourceArchives` | 核实原分配／repo.commit、父起点、范围和内容；传输并保留原操作／源码 refs 后提交 ACK | 实际分离仓库归档 4/4；`development/source-v2` |
| `LocalCandidateIntegrations` | 按当前来源顺序合并、固定双父提交、一次发送、多 ref CAS；保留原操作并核实丢失 ACK | 实际 A2A／Scheduler／Host／Git 来源联调 4/4；`development/git-service-v2` |
| `LocalCandidateConflicts`、Work 专属输入快照及验证分配组合 | 原报告及虚拟基点字节、原子内容引用、文件／目录／缺失版本、精确依赖快照准入 | 固定提交 051475c 的 21 项全量检查通过，工作区 49/49，包含真实冲突恢复、三方材料与固定验证输入；详见 m17-m19-review.md |
| `LocalWorkspacePreservations` | 未提交／未跟踪／忽略／恢复材料、全部已知源码及 base 保留、原子内容引用、完整 ACK 与独立 Runner receipt、回收前检查 | 已通过材料扫描 8/8、保存存储 4/4 和真实 Git 5/5 的开发验证；检查复用及原始报告见 preservation-v4，实际 Runner 组合及工作包验收另行验证 |
| `LocalWorkspaceReclamations` | 原目录隔离至唯一 Runner trash、独立隔离／删除意图与 receipt、部分删除核实及原 ACK 恢复 | 回收存储 2/2、残余校验 8/8、真实 Git 隔离／部分删除恢复 6/6、存储回归 28/28 通过，见 reclamation-v2；真实 Runner 维护组合仍待验证 |

证据目录以仓库根 `project/evidence/P1-05/` 为准。任务状态以 OpenSpec 和项目台账为准；局部通过不等于完整 P1-05、T05/T23 或产品验收。

固定提交 `c9c1474` 的干净 Windows 全量回归有两条工作区用例失败，见 `project/evidence/P1-04/windows-c9c1474-incomplete/`。模块加载后的当前许可交付、长 Git 准备后的 Registry 刷新修复在独立测试文件专项通过 2/2，见 `development/workspace-fixture-repair-v1`；修复后的固定提交 051475c 已完成 21 项全量回归，工作区 49/49；原报告保存在 P1-04/windows-051475c。该提交不含后续迁移 18/19，此前失败证据继续保留。

## 目录与固定输入

- 项目仓库：`<controlDataRoot>/repositories/<projectId>/repo.git`。
- 独立 checkout：`<runnerDataRoot>/workspaces/<attemptId>/repo`。
- 文件操作恢复材料：Attempt 父目录中的 `.devmesh-file-operations/`；源码 ACK 不包含这些材料。
- 冲突报告／文件：现有内容存储 `artifacts/sha256/<前两位>/<哈希>`，暂存使用 `staging/objects/`。
- 完整保存材料及清单：沿用上述内容存储，以原保存 operation 与材料键建立独立业务引用。
- 隔离目录：`<runnerDataRoot>/trash/<reclamationOperationId>`，只允许原操作及原物理目录；默认额外保留 24 小时。
- Runner 回收 receipt：`<runnerDataRoot>/registry/workspace-reclamations/<workspaceRef>/<operationId>/<phase>.json`。
- Runner 完整保存 receipt：`<runnerDataRoot>/registry/workspace-preservations/<workspaceRef>/<operationId>/receipt.json`，位于待回收 Attempt 之外。

`ControlledGit` 每次动作核实 root、Git/common directory 及设备／文件 ID。源码只允许批准的普通文件，拒绝链接、敏感路径、外部 filter／merge helper、alternates 和越界大小；源码清单最多 192 KiB。传输使用受控 pack，目的仓库重新验证 commit、tree、大小和 SHA-256。固定 `core.fsync=all`、`core.fsyncMethod=fsync`；软件检查没有验证底层存储掉电行为。

验证分配使用已准入的准确 SHA 及源码清单，目录与 Developer 分开。当前改动验证输入提交固定和目录隔离；质量执行、报告解释及候选接受属于 P1-06 的独立流程。

## 当前来源与原操作恢复

Worker 从已确认计划、当前 Run／Work 代际、最新核实结果、输入成果和原源码 ACK 推导来源。`work-input` 只取目标 Work 的依赖闭包；`run-candidate` 取当前全部开发来源。非空接口快照尚无批准来源查询时明确拒绝，不把调用方 SHA 或历史 ACK 当作当前资格。

每步先持久记录计算意图，再冻结三方结果及确定提交正文，标记发送后只核实原 ref。最终事务同时保留 integration／snapshot refs，只有 Run 候选更新 Run ref；它们都不修改接受指针。原事务的唯一 refs 可用于核实暂停或后续全局 ref 移动前的结果。结果未知时禁止重放 Git 动作或换 operation ID。

冲突适配代码在冻结步骤前保存原报告和虚拟 stage 1 字节；恢复只用原内容对象或经哈希验证的 staging。材料路径取 Git 消息与 stage 的并集，目录保留 tree 身份，缺失显式记录；内容登记与业务外键引用在同一 Worker 事务提交。完整材料 READY 前不能确认冲突 ACK，也不推进候选。首次验证的取消收尾失败保存在 `development/materials-v1-failed/`；修复夹具后，固定提交 051475c 的真实冲突恢复与完整材料检查已通过。

## 显式组合

在配置了对应本地 Runner、根目录、内容存储和实际 fencing 的受信任服务中组合：

```ts
const conflicts = new LocalCandidateConflicts(storage, content);
const integrations = new LocalCandidateIntegrations({
  mode: 'local-development', storage,
  controlDataRoot, runnerDataRoot, backupRoot, fencer, conflicts,
});

// 传给 WorkflowScheduler 的受信任选项；planResources 保持只读。
const prepareCodeBasis = (candidate, signal) => integrations.prepareWorkInput({
  principalId: candidate.principalId,
  runId: candidate.runId,
  workId: candidate.work.workId,
}, signal);
```

快照准备核实受控仓库身份、原 refs 和实际清单，I/O 后再复核来源；调度准入事务最终只接受与当前依赖匹配的 Work 快照。缺失快照时保持排队，不替换成全局最新候选。稳定原操作 ID 防止调度 tick／进程重启绕过未知结果；已知失败需显式受信任重试。

以上服务未自动接入默认应用启动流程。真实远程身份、跨节点执行代理、模型、Linux/runsc 及完整材料生命周期仍按各自验收范围推进；当前本地测试夹具的质量决策及无 Job fencer 不代表这些能力通过。
