## Context

见 proposal.md。依据 design/02 §8.2–8.4 和实施文档 P0-10。官方 A2A JS SDK 1.3.0／协议 1.0 已锁定；内部适配包含持久 Task 与执行许可，不能把外部请求原样转入内部 handler。用户要求暂不依赖企业认证与 Runner，因此当前交付限定为受控协议原型，业务发布仍按后续工作包推进。

## Goals / Non-Goals

**Goals:** 验证公共身份、发现地址、JSON-RPC／SSE 绑定和官方客户端的真实互操作；外部公开身份不受固定四角色枚举限制。

**Non-Goals:** 不发布到企业目录或公网，不实现匿名执行／企业 OAuth 的假登录，不把即时探测 Message 当作持久业务 Task；不会创建业务 Run、Invocation、调度记录或模型调用。

## Decisions

1. 独立公共原型模块，严格 `loopback-protocol-prototype` 模式。默认 `enabled=false`；启用须显式提供 loopback trusted publicBaseUrl、测试身份与受控目标列表。该列表叫测试端点配置，不称为已发布 Exposure，不冒充 DB 发布权威；正式 Exposure 的版本／生命周期由 P3-04 实现。
2. URL 由可信配置生成，忽略请求 Host／转发头生成地址的做法。提供 `/agents/{publicKey}/agent-card.json`、`/groups/{publicKey}/agent-card.json`、`/a2a/agents/{publicKey}`、`/a2a/groups/{publicKey}`、授权过滤的 `/catalog/agents`，以及只映射一个配置目标的 `/.well-known/agent-card.json`。publicKey 为受限字符串，不复用内部角色枚举。
3. 测试端点不可变快照包含 publicKey、kind、名称、应用版本与 Card 访问策略；SDK codec 生成、校验并序列化 Card，JSON-RPC／SSE 均真实实现后才声明 streaming。Card 仅声明探测技能，协议与应用版本分开。默认保护 Card，公开 Card 仅暴露无敏感信息的原型描述。鉴权响应不共享缓存。
4. 测试 bearer 通过 credentialRef 解析，token 具有最低长度并以恒时比较验证。身份只获明确的端点 allowlist；无配置、无密钥、错误凭据、重复／歧义身份、越权均拒绝。Host／Origin 和请求体有界。此模式不会签发 token，也不宣称支持尚未接入的企业 OAuth。
5. 探测唯一业务数据为严格、短小的 `devmesh.protocol-probe.v1`／nonce。立即返回标准 agent Message，JSON-RPC 和 SSE 使用相同校验和身份路径。不接收 `devmesh.external-request.v1` 业务执行契约，不把探测请求写入内存 TaskStore。查询不存在的 Task 返回标准错误。即时响应无异步执行或不可逆副作用，因此不需要伪造持久业务任务；后续实际外部业务使用独立的持久 PublicTask／Invocation／Run 准入事务。
6. SDK 1.3.0 使用 protobuf oneof；Card 与 Message 在 transport 边界使用官方 codec，避免直接 JSON.stringify 破坏协议字段。客户端例子使用 ClientFactory 与真实 HTTP，不手写旧版 `message/send` 等协议报文。
7. 测试验证默认关闭、单／组直接发现、根默认只一张 Card、按身份过滤目录、Card 内容及可信 URL、JSON-RPC 与 SSE 的即时探测、越权和非法业务请求无执行，以及匿名／错误 Host／Origin 拒绝。兼容表明确已验证绑定与未实现绑定，不做公网／企业身份通过结论。

## Risks / Trade-offs

- [原型被误当业务服务] → 独立 mode、默认关闭、仅 loopback、Card 仅声明协议探测，业务契约明确拒绝。
- [测试身份被误当企业认证] → 文档与配置明确标注，credentialRef 无值不能启用，不提供匿名降级。
- [公共身份与内部实现耦合] → 以 publicKey／kind 分发独立路由，Card 不含内部拓扑；正式绑定以后续发布快照承接。
- [协议 SDK 版本差异] → 固定现有 SDK 与协议，codec＋官方客户端往返验证，不追加未实现的绑定。

## Migration Plan

新增默认关闭的模块和配置，无数据库迁移。启用仅用于受控本地验收；停止挂载即可撤销原型，不产生待迁移业务任务。后续正式接入替换探测技能时使用新的能力／版本与持久准入，不把原型配置自动发布为生产 Exposure。
