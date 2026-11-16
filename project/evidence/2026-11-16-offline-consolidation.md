# 离线实施最终一致性检查（2026-11-16）

## 范围

本轮整理当前所有已创建 OpenSpec 变更的离线可验证部分；不执行真实模型、OIDC、Linux Runner／Docker／gVisor 或人工产品验收。

## 回归结果

| 套件 | 结果 | 日志 |
| --- | --- | --- |
| 控制、变更、配置、Invocation、内容 pin、恢复、重做、存储、契约（16 个文件） | **63/63 通过** | [offline-consolidation.txt](./offline-consolidation.txt) |
| workbench-live 全量（含暂停／恢复与断线重连） | **8/8 通过** | [workbench-live-final.txt](./workbench-live-final.txt) |
| 迁移升级／回滚与再确认（0044→当前版本） | 7/7（本轮前执行） | P2 各记录 |
| OpenSpec 严格校验 | 25/25 | — |
| 台账 `manage check` | 通过 | — |
| `contracts:check`、全量 `typecheck` | 通过 | — |

## 变更进度

| 变更 | 任务 |
| --- | --- |
| implement-run-control-lifecycle | 8/8 |
| implement-crash-recovery-scan | 5/5 |
| implement-partial-change-control | 5/5 |
| implement-safe-retry-redo | 4/4 |
| implement-config-adjustment | 4/4 |
| implement-invocation-host | 4/4 |
| implement-content-maintenance | 4/4 |
| implement-control-interaction | 3/3 |
| implement-five-mcp-services、managed-code-workspaces、plan-scheduler、result-verification 等既有变更 | 已全部勾选 |
| implement-preview-review-and-acceptance | 10/13 |
| implement-workbench-first-path | 12/13 |
| 其余 P0/P1 变更 | 仅剩真实资源相关任务 |

## 明确未实现／未执行

**已有变更中的资源阻塞任务**：P0-06 3.2/3.3、P0-07 3.2、P0-08 3.2、P0-09 3.2、P1-01 3.2、P1-02 3.3、P1-07 2.3/4.1/4.3、P1-08 4.3。

**P2 增量中明确记录为缺口的能力**：

- P2-04：attempt 级 `RetryWork`、独立预算桶、材料复用矩阵、T4／T10。
- P2-06：公共 Task／Inbox、主体配额、真实取消核实、T7／T20／T21。
- P2-07：GC 计划／提交／删除、归档 ACK、分块日志、容量限制、T22／T23；当前无删除路径。
- P2-08：取消（缺 impactReviewHash）、配置调整面板、变更队列 UI、控制多页竞争、完整 E2E／T08／路径五。

**未创建变更的工作包**：P3-01～P3-06、P4-01～P4-04。它们依赖真实外部 Agent、企业身份、Linux／容器环境或人工验收，当前不具备条件。

## 门槛

G0～G4 全部 `PENDING`；36 个工作包中 6 个 `DONE`、1 个 `IN_PROGRESS`、29 个 `NOT_STARTED`。本记录不改变门槛，也不把开发增量当成工作包完成。
