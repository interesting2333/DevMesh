## 1. Public protocol boundary

- [x] 1.1 建立默认关闭的 loopback 配置和单／组公共身份快照；用实际 HTTP 验证直接 Card、单一 well-known、目录过滤和可信 URL，不暴露内部字段。
- [x] 1.2 实现独立测试 bearer 与目标 allowlist、Host／Origin／体积边界；验证无配置、匿名、错误／歧义凭据和越权拒绝，企业认证保持未配置。

## 2. Interoperability

- [x] 2.1 基于已锁定官方 SDK 实现严格即时探测的 JSON-RPC／SSE handler；用官方客户端真实发送、验证结果一致与业务请求拒绝，确认没有执行目标。
- [x] 2.2 提供标准客户端接入例子、Card／协议／SDK 兼容表和配置说明；运行例子并记录实际绑定与未实现能力。

## 3. Delivery

- [ ] 3.1 执行适用构建、类型、权限及真实协议回归，保存固定源版本、原始日志和 T18 原型范围证据；按真实前置及结果同步台账，不声称公网或企业 OAuth 验收。
