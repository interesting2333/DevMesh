## Why
父工作包 P1-08。未绑定目录的新建HTML走旧准备队列，缺少匹配角色而无限等待；新对话缺少真实流式消费。用户已批准修复、恢复当前任务并完成生成／预览／下载闭环。
## What Changes
- 独立生成工作区与HTML检查、隔离预览／下载及后续迭代。
- 会话真实流式输出、工具进展与准确阻塞。
- 旧未执行任务按原请求逐条恢复；保留原记录和模式边界。
## Capabilities
### New Capabilities
- generated-site-execution
### Modified Capabilities
## Impact
contracts、agent-runtime、code-workspaces、input-api、platform-core、SQLite60与桌面；正式专业Runner与阶段门槛不变。
