# P1-08 集成回归记录（4.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-workbench-first-path`（父工作包 P1-08）
- 任务：4.1 在实际文件 Worker／HTTP／浏览器贯通空项目输入及已有交付页面链，执行适用回归、构建、类型、Lint、契约，保存真实日志与夹具边界
- 结论：适用回归、构建、类型、Lint、契约均实际执行并通过；仓库全量 `pnpm check` 在进入验收组后因宿主 100% 负载（单个验收场景 5～6 分钟）主动终止，终止前 **224 个顶层 TAP 用例通过、0 失败**；浏览器侧补跑空项目输入、事件连续性与交付导航，8 项通过。4.1 据此记录，但**不宣称完整 `pnpm check` 全绿**，验收组与完整浏览器矩阵留给 5.2 和阶段门槛复核

## 环境与边界

| 项目 | 值 |
| --- | --- |
| 操作系统 | Windows（本机） |
| Node | v24.13.1 |
| 浏览器 | Edge 157.0.4341.42，headless，Playwright 1.65.0 |
| 宿主状态 | 其他应用占用导致 CPU 长期 100%，验收类测试明显变慢 |
| 承载 | 受保护 React/CSP、原生 IndexedDB、原生 WebSocket、文件 SQLite Worker、Input API HTTP 宿主 |
| 夹具 | 可信身份 resolver、模型输出、Runner/容器、OCI 与人工观察为明确夹具；未执行真实 OIDC、模型、Linux/gVisor 或产品验收 |

## 命令与结果

### 1. 仓库全量检查（终止前）

```powershell
corepack pnpm@11.28.5 check
```

- 日志：[01-full-check.txt](./development/event-continuity/01-full-check.txt)
- 执行顺序与结果：`toolchain:check`、`vendor:verify`、`build`、`typecheck`、`lint` 通过（`Found 0 warnings and 0 errors.`），随后 smoke/contracts/storage/content/a2a/runtime/runner/mcp/workspaces/input/events/preparation/scheduler/verification 及部分 acceptance 实际运行。
- 统计：顶层 TAP `ok` 224 条，`not ok` 0 条，`# fail [1-9]` 0 条。
- 终止原因：进入 acceptance 后单个场景耗时 5～6 分钟（如 `ARM_FENCES` 约 324 s、`GUARD_ENFORCE` 约 371 s），继续执行将长时间占用宿主；本次未等到 `contracts:check` 与 `project:check` 阶段，因此不把这次调用写成完整通过。

### 2. 构建

```powershell
corepack pnpm@11.28.5 build
```

- 日志：[02-build.txt](./development/event-continuity/02-build.txt)
- 结果：全部 workspace 包与实际服务端产物构建完成，退出码 0。

### 3. 契约

```powershell
corepack pnpm@11.28.5 contracts:check
```

- 日志：[05-contracts.txt](./development/event-continuity/05-contracts.txt)
- 结果：`OpenAPI matches the executable contracts`，退出码 0。

### 4. 浏览器实测（本轮新跑）

| 范围 | 命令/文件 | 结果 |
| --- | --- | --- |
| 空项目输入、键盘、窄屏 | `tests/browser/workbench-page.test.mjs`（3.3 定向用例） | 1/1 通过 |
| 事件期间焦点/选择 | `tests/browser/workbench-live.test.mjs` | 6/6 通过 |
| 候选审查/预览/接受/交付返回 | `tests/browser/workbench-delivery.test.mjs`（首个用例） | 1/1 通过 |

- 日志：[07-browser-core.txt](./development/event-continuity/07-browser-core.txt)
- 另曾尝试完整 13 文件 workbench 浏览器矩阵，受宿主负载影响单个用例约 5 分钟，已终止；部分日志保留在 [07-browser-workbench.txt](./development/event-continuity/07-browser-workbench.txt)，**不计为通过**。
- 其余浏览器子链（回答、附件、上传、移除、任务页等）的既有真实 Edge 记录见各增量 review 与 P1-08 台账，本轮未重复执行。

## 与 4.2/4.3 的边界

- 4.2 的设计专题、验收、实施文档、基线、OpenSpec 与台账同步尚未在本轮完成。
- 4.3 的真实模型／企业身份／Linux 后完整路径一与 T08 仍因资源缺失未执行。
- P1-08 在 `project/tasks.json` 中仍为 `NOT_STARTED`，G0～G4 仍为 `PENDING`；本记录只覆盖 4.1 的实际执行事实。
