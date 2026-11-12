# 公共 A2A 协议原型

P0-10 原型提供外部客户端的发现与协议探测入口。默认关闭，独立于内部 Agent 宿主，不接入模型、Runner、Run、Invocation 或业务 TaskStore。当前只在显式 loopback 测试模式运行；企业身份环境尚未提供。

## 路由与身份

| 入口 | 行为 |
| --- | --- |
| `/agents/{publicKey}/agent-card.json` | 单 Agent 的标准 Card |
| `/groups/{publicKey}/agent-card.json` | Agent 组的标准 Card |
| `/.well-known/agent-card.json` | 只返回 `defaultEndpoint` 指定的一张 Card |
| `/catalog/agents` | 返回当前测试身份的目标列表与 Card URL |
| `/a2a/agents/{publicKey}`、`/a2a/groups/{publicKey}` | 官方 JSON-RPC handler，包含 SSE 流式发送 |

公开身份使用独立 `publicKey`，可以新增单 Agent 或组，无须新增平台四角色枚举。地址完全由可信配置生成，转发头不参与生成。Card 不包含内部角色路由、组内拓扑、Prompt、项目或凭据引用；应用版本与协议版本分别表达。

Card 默认需要测试 bearer；`publicCard:true` 可只开放该目标的 Card。发现目录与调用始终需要身份和明确目标 allowlist。重复身份／引用、重复 token、缺少 token、过短 token、未知目标均阻止启动，先校验全部凭据再挂载路由。凭据在挂载时冻结；轮换需停止并重新挂载。此模块不签发 token，不实施企业 OAuth/OIDC。

## 本地运行

先按根工程说明安装和构建。`config/public-a2a-prototype.example.json` 为关闭配置；使用启用示例需自行提供本地测试凭据，`CLIENT_TOKEN` 引用在示例进程中读取环境变量 `DEVMESH_PROTOTYPE_CLIENT_TOKEN`。不要把 token 写入配置或源码。

```powershell
node packages/a2a-adapter/examples/prototype-server.mjs --config config/public-a2a-prototype.enabled.example.json
# 另一个已配置 DEVMESH_PROTOTYPE_TOKEN 的终端运行客户端
node packages/a2a-adapter/examples/probe-client.mjs http://127.0.0.1:4320 /groups/development-team/agent-card.json
```

服务只绑定配置的 `127.0.0.1` 或 `::1`，检查连接来源为 loopback、Host 单一且精确匹配，Origin 缺省或与配置一致。HTTP 请求体上限 16 KiB；解析错误只返回公共错误码。调用不可通过公开 Card 绕过授权。客户端例子同时使用官方 Card resolver、JSON-RPC transport 和 `ClientFactory`；凭据只发往操作员指定的 loopback origin，拒绝跨源 Card 地址和重定向，单次请求有 10 秒期限，不自动重发。

Ctrl+C／POSIX SIGTERM 会关闭监听器；Windows 父进程可使用 IPC `{type:'shutdown'}`。本地服务不自动开启业务宿主。禁用配置只打印 disabled 并退出，不监听端口。

## 探测契约与兼容性

初始 user Message 包含一个 DataPart：`{ "kind":"devmesh.protocol-probe.v1", "nonce":"example_nonce" }`，nonce 只能含字母、数字、下划线和短横线，长度 1～128。响应为标准 agent Message，其 DataPart 为 `devmesh.protocol-probe-result.v1`，包含相同 nonce、公开目标、应用与协议版本。流式调用产生一条 Message 事件并结束。

| 项目 | 固定版本或能力 |
| --- | --- |
| 官方 `@a2a-js/sdk` | 1.3.0，由根锁文件冻结 |
| A2A 协议 | 1.0，使用官方 protobuf codec 处理 Card／Message |
| JSON-RPC／SSE | 实际 handler 与官方客户端往返验证 |
| HTTP+JSON REST、gRPC、0.3 兼容 | 未声明、未开放 |
| Push notification、扩展 Card | 未开放，返回标准不支持错误 |
| 业务 Task／异步执行／业务去重 | 未提供；查询返回标准不存在，列表为空 |
| 公网、企业 OAuth/OIDC、生产服务身份 | 未配置／未验收 |

`devmesh.external-request.v1` 等执行请求被明确拒绝。即时探测的 Message 表示协议响应，不代表业务受理、验证通过或人工接受。测试不会创建执行目标；实现模块也没有数据库或运行时依赖入口。

正式对外服务继续按 P2-06、P3-04、P3-05 实施：在 DB 中保存发布快照与生命周期，以独立 PublicTask 持久受理，单 Agent 映射 Invocation、组映射 Run，并执行主体权限、预算、人工确认与停止／恢复规则。这里的测试配置不会自动迁移成已发布 Exposure。

验证入口：`node --test --test-reporter=tap tests/a2a-public.test.mjs`。原始日志和固定源版本进入项目证据后，才更新相应子步骤；公网和企业身份能力不据此判为通过。
