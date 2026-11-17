## Why

当前模型接入只能改服务器配置文件；工作台没有入口，也没有“测试连接”。用户要求左侧边栏底部“更多”里增加“设置”，可配置模型接入，并把规则同步到设计／实施文档。父工作包 P0-06；正式状态不变。

## What Changes

- 侧边栏底部新增“更多”菜单，内含“设置”。
- 设置弹窗支持 Provider、Endpoint、模型 ID、API Key：保存、测试连接、显示是否已配置。
- 后端新增本机模型设置存储与 API；API Key 只写本机文件（0600），不回显、不进数据库、不写日志。
- 保存后提示“重启服务生效”；预览启动器读取保存的模型设置并尝试接入 Runtime（失败则保持无模型运行并记录）。
- 同步 `design/02`、`design/03`、实施文档、变更规范与基线。
- 模型 ID 支持从接入服务实际返回的列表中选择、刷新或手动输入；模型列表请求允许使用未保存的 Endpoint / Key，不自动保存，也不改变当前运行时。

## Capabilities

### New Capabilities

- `model-settings`: 本机模型接入设置、密钥保护与连接测试。

### Modified Capabilities

工作台新增设置入口；Runtime 启动读取本机设置。

## Impact

影响 `packages/input-api`、`packages/platform-core`、`scripts/dev-preview.mjs`、文档与测试。正式 P0-06、G0～G4 不变。
