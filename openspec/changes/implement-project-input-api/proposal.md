## Why

父工作包 P1-01。现有 DB 领域事务能持久创建项目与 Run，内容库能保存正文／附件，但尚无面向工作台的身份边界、输入 API 和同事务 workspace 读取。需要将这些能力连接为可核实的首次提交路径，解决重复点击、响应丢失与跨项目材料读取问题。

## What Changes

- 新增 `/api/v1` 项目输入模块和默认关闭的身份解析接入点；当前按用户指令不依赖企业 OIDC，未配置时拒绝受保护请求。仅测试显式注入受控身份，不使用客户端自报 principal 或匿名默认用户。
- 按基线实现 20,000 Unicode code point 正文、最多三个 2 MiB Markdown／纯文本附件、逐文件上传／查询／移除和 UTF-8 校验；保存原文和失败文件状态，不静默跳过。
- 扩展 T1：鉴权、原键去重、READY 附件归属检查、Project／Task／Run／原始输入／理解 operation 和 Outbox／事件同事务；事务中不执行文件、Git、网络或模型操作。
- 提供 project/workspace、消息追加、权限过滤的 operation 查询和事件分页；快照与 eventCursor 在同一读事务中产生，current/history 明确区分。
- 补增量迁移、HTTP/OpenAPI 契约、真实 SQLite／HTTP／响应丢失／故障回滚证据。U01～U04 的前端体验和真实模型理解随后续工作包验收，不用 API 测试冒充完整产品路径。

## Capabilities

### New Capabilities

- `project-input-api`: 已认证主体的需求输入、附件、项目事务、workspace 与操作核实。

### Modified Capabilities

无。现有存储、内容引用、幂等与单活动 Run 规格继续适用；本变更新增面向工作台的输入与读取契约。

## Impact

影响 contracts、storage-sqlite、blob-store、platform-core，新增输入 API 包、配置和测试。需要正式 migration 保存 project_members、run 附件绑定、持久输入处理状态和 auth_sessions 基础；复用内容寻址、Worker 和权限查询，保持现有数据迁移兼容。生产企业身份尚缺环境，代码接入点与实际联调分别记录；G0/P0-06 未通过不妨碍用户授权的独立实施，P1-01 正式验收保留前置条件。
