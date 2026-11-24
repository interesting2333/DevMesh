## Why
用户确认主助手执行闭环方案并授权实施；另明确选择 Docker 开发容器模式。父 P1-08，涉及 P0-02／P0-04／P0-06／P0-07／P1-03。既有其他 UE 变更保留，正式工作包和门槛独立维护。
## What Changes
- 主助手按任务选择问答、项目分析、直接修改和完整研发；增加有界持久工具循环。
- 工作空间代码快照、搜索读取、CAS 修改、差异、检查与明确应用；保持已有未提交内容。
- 显式 Docker 开发容器执行批准的构建／测试，区别于生产 Linux/gVisor Runner，不降级现有 Runner 校验。
- 展示真实能力、操作和检查结果，支持原请求恢复与模式／权限保护。
## Capabilities
### New Capabilities
- assistant-project-execution: 主助手项目工具与持久执行。
### Modified Capabilities
## Impact
契约、迁移59、执行会话／工具日记、代码工作区、Docker开发执行适配、启动入口、受保护API与桌面结果卡。用户选择的 Docker 开发环境不构成生产隔离验收。
