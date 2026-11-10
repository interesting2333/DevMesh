## Purpose

为平台提供可恢复且可核实的角色执行循环，保存可展示模型请求、完整回复与工具操作来源，使模型传输中断、参数错误、权限变化或副作用未知时不会绕过持久化、预算和执行边界。

## ADDED Requirements

### Requirement: Explicit provider and role configuration
The platform SHALL 要求明确模型 ID、能力及凭据引用，冻结角色和模型配置，缺少配置时不宣称模型执行已开始；内部思维与传输密钥不进入持久会话。

#### Scenario: Missing model or private response fields
- **WHEN** 模型未配置或响应携带内部推理／凭据字段
- **THEN** 前者保持不可执行；后者只保存可展示投影，不泄漏到日志、回放或导出

### Requirement: Durable complete response precedes tools
The runtime SHALL 在模型网络调用前持久保存步骤请求，并在任何工具副作用前保存完整回复、完整工具参数和用量来源。

#### Scenario: Truncation or persistence failure
- **WHEN** 参数不完整、回复截断、重复调用 ID 或回复保存失败
- **THEN** 没有工具执行；中断记录可按原步骤核实，不用部分流式参数触发动作

### Requirement: Revalidated bounded execution
The runtime SHALL 每步及工具调用前核实当前许可、控制门、步数和 token 预算，保留必要上下文与来源；最终输出经过角色 schema 验证才成为候选成果。

#### Scenario: Pause or exhausted budget
- **WHEN** 许可撤销、人工暂停或步数／上下文／用量达到上限
- **THEN** 停止新动作并保存明确原因；不扩大授权、不静默删除要求或把候选成果视为人工接受

### Requirement: Durable tool operations and unknown outcomes
The runtime SHALL 先持久登记唯一工具操作，再调用已授权工具；未知写操作只按原 operation 核实，持久结果恢复不得重复执行。

#### Scenario: Tool reply or completion acknowledgement is lost
- **WHEN** 工具已接收但响应中断，或结果消息保存后操作终态提交中断
- **THEN** 前者查询原操作或保持待核实；后者从唯一已保存结果补交，不创建第二次副作用
