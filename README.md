# DevMesh

DevMesh 是一个以 A2A 协作、MCP 工具调用和独立 Runner 为基础的多 Agent 研发平台。本仓库已建立 P0-01 最小工程与 HTTP 宿主，业务能力按 P0～P4 分阶段建设，实际进度以任务台账为准。

## 从哪里开始

| 目的 | 入口 |
| --- | --- |
| 查看进度、依赖和下一项工作 | [项目任务台账](./project/任务台账.md) |
| 了解日常管理和 OpenSpec 流程 | [项目管理说明](./project/README.md) |
| 产品目标和验收范围 | [PRD V10.0](./DevMesh_PRD_V10.0.md)、[89 条验收场景](./DevMesh_产品验收场景_V10.0.md) |
| 完整技术方案与选型 | [技术设计 V1.1](./DevMesh_技术设计方案_V1.1.md) |
| 36 个工作包、交付物、验收和阶段门槛 | [实施文档 V1.0](./DevMesh_实施文档_V1.0.md) |
| 第一个待实施的 OpenSpec 变更 | [P0-01 工程基础](./openspec/changes/bootstrap-devmesh-workspace/proposal.md) |
| 全部文档与原型 | [交付说明](./交付说明.md) |
| 运行、构建、配置、测试与 CI | [工程说明](./docs/engineering.md) |

## 本机使用

在仓库根目录执行；克隆后的首次使用先安装隔离的管理工具依赖：

```powershell
npm ci --prefix tools/openspec
node project/manage.mjs status
node project/manage.mjs next
node project/openspec.mjs list
```

P0-01 已进入实施，当前状态、提交和证据统一查任务台账。后续可以向协作 Agent 指定工作包及已有 OpenSpec 变更，认领时填写真实负责人；完成后记录提交版本、验证环境和证据，再进入复核。

应用使用固定 Node 24.13.1。首次安装与启动：

```powershell
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
corepack pnpm@11.28.5 start
```

服务默认监听 `127.0.0.1:3210`；`/healthz`、`/readyz` 只描述基础 HTTP 插件。配置、关闭和双平台验证见工程说明。

## 提交前检查

```powershell
node project/manage.mjs check
node project/openspec.mjs validate --all --strict --no-interactive
node design/生成完整方案.mjs --check
```

OpenSpec CLI 固定为 1.12.0，工具包与应用工程隔离。工具依赖的 npm 锁文件仅服务于管理 CLI；应用工程继续按实施文档建设 pnpm workspace，并验证、锁定所选技术版本。

Git 保存所有文档与管理记录。任务状态以 `project/tasks.json` 为准，OpenSpec `tasks.md` 保存变更内部的步骤；当前设计目标仍以 PRD、技术设计和实施文档为准。
