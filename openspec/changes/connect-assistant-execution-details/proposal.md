## Why
父工作包 P1-08。助手任务已生成成果，但详情五页签仅按项目／Run读取，错误显示尚无执行。用户已授权补齐当前任务详情。
## What Changes
- 新增鉴权的助手执行只读投影，从持久会话、模型步骤、工具与应用日记读取真实事实。
- 概览、协作、成果、预览、记录按实际执行来源展示；明确单助手与历史输入轮次。
- 复用已有受保护预览和准确字节下载；原专业执行视图保留。
## Capabilities
### New Capabilities
- assistant-execution-details
### Modified Capabilities
## Impact
contracts、storage-sqlite只读查询、input-api与桌面验证。无迁移、无自动重跑，不改变原执行／应用授权。
