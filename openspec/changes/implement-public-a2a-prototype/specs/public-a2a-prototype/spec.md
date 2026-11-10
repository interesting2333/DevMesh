## Purpose

建立公共 Agent 身份、发现地址与外部服务调用的可核实协议原型，使接入方能够用标准客户端验证 Card 和通信绑定，同时准确区分受控探测、企业身份接入和持久业务执行，防止原型意外开放真实研发权限。

## ADDED Requirements

### Requirement: Explicit and bounded prototype exposure

公共协议原型 MUST 默认关闭，启用须使用受控 loopback 配置与测试服务身份；未配置凭据不得降级为匿名调用。原型 MUST 不创建业务执行目标。

#### Scenario: Missing configuration
- **WHEN** 未显式启用或缺少可信地址／测试凭据
- **THEN** 公共原型不开放可调用入口，不产生模型、Run 或 Invocation

### Requirement: Public discovery identities

原型 SHALL 支持独立单 Agent／组的 Card URL、单一默认 well-known Card 和按身份过滤的发现目录。Card MUST 来自可信配置，只描述已实现的协议能力，不包含内部拓扑、Prompt、凭据或项目列表。

#### Scenario: Discover an authorized group
- **WHEN** 有权限的客户端读取组的直接 Card 或默认发现入口
- **THEN** 得到一张标准 Card，所声明的地址、版本、认证与实际绑定一致

### Requirement: Scoped service authentication

原型 MUST 对每个调用检查测试身份及指定公共目标权限，拒绝歧义身份、错误凭据、越权、非允许 Host／Origin 和无界请求。

#### Scenario: Access outside the identity scope
- **WHEN** 某测试身份调用未获授权的公共目标
- **THEN** 请求被拒绝，且不得转发到内部 Agent 执行路径

### Requirement: Real protocol interoperability

原型 SHALL 通过真实 JSON-RPC 与 SSE 执行已声明的有界即时探测技能，返回标准 agent Message。业务执行契约 MUST 明确拒绝；即时探测不得冒充已持久受理或完成的业务 Task。

#### Scenario: Probe with a standard client
- **WHEN** 官方客户端读取 Card 后使用正确身份发送合法探测请求
- **THEN** 收到与探测 nonce 对应的标准响应，流式和非流式结果一致

#### Scenario: Submit a business execution request
- **WHEN** 客户端向原型发送研发执行契约
- **THEN** 返回明确的协议错误，不创建或激活业务任务
