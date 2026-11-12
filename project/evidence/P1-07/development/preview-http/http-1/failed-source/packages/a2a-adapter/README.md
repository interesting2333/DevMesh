# Internal A2A and Registry

P0-05 提供四角色内部持久受理基础：标准 HTTP JSON-RPC/SSE、可查询 Task、持久 Inbox／AcceptedWork，以及部署清单 → 已提交 SQLite → 内存 Registry 的单向生效。

使用官方 [A2A JS SDK](https://github.com/a2aproject/a2a-js) **1.3.0**、A2A **1.0**、Express **5.2.1**。SDK npm integrity 为 `sha512-OpK4nygUnLKlpTFZlM2IrYu7f3c/B7c4u4Z14+vgMq24lEINTVCxH/BqZx+GL92rNf7CoBL5oTP5UhNsl75yyg==`，依赖闭包锁在根 pnpm-lock.yaml。仅启用 JSON-RPC/SSE；没有开启 v0.3 兼容、gRPC、HTTP+JSON、推送或任意模型注册 URL。

## 启用与身份

先按 [内容存储说明](../blob-store/README.md) 显式初始化；服务配置示例为 [server.a2a.example.json](../../config/server.a2a.example.json)，唯一清单为 [agents.example.json](../../config/agents.example.json)。固定监听地址必须与清单的本地 URL 一致，示例使用 loopback:3210。调整 URL 必须重新生成／核对完整 Card hash，并发布新的 endpoint revision 和 manifest revision。

未配置 a2a 时不挂载入口。配置后，服务凭据仍缺失时 Card／协议请求 401，健康不可用，新执行拒绝。企业 OIDC／OAuth 尚未接入。凭据解析是注入接口，默认环境变量名称为 `DEVMESH_CREDENTIAL_` 加 credentialRef 的大写字母数字形式，其余字符替换 `_`，例如 `internal.service` 对应 `DEVMESH_CREDENTIAL_INTERNAL_SERVICE`。实际值不进入清单、日志或 Git；服务凭据最少 16 字符。认证 caller 来自中间件，不能从业务载荷声明。

| 角色 | 协议路由 | Card |
| --- | --- | --- |
| product | /internal/agents/product/a2a | /internal/agents/product/agent-card.json |
| architect | /internal/agents/architect/a2a | /internal/agents/architect/agent-card.json |
| developer | /internal/agents/developer/a2a | /internal/agents/developer/agent-card.json |
| tester | /internal/agents/tester/a2a | /internal/agents/tester/agent-card.json |

使用 `Authorization: Bearer …` 和 `A2A-Version: 1.0`。标准 SendMessage 的用户 Message 含一个 DataPart，遵守 `devmesh.work.v1`。初次请求不预先指定 taskId/contextId；已有任务的补充输入及新 activation 由后续 MessageInbox／调度工作包接入。这里只接受内部可信调度已经落库的 Attempt、grant 和输入绑定，不能由外部调用者构造执行许可。

启动顺序为持久存储恢复 → handler／Card 路由 → HTTP 监听 → 真实自检 → 注册事务 → 投影 → readiness。某端点不可用不伪造健康，也不禁止其他独立健康端点。默认 60 秒检查、120 秒过期、5 秒投影校对；每次准入仍读 DB 核对，轮询间隔不延长授权。

## 数据与恢复

- 迁移 v5 建立注册版本、探测票据、检查结果、代际、默认绑定、生命周期、审计、Attempt 固定投递绑定与 Task 归属／事件。全部由原 SQLite Worker 写入，没有 SDK 专用的第二连接。
- 同清单复用代际，同 revision 异体拒绝，已替换旧清单不能自动回切。更新通过新 manifest revision；端点内容变化必须新 endpoint revision。移除后 DRAINING，历史查询继续；相同清单重启不能消除维护排空。
- 探测在事务外执行，开始时分配持久序号；迟到结果只归档。Card 地址、实现版本、技能、streaming、期望 hash 均核对；变化为 NEEDS_REVIEW。
- 事务先查 caller+operation 去重，再验证绑定／epoch／grant；Inbox、预分配 Task、PENDING AcceptedWork 一次提交。相同请求返回原 Task；异体明确冲突。提交前没有 Runtime 或工具副作用。
- 唯一消费者使用持久 claim token，PENDING→ACTIVE。进程重启将 ACTIVE 转 RECONCILE，保留 working 协议事实；不把任务重新排队执行。尚未消费的 PENDING 可原任务消费。
- GetTask／ListTasks／SSE 按 caller 与 endpoint 授权。SSE 断线重订阅先发当前持久快照，再读取新增有序事件；断线不取消、不重发工作。历史事件为查询投影，不依赖内存消息总线存活。
- PENDING 取消没有执行副作用，可变 canceled；ACTIVE 仅保存 cancelRequested，停止证据与未知工具／Runner 作业核实前不写 canceled。业务 Attempt、验证结论和人工接受仍由各自状态机负责。

SDK 1.3.0 的 Card Express 中间件直接 JSON 序列化 provider 对象，适配层显式使用 `AgentCard.toJSON`，防止把 protobuf `$case` 内部结构暴露到协议；JSON-RPC 使用官方 codec／transport。真实官方 ClientFactory 验证 Card、发送、查询、分页、SSE、取消与错误，不自行定义私有 RPC 方法。

## 验证与当前范围

`pnpm test:a2a` 运行真实 Worker、SQLite、本地 HTTP 和官方客户端；覆盖清单／CAS／迟到健康／过期／投影失败／排空、重复发送、异体冲突、主体隔离、监听后自检、未配凭据、事务回滚及 SIGKILL 受理／领取切点。测试服务身份和测试消费者只用于协议验证，不冒充真实模型执行。

本模块尚不启动 Runtime，待 P0-06 消费；sender 的网络 Outbox 循环与完整 Run 配置冻结在 P1-03，已有基础准入只冻结 Attempt 投递目标。当前部署要求接收端可验证同一控制存储内的业务授权，拆分独立接收库的授权同步仍须后续部署设计。外部 Exposure、PublicTaskStore、单 Agent Invocation 与目录不在此开放；内部注册不会自动公开服务，也不提供完整动态实例发现或负载均衡。
