# P1-04 固定提交全量回归记录（4.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-five-mcp-services`（父工作包 P1-04）
- 任务：4.1 完成固定提交全量回归、部署文档及父工作包台账，记录五类实际动作和仍待真实模型／Linux Runner 的验收项
- 结论：在固定提交 `bde6f61` 上取得可复核的适用全量回归证据；一次 `pnpm check` 在 runner 组遇到负载型传输超时，已原样保留并单独复跑通过，其余套件由同源码的 `9c6fce0` 全量运行覆盖。**不宣称一次不间断的 `pnpm check` 全绿**，也不替代真实模型／Linux Runner 验收

## 环境

| 项目 | 值 |
| --- | --- |
| 操作系统 | Windows（本机） |
| Node | v24.13.1 |
| 固定提交 | `bde6f61`（后续仅文档／台账变化） |
| 宿主状态 | 其他应用长期占用 CPU，验收类测试明显变慢 |
| 边界 | 模型 HTTP、Runner 容器事实为受控夹具；未执行真实模型、Docker/runsc、企业身份或产品验收 |

## 运行与结果

### 1. 全量检查（首次，`9c6fce0`）

- 命令：`corepack pnpm@11.28.5 check`
- 日志：[full-check-9c6fce0.txt](./full-check-9c6fce0.txt)
- 结果：613 个顶层 TAP 用例通过、1 个失败；失败为 `verification-preview-access` 的触发器顺序假设（迁移 0043 的未决写屏障先于不可变触发器触发）。该测试已在 `bde6f61` 修正并单独验证 19/19 通过。

### 2. 全量检查（复跑，`bde6f61`）

- 命令：`corepack pnpm@11.28.5 check`
- 日志：[full-check-bde6f61.txt](./full-check-bde6f61.txt)
- 结果：toolchain／vendor／build／typecheck／lint 通过；测试到 runner 组时 `121 tests / 118 pass / 2 fail / 1 skip`，失败为 `runner-release-service.test.mjs` 的 `GUARD_ENFORCE` 子项 `RUNNER_TRANSPORT_UNKNOWN`（RunnerClient 默认 10 秒传输超时，宿主满载下超时），同提交单独复跑该文件 **13/13 通过**。之后套件因 `&&` 链中止。

### 3. 固定提交补充套件（`bde6f61`）

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `corepack pnpm@11.28.5 test:mcp` | 35/35 通过，0 失败 | [test-mcp.txt](./test-mcp.txt) |
| `corepack pnpm@11.28.5 test:verification` | 187/187 通过，0 失败 | [test-verification.txt](./test-verification.txt) |
| `corepack pnpm@11.28.5 contracts:check` | `OpenAPI matches the executable contracts` | [contracts-check.txt](./contracts-check.txt) |
| `node project/manage.mjs check` | 台账检查通过 | [project-check.txt](./project-check.txt) |

其余套件（smoke／contracts／storage／content／a2a／runtime／workspaces／input／events／preparation／scheduler／acceptance）在 `9c6fce0` 的同一源码上运行并通过；`bde6f61` 相对该提交只修改了 `tests/verification-preview-access.test.mjs`，不影响这些套件的判定。

## 五类服务与部署文档

- 五类：`repo`、`docs`、`tests`、`issues`、`pipeline`，各自独立 serviceId／controllerId／credentialRef，未配置不注册。
- 部署与生命周期文档：[packages/mcp-tools/README.md](../../../packages/mcp-tools/README.md) 的“显式部署与生命周期”，含 `startWorkflowMcpServices`、`startPlatform({mcp})`、Grant 续租、停机排空与关闭语义、repo Git 分配器与迁移 10～14 说明。
- 关联部署说明：[packages/result-verifier/EXPORTS.md](../../../packages/result-verifier/EXPORTS.md)、[packages/preview-gateway/RELEASE.md](../../../packages/preview-gateway/RELEASE.md)。

## 未执行与边界

- 真实模型、企业身份、Linux Runner/gVisor、真实长任务与 T04/T05：资源缺失，保持未执行。
- 一次不间断的 `pnpm check` 全绿未取得；已记录真实失败、复跑与补充套件，不把负载型超时写成产品失败，也不把补充套件拼成“单次全绿”。
- 正式 P1-04／G0 状态不变。
