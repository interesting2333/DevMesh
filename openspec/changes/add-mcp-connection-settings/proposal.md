## Why

DevMesh 的五类内置 MCP 使用部署代码显式装配。管理员需要在工作台手工添加标准第三方 MCP 连接。父工作包 P1-04，按扩展功能记录。

## What Changes

- 增加 MCP 设置、连接测试、工具选择，以及独立于编辑表单的列表启停开关。已启用连接在启动时加载。
- 在本机预览手工添加和管理 Playwright MCP，支持编辑浏览器配置和即时启停。开发验收通过任务看板脚本执行。
- 使用 GitHub 与 Context7 作为首批只读接入候选，调用进入现有 A2A 工作流。
- GitHub、Context7 账号联调使用各自实际凭据并单独记录证据。

## Capabilities

### New Capabilities

- `mcp-connection-settings`: 本机管理标准 MCP 连接并授权工作流使用。

## Impact

涉及 Input API、工作台、平台启动、AgentRuntime、MCP SDK 客户端和部署文档。P1-04 产品验收沿用既有的五类服务验收场景。
