## Why

父工作包 P0-04。P0-03 已有单 Worker 与内容元数据，但没有实际文件发布、会话索引和根目录身份；当前 registerContent 不能替代真实正文保存。依据 D5 §3.3/5/7 和 D2 §3，建立后续 Runtime 可恢复的持久输入基础。

## What Changes

- 新增本地内容 Provider、显式布局初始化／身份／路径／容量检查与节点锁，保留相对内容键。
- 追加正式迁移，保存对象写入操作、创建 Run 前的附件、工作流会话、消息、模型步骤、上下文和授权读取引用。
- 按原写入键恢复发布后的索引提交；缺失／损坏对象阻断消费，不从投影修补事实。
- 提供会话阅读投影和实际 storage:init／storage:verify；HTTP 宿主可选组合持久存储。
- 用户已确认模型、企业认证及 Docker/gVisor 资源暂缺：持续实现并离线验证代码，保留真实联调缺项，默认不开放外部访问。

## Capabilities

### New Capabilities

- `local-content-sessions`: 本地内容发布、目录身份、持久会话与授权引用、故障恢复和阅读投影。

### Modified Capabilities

无；在既有 SQLite 行为上增加白名单命令与追加迁移，保留已有迁移校验和。

## Impact

新增 packages/blob-store；扩展 storage-sqlite、platform-core 与启动配置；新增迁移和实文件故障测试、维护脚本、工程说明及证据。首版工作流会话完成本包范围；Invocation 的独立会话外键随 P2-06 的真实宿主表接入，不伪造宿主。完整 GC、日志归档及全平台恢复仍按 P2-07/P3-06 实施。
