# Agent Runtime

TypeScript / Node 24 的持久执行器，复用 SQLite Worker、内容存储和官方 A2A SDK。没有模型配置时不创建消费者，不发模型请求。

`DeepSeekProvider` 使用 Chat Completions HTTP 协议。必须配置 endpoint、model、credentialRef、能力声明和预算；不推测模型容量或价格。能力声明中的 `DECLARED` 只代表配置值，`VERIFIED` 必须关联实际模型样本证据。

```ts
const provider = new DeepSeekProvider(providerConfig, resolveCredential);
const runtime = new AgentRuntime(storage, content, [provider], registeredTools, tokenLimit);
const consumer = new RuntimeConsumer(storage, runtime, hostedEndpointIds, workerId);
await consumer.start();
// 退出前必须先 await consumer.stop()，再关闭 A2A 和存储。
```

服务文件可添加 `runtime: { providers: [...], tokenLimit: 100000 }`，同时必须配置 `storage` 和 `a2a`。组合根目前注入零个工具；MCP 适配器准备好后才能选择对应 allowlist，不能将系统 Shell 暴露为默认工具。凭据仍通过 `DEVMESH_CREDENTIAL_<REF>` 环境引用解析，参考 A2A 包的引用规则；配置和示例都不保存密钥。

`config/runtime.example.json` 是配置结构示例：`configure-model-id` 必须替换，8192／2048 是示例限制，不是供应商容量结论。先核实目标模型支持的模式、上下文和工具能力，再关联实际证据。缺资源时保持未配置，不用本地夹具声明 VERIFIED。

每次受理使用已提交的角色快照：provider/model、提示词 artifact、四角色输出 schema、工具 allowlist、步数、上下文、输出和超时。提示词和工具 schema 的哈希连同 Provider 能力、总 token 预算冻结进 activation。上下文包含工作定义、需求依据、输入 manifest、引用材料和全部有序会话消息；超限明确拒绝，不静默丢弃消息。

每轮先保存上下文与公开请求，再提交 SENT，随后调用网络；完整回复和用量登记成功后才解析全部工具参数。所有工具参数须一起通过 schema 检查，才逐个持久登记操作并执行。工具适配器必须检查宿主 permit 的实际资源范围，并用原 operationId 提供查询能力。异常或未知写结果只查询，不重新执行；落盘工具消息后确认丢失，可直接修复原操作终态。

模型请求 SENT 后崩溃、超时或回复保存失败保持未知区间，并标记未知用量。启动恢复把在途 activation / 工具置为待核实，不重新发送。`reconcileTool` 只能修复已有结果或查询原操作，不恢复模型循环、不放行后续写入。生产受理租约当前仍由调度层控制，过期立即禁止下一动作；续期属于调度工作包。

只有完整的四角色 JSON schema 校验通过，才保存 `agent-candidate` artifact 并发送 A2A completed。它不将 Attempt 置为 SUCCEEDED，不建立 release candidate，不更新项目接受指针；这些属于结果校验和人工接受流程。

Provider 显式发送非 thinking 模式，防止把内部推理纳入可恢复会话。公开 DTO 不包含请求头、密钥或 `reasoning_content`。这是当前实现支持的能力边界，依据 [DeepSeek API](https://api-docs.deepseek.com/api/create-chat-completion/)、[thinking 与工具的跨轮要求](https://api-docs.deepseek.com/guides/thinking_mode/) 和 [工具调用协议](https://api-docs.deepseek.com/guides/tool_calls/)。

`tests/runtime*.test.mjs` 使用真实本地 HTTP、SQLite 和文件，验证协议、持久化顺序、权限、预算与未知结果。它们不代表真实 DeepSeek 模型质量、能力或费用验收；三组实际模型样本保留待联调。
