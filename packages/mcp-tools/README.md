# 官方 MCP 工具边界

采用固定 `@modelcontextprotocol/sdk` 1.32.2（维护分支）、Zod 4 和 Streamable HTTP。Client／McpServer／transport 均来自官方包；不使用自行包装的 JSON RPC 替代协议。参考 [官方 Server 文档](https://ts.sdk.modelcontextprotocol.io/server) 与 [Client 文档](https://ts.sdk.modelcontextprotocol.io/client)。升级 v2 拆包需另行验证，不因 latest 变化自动改栈。

`serveMcp` 仅绑定 loopback 的 `/mcp`，按每个请求校验 Bearer 服务身份、工具 allowlist、Host 与无浏览器 Origin。跨机部署使用 TLS 代理并保留内部路由边界。每个动作调用必需的 `ToolAuthority.authorize`：新动作检查当前准入与许可；查询、停止按原宿主的收尾权限检查。缺少真实 authority 时不能匿名启用；企业 OIDC 暂缺不影响这项内部身份要求。

`McpToolClient.connect()` 经 initialize/listTools 获取协商版本、服务版本、能力及工具 schema，冻结内容哈希。重连签名变化阻塞；不会自动接纳新签名。初始化／目录读取遇到暂时连接故障可重新建立一次，工具调用不在这个重试范围内。HTTP 禁止重定向，限制请求时长与响应体积，错误不透传原始认证信息或主机异常。

| 工具 | 参数 | 后端与边界 |
| --- | --- | --- |
| repo.list | snapshotRef、prefix、limit | 操作员绑定的显式快照清单，有界返回 |
| repo.read | snapshotRef、path | 无链接／硬链接读取，SHA-256 与大小校验，不执行脚本 |
| tests.start | checkId、workspaceRef | 批准的镜像／命令／限制／输出清单，经真实 RunnerClient 登记 |
| tests.get | jobId | 查询原作业，核实宿主 |
| tests.stop | jobId | 停止原作业，确认请求不代表退出 |
| tests.by-operation | operationId | 原操作查询；不存在或失联不能推断可重做 |

repo 显式清单不接受隐藏文件、凭据扩展名或依赖目录；文件发生变化时拒绝读取，不悄悄换用新内容。实际清单的归属与授权仍由 authority 回查。tests 的模型参数不能修改命令 argv、digest、网络、限制或输出路径；这些值来自批准的 `CheckDefinition`。返回 QUEUED、EXITED 或 exitCode 是工具／作业事实，质量验证与候选接受仍由后续业务流程决定。

`runtimeMcpTools(client, contracts)` 比对服务器的输入 schema，返回可注入 AgentRuntime 的工具。模型侧 `repo_read`／`tests_start` 与 MCP 侧 `repo.read`／`tests.start` 为同一工具映射，碰撞拒绝，只计一次能力。[DeepSeek 函数名约束](https://api-docs.deepseek.com/api/create-chat-completion/) 只允许字母、数字、下划线及短横线。模型只看到工具业务参数；稳定 operationId、permit 由执行宿主补齐，连接快照写入冻结配置。结果明确标 source=mcp。

未知 tests.start 仅查询 tests.by-operation；未知 tests.stop 用持久原参数查询 job 的停止意图；不会重发 start。Runtime 恢复时从已保存的 tool-call 消息取原参数，校验 operationId／工具名／参数哈希后查询。已有 tool-result 消息仍优先修复 ACK。`startPlatform` 的 `runtimeTools` 注入项允许组合这些连接；连接生命周期由创建者管理。生产配置、Registry 服务授权的完整组合由 P1-04 接续，默认 CLI 不打开 MCP 连接。配置结构示例见 `config/mcp.example.json`，其中只有引用，无真实凭据。

测试包含真实本地 MCP、Runner 管理 HTTP、SQLite 与文件读取，以及 A2A→Runtime→MCP 全链路。模型 HTTP 是明确标识的受控回复，Runner 容器事实是受控后端；没有执行真实模型、Docker/runsc 或生成应用。当前 P0-08 正式状态受前置验收约束，真实长任务与 T04/T05 保留待环境具备后验证。
