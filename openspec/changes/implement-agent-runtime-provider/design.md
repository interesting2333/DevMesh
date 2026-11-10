## Context

P0-04 已有有序会话／模型步骤／上下文，P0-05 已有持久受理与消费者 claim。设计依据 D2 §2～4、D4 §5、D5 会话与工具操作。真实 DeepSeek 模型 ID、容量、工具能力和预算尚无配置；用户授权先完成代码与离线验证。

## Goals / Non-Goals

实现真实执行路径与可恢复记录，分别验证传输、持久化和权限边界。三组实际模型评测、供应商价格和 gVisor 工具执行保留待联调，不将本地 HTTP 夹具当成能力评测。

## Decisions

1. Provider 使用 Node fetch 的 Chat Completions 协议适配，不引入其他 Agent 框架；endpoint、model ID、credentialRef 与 ModelCapabilities 明确配置并冻结。参考官方 API 文档，不默认宣称某模型容量。能力记录区分 DECLARED 与 VERIFIED，实时样本及模型资源缺失保持待验证。
2. 首版可恢复工具循环显式关闭供应商 thinking 模式。官方文档说明 thinking+tools 需要跨轮传回 reasoning_content，而设计禁止保存内部思维；采用支持非 thinking 的受控能力声明，不删除必要字段后伪称支持 thinking 恢复。`thinking:disabled` 只在传输层，持久请求用可展示 DTO；响应内部思维字段丢弃，不进入日志、正文或导出。若模型不支持该模式，明确配置错误，不静默改模型。
3. Provider 默认非流式完整响应；支持 AbortSignal、连接／总请求超时、有界正文和完整参数解析。只投影 content、toolCalls、finishReason、requestId、usage，费用无价格依据时 unknown。HTTP 错误正文与凭据不持久化。截断、重复工具 ID、非法 JSON、未知 finishReason 都阻止工具副作用。
4. Runtime 消费 AcceptedWork，并以 ExecutionHost 隔离 Run／Attempt 归属。会话、角色快照、上下文与步骤均有真实来源；每步核对当前授权和控制门、步数、输入／输出／总 token 预算。保守 token 计数用 UTF-8 上界加结构开销，不能为塞入上下文丢弃必要要求；超过 200 条上下文显式要求压缩，后续压缩保存独立来源快照。
5. 每次调用先持久保存脱敏 ModelRequest 与 SENT，再发网络请求；完整 Response 持久化成功后才解析／执行工具。SENT 未确认保持未知区间，不在重启时自动重复请求；恢复先核实已有响应或人工处理。模型取消只结束连接，不能视为工具／Runner 已停止。
6. 工具必须来自冻结 allowlist 与 schema／副作用分类。参数完整解析后先登记 ToolOperation／唯一 step+callId，再调用适配器。独立只读可有限重试确定失败；写操作不隐式重试，未知结果调用适配器原 operation 查询。结果先持久正文与同 step 工具消息，再提交操作终态；若最后一次提交中断，可从唯一消息补交，不能再次执行工具。MCP 真实协议适配在 P0-08，接口夹具只验证 Runtime 顺序。
7. 最终 JSON 通过冻结角色 schema 后产生候选成果并返回 A2A completed；业务成功仍由 ResultVerifier 判断，不提前将 Attempt 写 SUCCEEDED。已知参数／模型错误为 failed，未知副作用或进程重启为 RECONCILE，不释放旧宿主后重试。

## Risks / Trade-offs

- 模型当前默认／能力变动 → 必填模型配置、固定能力声明与三组真实评测；缺配置不启动。
- 请求超时或工具结果丢失 → 保存原请求／操作键与未知用量，不当成零成本，不自动重放。
- 完整响应和工具结果磁盘失败 → 执行门阻断；重试持久保存或核实原操作，不能重跑工具。
- 上下文保守估算偏大 → 明确显示估计方法；要求可追溯压缩，首版拒绝静默截断。

## Migration Plan

正式迁移追加 Runtime activation、工具请求／消息索引与预算事实，复用已有 operations／tool_operations／model_steps；升级前备份，禁止降级。可选组合无模型配置时关闭消费者，现有受理／查询保持可用。真实模型能力样本与用量具备后再完成 P0-06 验收；不阻止后续不依赖资源的提前编码。
