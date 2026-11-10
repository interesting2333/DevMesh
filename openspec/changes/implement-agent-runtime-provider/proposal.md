## Why

父工作包 P0-06。A2A 现在能真实持久受理，但待消费项还没有角色执行宿主与模型／工具循环。用户明确暂无模型、认证和容器资源，授权先完成代码与离线验证；真实 DeepSeek 三组样本和模型能力冻结保留未执行，不能据本地协议夹具关闭整个工作包。

## What Changes

- 实现明确配置模型 ID／能力／credentialRef 的 DeepSeek Chat Completions Provider，完整解析工具参数、用量、超时及错误，丢弃内部推理字段。
- 实现四角色配置和执行宿主，持久请求／完整回复后才调用工具，逐步核验许可、步数、上下文和预算；消费持久 AcceptedWork。
- 实现工具操作先登记、原操作查询与未知结果阻断，提供适配接口给后续真实 MCP。
- 使用实际本地 HTTP 协议服务、真实 SQLite／文件与故障切点验证代码；没有外部模型时保持 MODEL_NOT_CONFIGURED。

## Capabilities

### New Capabilities

- `durable-agent-runtime`: 可审计的角色执行、完整响应与工具操作持久化、Provider 边界和执行预算。

### Modified Capabilities

无。已发布的协议和内容规范保持兼容，新增执行能力在验证后同步主规格。

## Impact

新增 agent-runtime 包、正式运行索引与工具步骤迁移，组合 A2A 消费者与角色配置；依据 D2 §2～4、D4 恢复和 T02/T22。延续原技术栈和单 Worker，原始模型密钥／内部思维不写入持久记录。真实模型样本及价格／账单没有证据时标未验证／未知，不发明容量或费用。
