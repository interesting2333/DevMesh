# 官方 MCP 工具边界

采用固定 `@modelcontextprotocol/sdk` 1.32.2（维护分支）、Zod 4 和 Streamable HTTP。Client／McpServer／transport 均来自官方包；不使用自行包装的 JSON RPC 替代协议。参考 [官方 Server 文档](https://ts.sdk.modelcontextprotocol.io/server) 与 [Client 文档](https://ts.sdk.modelcontextprotocol.io/client)。升级 v2 拆包需另行验证，不因 latest 变化自动改栈。

`serveMcp` 仅绑定 loopback 的 `/mcp`，按每个请求校验 Bearer 服务身份、工具 allowlist、Host 与无浏览器 Origin。跨机部署使用 TLS 代理并保留内部路由边界。每个动作调用必需的 `ToolAuthority.authorize`：新动作检查当前准入与许可；查询、停止按原宿主的收尾权限检查。缺少真实 authority 时不能匿名启用；企业 OIDC 暂缺不影响这项内部身份要求。

`McpToolClient.connect()` 经 initialize/listTools 获取协商版本、服务版本、能力及工具 schema，冻结内容哈希。重连签名变化阻塞；不会自动接纳新签名。初始化／目录读取遇到暂时连接故障可重新建立一次，工具调用不在这个重试范围内。HTTP 禁止重定向，限制请求时长与响应体积，错误不透传原始认证信息或主机异常。

| 工具 | 参数 | 后端与边界 |
| --- | --- | --- |
| repo.list | snapshotRef、prefix、limit | 操作员绑定的显式快照清单，有界返回 |
| repo.read | snapshotRef、path | 无链接／硬链接读取，SHA-256 与大小校验，不执行脚本 |
| repo.workspaceRead | workspaceRef、baseCommit、path、offset／length | 真实工作区 UTF-8 源码；整文件 SHA、分页及实际目录屏障 |
| repo.writeFile／deleteFile | workspaceRef、baseCommit、path、expectedSha256、text（仅写入） | 旧内容 CAS、批准范围、持久原操作、同卷原子变更与准确文件身份证明 |
| repo.snapshot／fileByOperation | workspaceRef、baseCommit／operationId | 实际源码清单；原文件操作核实，不重放编辑 |
| repo.diff／commit | workspaceRef、baseCommit、提交消息 | 固定 Git／common directory、批准 Work 写范围、独占工作区、私有 index；真实 Git 对象与原操作 ref |
| repo.integrate／by-operation | workspaceRef、baseCommit、commit／原操作 | 受信任集成审批、项目 CAS 与原操作 ref 原子事务；原事实恢复，不重发写入 |
| tests.start | checkId、workspaceRef | 批准的镜像／命令／限制／输出清单，经真实 RunnerClient 登记 |
| tests.get | jobId | 查询原作业，核实宿主 |
| tests.stop | jobId | 停止原作业，确认请求不代表退出 |
| tests.by-operation | operationId | 原操作查询；不存在或失联不能推断可重做 |
| docs.read／search | documentRef、version、范围／关键词 | 固定来源、SHA、UTF-16 offset 与段落，dataset 许可和 Run 归属 |
| issues.create／linkFix／recordVerification | 来源证据、修订、修复和验证 Attempt | SQLite 原操作／不可变历史；实际 tester 证据才能记录通过 |
| issues.get／by-operation | issueId、修订游标／原操作 | 有界历史；暂停后仍能查询原宿主事实 |
| pipeline.start／get／stop | 批准 definitionId、workspaceRef／pipelineId | 独立 pipeline 与阶段，冻结配置，通过 RunnerClient 执行 |
| pipeline.logs／artifacts／by-operation | pipelineId、阶段、字节游标／原操作 | 原 Runner 日志及成果引用；未知不重新创建 |

repo 显式清单不接受隐藏文件、凭据扩展名或依赖目录；文件发生变化时拒绝读取，不悄悄换用新内容。实际清单的归属与授权仍由 authority 回查。tests 的模型参数不能修改命令 argv、digest、网络、限制或输出路径；这些值来自批准的 `CheckDefinition`。返回 QUEUED、EXITED 或 exitCode 是工具／作业事实，质量验证与候选接受仍由后续业务流程决定。

实际工作区工具按共享源码路径策略允许 `.gitignore` 等批准的模板配置，仍拒绝 `.env`、密钥、链接和依赖目录。写入上限 64 KiB UTF-8／192 KiB JSON；创建传 `expectedSha256:null`，修改／删除传原 SHA。读取整文件至多 2 MiB，每页最多 65536 个 UTF-16 字符。源码清单是当前工作区事实，不等同 Git 提交或归档 ACK。文件变更先落迁移 14 的原操作，在私有 sidecar 保留准备文件身份证明及旧材料；未知未核实、receipt 未收尾时阻止后续编辑／提交。`RepoGitOptions.acquire` 必须使用宿主提供的第三参数关联原操作和当前许可；本地 Runner 适配见 `@devmesh/code-workspaces`，不会按锁超时放行。新增工具须显式写入新角色／连接快照，既有冻结角色不会自动扩权。

`acquire` 在交付 lease 前只管理屏障。它未成功交付时，文件／Git 业务动作尚未开始，原记录进入 FAILED；Runner 的屏障请求仍按自身原操作核实。这样已知的忙碌拒绝不会在原 Job 退出后留下永久待核实业务意图。已进入业务动作后的未知状态继续保留现场和证明。

`runtimeMcpTools(client, contracts)` 比对服务器的输入 schema，返回可注入 AgentRuntime 的工具。模型侧 `repo_read`／`tests_start` 与 MCP 侧 `repo.read`／`tests.start` 为同一工具映射，碰撞拒绝，只计一次能力。[DeepSeek 函数名约束](https://api-docs.deepseek.com/api/create-chat-completion/) 只允许字母、数字、下划线及短横线。模型只看到工具业务参数；稳定 operationId、permit 由执行宿主补齐，连接快照写入冻结配置。结果明确标 source=mcp。

未知 tests.start 仅查询 tests.by-operation；未知 tests.stop 用持久原参数查询 job 的停止意图；不会重发 start。issues 写操作、pipeline.start 和 repo 写操作也分别查询原操作；Git 未准备或没有成功 ref 时保持未知。Runtime 恢复时从已保存的 tool-call 消息取原参数，校验 operationId／工具名／参数哈希后查询。已有 tool-result 消息仍优先修复 ACK。配置结构示例见 `config/mcp.example.json`，其中只有引用，无真实凭据。

`docsTools` 使用操作员绑定的 DocumentBinding；`issueTools` 与 `workflowToolAuthority` 回查持久当前授权，issues 的写命令再在同一事务复核。`pipelineTools` 仅接收批准的 PipelineDefinition，模型不能携带命令、镜像或资源上限；每阶段先落库 SENT 再访问 Runner，恢复只查原 Job／operation，停止请求不等于退出。目前 pipeline 的 workspaceRef 必须对应许可中的同名 workspace 资源；Runner 自身仍执行部署绑定检查。

## 显式部署与生命周期

`startWorkflowMcpServices(storage, content, options)` 按已配置后端启动 repo／docs／tests／issues／pipeline 的独立 loopback 服务和官方 Client。每类分别配置 serviceId、controllerId、credentialRef；三个字段与实际解析到的凭据均不得跨服务复用。身份未配置、凭据不可领取或 schema 变化时启动失败并释放已创建的连接。没有配置的类别不注册，默认 CLI 不自动启用。

身份配置可用 timeoutMs 指定该服务连接／调用时限，Client 默认 10000 ms，允许显式配置 10～120000 ms；时限进入连接快照，Git 管理动作可按实际环境配置。超时仍返回未知并通过原操作恢复。当前已认领 Runtime Host 每五秒在 Worker 事务内复核 ACL／控制代际并续租同一 Grant，到期时间只延长至当前时间后十五秒，保留原生效时间以允许尚未到期的在途许可；暂停、过期、旧 claim 或续租失败会停止新准入。Git 已接受动作在准备提交前读取同一当前 Grant 的原资源子集，不能自行续租或恢复过期许可。发往 Runner 的子许可另行收窄到不超过十五秒区间；流水线按原 Job 的持久序号续租，回复丢失后先查询该 Job 的最新序号，不重新启动阶段。

可通过 `startPlatform(config, { mcp: services => options })` 注入部署配置，平台将组合后的工具交给 Runtime 并管理连接生命周期。也可单独创建后使用返回的 `tools`、`connections`；此时调用方须调用 `close()`。先 `stopAdmission()` 会拒绝新写动作，原作业查询／停止仍经当前成员、原 Host／Grant 与角色授权检查。关闭时停止 pipeline Coordinator、关闭 Client／Server、等待已接受动作收尾；关闭失败明确返回错误。配置只包含资源／凭据引用，不把真实凭据写入持久连接快照。

repo Git 配置必须由工作区分配器提供 root、gitDirectory、commonDirectory、资源归属及 frozen baseCommit，不能接受模型传入目录。`acquire(binding, signal, {operationId, permit, purpose})` 必须在整个动作期间排斥 Runner、编辑器和其他 Git 写入，同时序列化项目集成；只有 Git 命令内部锁不满足该约定。没有该分配器不启用写工具。`authorizeIntegration(binding, commit, signal)` 是另外的受信任业务验收检查；未配置时不注册 repo.integrate，普通 developer 不应获得 projectRepository 写许可。Git 操作成功仅说明仓库事务完成，不自动接受候选或推进 Run。

提交前拒绝不符的 HEAD／Git 仓库身份、配置过滤器、批准范围之外的变化、隐藏或凭据路径、链接、特殊 Git mode，以及超限内容。每次最多 2000 个变化文件、单文件 2 MiB、总大小 8 MiB；diff 最多 64 KiB。使用私有 index、固定作者、持久时间与原操作标识生成确定提交，保存预期 SHA 后写入原操作 ref。集成只接受原宿主已证明提交的固定父 base，通过 Git 多 ref 事务同时更新候选 `refs/devmesh/candidates/<runId>` 和 `refs/devmesh/integrations/<operationId>`；分配器负责初始化候选 ref，项目接受指针由后续业务验收管理。分叉／CAS 失败返回 CONFLICT，由后续受控集成处理。原结果未知时只查 ref 和对象，不能再次创建提交或重复更新候选。

SQLite 增加向前 migrations 10～12，以及 P1-05 工作区迁移 13 之后的文件操作迁移 14，升级前按既有流程备份；不改历史 SQL。回退应用前保留数据库、内容、工作区、文件原操作材料与 Git 原操作 refs，不删除这些恢复依据。部署前仍需完成 P1-05 工作区分配／集成验收和真实模型、Runner 及身份环境验收。

测试包含真实本地 MCP、Runner 管理 HTTP、SQLite 与文件读取，以及 A2A→Runtime→MCP 全链路。模型 HTTP 是明确标识的受控回复，Runner 容器事实是受控后端；没有执行真实模型、Docker/runsc 或生成应用。当前 P0-08 正式状态受前置验收约束，真实长任务与 T04/T05 保留待环境具备后验证。
