## Why

父工作包 P0-10（前置 P0-02／P0-05 已完成）。内部 A2A 已有持久受理，但尚无独立的公共 Card／发现路由及服务认证边界。需要先用官方客户端验证公共协议入口，明确原型能力与实际业务执行、对外发布的区别。

## What Changes

- 新增默认关闭、仅受控 loopback 测试可启用的公共 A2A 原型模块，提供单 Agent／组的直接 Card、单一默认 well-known 与授权过滤目录。
- Card 使用已锁定官方 SDK codec，URL 仅来自可信配置；公开名称、版本和技能与内部端点解耦，不泄露 Prompt、凭据或组内拓扑。
- 加入独立测试服务身份和明确的 exposure allowlist；无配置／无凭据拒绝调用。用户暂缺企业认证环境，因此企业 OIDC/OAuth 保持未配置，不用开发身份冒充企业认证完成。
- 提供严格的 `devmesh.protocol-probe.v1` 即时无副作用技能，以真实 JSON-RPC／SSE 请求验证读取、发送、权限、协议绑定和错误。不接收业务执行任务、不创建 Run／Invocation，不以测试身份开放真实业务；持久业务接入按 P2-06／P3-04／P3-05 实施。
- 保存版本兼容表、标准客户端接入样例、真实原始检查与 T18 原型范围记录。

## Capabilities

### New Capabilities

- `public-a2a-prototype`: 公共 Card 发现、受控服务身份与官方客户端互操作原型。

### Modified Capabilities

无。

## Impact

新增公共协议包／配置／接入文档与测试，复用官方 A2A SDK，不复用内部 handler 的授权许可或派发路径。依据 design/02 §8.2–8.4 和 P0-10 的原型交付范围；外部业务持久 TaskStore、Exposure 发布状态机和公网开放不作为本原型已完成能力。没有运行中业务或数据库迁移兼容影响，禁用即不挂载公共路由。
