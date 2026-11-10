## Context

P0-03/04 已提供唯一 Worker 事务、可恢复内容与会话；官方 SDK 的普通发送路径会分配 Task，不能直接承担业务幂等。依据 D2 §5.1～5.5、D5 §3.1。用户明确先完成离线代码和验证，不依赖企业认证、模型与容器环境。

## Goals / Non-Goals

本变更形成可恢复的内部注册与标准协议入口，提供待消费队列而不在 HTTP 请求内启动模型。Invocation、PublicTaskStore、公开目录与 Runtime 分别属于后续工作包。

## Decisions

1. 锁定官方 `@a2a-js/sdk` 1.3.0（A2A 1.0）；使用官方 Express transport 和 RequestHandler 接口。实现自有 handler 控制初次 taskId 与事务，再复用 SDK 标准序列化；不以普通 handler 外的内存 Map 去重。TaskStore 同 Worker，不引入第二个 SQLite 驱动。
2. 正式迁移追加注册表、当前状态与任务版本字段。清单和端点配置不可变，代际更新 CAS；同 revision 不同 hash、旧清单回切拒绝。相同清单只追加探测，不复活 DRAINING。网络探测在事务外，序号在开始时持久分配；迟到结果只归档。
3. Registry 一次读取 DB 快照，替换完整只读索引；准入和发送均复核 DB 版本、生命周期和健康有效期。监听后自检，失败不开放执行。默认每 60 秒检查、120 秒过期、5 秒刷新兜底，测试使用可控小间隔。
4. 标准 Message 携带受控 `devmesh.work.v1` DataPart，认证 caller 来自服务中间件。收件事务核对 endpoint、Attempt、grant、epoch、输入和角色来源；保存 Inbox、submitted Task、PENDING AcceptedWork，提交后才返回。相同 caller/operation/request 返回原 Task，同键异体冲突；不同 caller 无权查询或修改。
5. 默认不开放内部入口；仅显式配置 credentialRef 并从注入的凭据解析器取得服务凭据后允许访问。外部 Exposure 默认关闭。本地测试实际运行官方客户端与 HTTP，测试执行器独立于生产 Runtime，不宣称模型已联调。
6. 接收任务支持查询、取消意图、标准 SSE 初始快照与有序状态更新。取消只申请停止，未核实的 ACTIVE 工作不写 canceled；重启 PENDING 可消费，ACTIVE 转 RECONCILE，禁止重复启动。

## Risks / Trade-offs

- SDK 演进 → 固定版本、官方客户端端到端兼容测试，禁止手工发明 JSON-RPC 方言。
- DB 已提交但投影失败 → 保留 DB 事实，执行门关闭，重建新快照。
- 健康失败或清单删除 → 只禁止新任务，保留旧 taskId 查询和停止入口。
- HTTP 响应丢失／进程中断 → 原键查询，事务提交前没有消费者副作用；不盲重发外部未知操作。

## Migration Plan

按已有 SQLite 升级前备份机制应用新迁移；禁止降级。仅配置清单与服务凭据时启用模块。回退通过新清单 revision 显式引用旧端点，保留历史任务和绑定；真实 OIDC 与模型验收在环境具备后执行。
