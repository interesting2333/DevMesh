## Why

父工作包 P0-09。现有仓库有 Runtime、A2A、MCP 与 Runner 管理边界，尚没有可独立复制的应用模板及业务数据／检查契约。需要把“任务看板能够构建、保存、测试和停止”落实为固定源码与可核实材料，不能用工具 ACK 代替应用验收。

## What Changes

- 新增独立 `templates/web-crud-v1`：TypeScript／React／Vite 前端、Node／Express／SQLite 后端、独立 dataset 路径。
- 提供任务新增、编辑、状态变更、删除、加载／错误反馈与刷新、重启后数据保留；API 使用有界输入、版本条件和幂等键。
- 提供精确依赖与独立锁文件、构建／类型／单测／覆盖／Playwright 配置、模板能力清单和 Runner 批准检查映射。
- 用户暂无 Docker/gVisor，先完成固定模板源码和可独立进行的校验；实际镜像 digest、runsc 安装／构建／停止专项保持待执行，不填占位 digest 冒充产物。

## Capabilities

### New Capabilities

- `web-crud-template`: 可复制的前后端任务应用、独立业务数据持久化及固定检查契约。

### Modified Capabilities

无。

## Impact

新增模板目录、模板验证入口、测试与文档，不修改控制面业务数据库。依据 P0-09、design/04 §1–2、§6–8 与模板能力边界。沿用 deepseek-harness 的 TypeScript／Node／React／Vite／Vitest 方向，实际版本安装后锁定。正式工作包保持 NOT_STARTED，前置验收及 G0 不提前通过；模板开发测试不能充当用户生成应用的隔离验收。
