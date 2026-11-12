# Dynamic binding review

2026-11-12，Codex 在同一 Agent 的后续步骤复核实现和原始日志；不是独立人员或产品验收。

证据：`dynamic-v1/evidence.json` 的源码指纹与全部原始日志。类型、lint、构建、动态 MCP 2/2、原 repo MCP 11/11、真实 Runner 维护 2/2 均通过。

- 服务在分配前启动；真实本地认证 MCP HTTP 在后续 READY 分配上读写、CAS、提交及归档 ACK。暂停后原操作查询保留、新写入被拒绝。
- 首次 MCP 调用前替换物理目录，使用 DB 中原分配的 dev/ino 验证并拒绝；替换目录中的内容未修改。解析器每次检查当前成员和 Runner，不以首次路径读取建立信任、不使用无界绑定缓存。
- 兼容旧静态绑定；可信解析器属于服务端配置，工具请求仅携带 workspaceRef。物理路径和身份不会返回模型。

ControlledBackend 不启动真实容器。远程身份、真实模型、Linux/runsc、Runtime 接线和 T05/T23 产品门槛未据此通过。
