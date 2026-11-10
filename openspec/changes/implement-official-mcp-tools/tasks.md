## 1. Protocol

- [x] 1.1 固定官方 SDK 与依赖，完成 Streamable HTTP 服务／客户端与身份；验证真实 initialize/list/call、Host／Origin、无凭据与超时。
- [x] 1.2 实现能力／schema 快照与重连不重放，验证签名变化及回包丢失后的原操作查询。

## 2. Backends

- [x] 2.1 实现 repo 授权快照清单与只读工具；验证实际文件读取、哈希、越界／链接／凭据路径拒绝。
- [x] 2.2 实现 tests.start/get/stop/by-operation 的 RunnerClient 后端；通过真实 MCP＋Runner 管理 HTTP 验证去重、宿主隔离、未知查询与停止边界，注明受控容器后端。
- [x] 2.3 实现 RuntimeTool 连接桥接、冻结 allowlist 与 schema；验证模型参数不含服务凭据／许可，未知写操作无重发。

## 3. Delivery

- [x] 3.1 完成适用离线回归、技术复核、源版本及原始日志；更新配置、文档与台账，正式状态遵守前置验收。
- [ ] 3.2 在具备实际 Linux/runsc Runner 后执行真实长任务、断连及 T04/T05 基础验收；当前资源暂缺，保持未执行。
