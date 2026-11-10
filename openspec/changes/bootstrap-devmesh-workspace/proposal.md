## Why

父工作包：**P0-01**。设计、实施计划和项目管理工具已建立，但仓库尚无 DevMesh 应用 workspace、Cordis 组合根和构建检查，后续契约、存储、A2A/MCP 模块缺少可复现的工程基础。

本变更落实[实施文档 §2、§4.1 P0-01](../../../DevMesh_实施文档_V1.0.md)及[技术设计 §5](../../../DevMesh_技术设计方案_V1.1.md)的工程准备范围，为 P0-02 开工提供真实产物和 T01 基础证据。

## What Changes

- 在本仓库创建独立 pnpm workspace 和最小应用组合根，按技术设计划分 apps／packages。
- 按技术基线验证并冻结 Node 24 补丁、pnpm 11.28.5、TS 6.0.x、构建与静态检查工具的实际版本。
- 从参考工程核对 Cordis 受控闭包、peers、来源、许可证与必要改动，形成能够在独立目录安装的依赖方案。
- 提供可实际执行的 build／typecheck／lint，以及最小组合根启动检查；CI 覆盖 Windows、Linux 的干净安装与构建。
- 保留现有设计、管理工具和原型资料，形成来源／版本清单与 T01 执行记录，更新父工作包台账。

本次变更只定义 P0-01 的实施计划；尚未执行上述应用工程工作。A2A/MCP 业务、数据库迁移、Agent 执行和 Runner 隔离由后续工作包实现。

## Capabilities

### New Capabilities

无。本变更为内部工程工具链建设，不新增产品行为；`.openspec.yaml` 已设置 `skip_specs: true`。

### Modified Capabilities

无。`openspec/specs/` 当前没有已归档的应用能力，本次不创建占位规范。

## Impact

- 预计新增根工程配置、`apps/`、`packages/`、CI 配置和工程说明。具体首批包见 design，避免创建空实现冒充能力完成。
- 会引入应用自己的 pnpm 锁文件；`tools/openspec/package-lock.json` 继续只用于隔离的项目管理 CLI。
- 参考目录 `D:\yms\AI\deepseek-harness` 只读，不共享 node_modules，不从应用运行路径引用参考仓库。
- 不改变业务 API、数据库 schema、会话布局或公开 Agent 服务；不得因组合根可启动而标记 P0-03～P0-10 完成。
- 版本兼容或来源分发若与设计冲突，记录具体证据并同步设计、变更与受影响台账，不静默替换技术栈。
