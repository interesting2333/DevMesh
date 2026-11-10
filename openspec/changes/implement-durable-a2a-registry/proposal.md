## Why

父工作包 P0-05。现有 SQLite、内容和会话已能持久保存业务事实，但没有真实 A2A 接收端或可核对的 Registry；直接使用内存 TaskStore 会在重启或重发时丢失、重复工作。

## What Changes

- 固定官方 A2A JS SDK 与 1.0 JSON-RPC/SSE 兼容性，提供四角色受保护入口与 Card。
- 实现清单导入、不可变端点版本、代际 CAS、健康序号、维护排空和 DB→内存投影。
- 将 Inbox、预分配 Task 与 AcceptedWork 在同一 Worker 事务中提交；先持久受理再允许消费者激活。
- 真实本地 HTTP、官方客户端、响应丢失重发、重启和注册故障验证，不依赖模型或 Runner。

## Capabilities

### New Capabilities

- `durable-a2a-registry`: 持久内部注册、可靠受理、查询及受控协议入口。

### Modified Capabilities

无。后续 Runtime、调度与外部 Exposure 不在此冒充已完成。

## Impact

扩展 storage-sqlite 正式迁移和类型 RPC；新增 A2A 适配及 Registry 包，组合可选平台服务。依据 D2 §5、D5 §3.1 与 T02/T03/T17 基础；保持数据库权威、历史绑定和暂停边界。认证暂不连接企业身份系统，未配置服务凭据时入口关闭；测试使用明确的测试身份。四份设计基线不变。
