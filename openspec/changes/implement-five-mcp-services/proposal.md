## Why

父工作包 P1-04（关联 P0-08）。现有官方 MCP Client／Server、只读 repo 与 tests 已能走真实 HTTP，但缺授权附件检索、缺陷持久记录、仓库写动作和独立流水线。没有这些后端，不能将五个服务名称视为真实能力。

## What Changes

- 增加 docs 固定附件版本检索和原文定位，拒绝越权、漂移和越界读取。
- 增加 issues SQLite 领域命令、修订历史、原键查询和 MCP 工具。
- 增加 repo 受控工作区读取、文件写入／删除、差异／源码清单及 Git 提交／集成接口，绑定指定工作区与 baseCommit；文件修改使用旧内容 CAS、持久原操作和可核实落盘证明，未知先核实；与 P1-05 的工作区及串行集成规则协作。
- 增加独立 pipeline 及阶段记录，冻结批准配置并通过 Runner 执行安装／检查／构建；默认不开放生产部署。
- 显式组合五个独立服务身份与连接快照，服务端复核当前许可／角色工具／项目 ACL；原操作恢复不重发未知写动作。
- 按既有十五秒租约／五秒续租设计补齐当前认领 Host 的 Runtime 续租，Git 写入在副作用前复核同一当前授权；不恢复已过期、暂停或旧 claim。

## Capabilities

### New Capabilities

- `five-mcp-services`: 五类工具的实际动作、授权、独立身份、版本与持久恢复边界。

### Modified Capabilities

无；已归档主规格的行为不由本变更提前宣布完成。

## Impact

涉及 packages/mcp-tools、storage-sqlite、blob-store、platform-core、Runner／Git 组合、测试、台账及部署文档。增加向前 SQLite 迁移，不改历史迁移。依据 D2 §6、实施 P1-04 与 T04、R01/R02；Linux Runner、企业身份和真实模型暂缺，相关验收保持未执行。
