## Purpose

为平台内四角色提供真实标准 A2A 入口及持久任务受理，使配置更新、重启、重复投递和健康变化都能核对权威版本，并避免在收到请求但尚未持久化时执行 Agent。

## Requirements

### Requirement: Committed registry generations
The platform SHALL 将完整有效清单提交为不可变端点版本与代际，从数据库同一快照构建内存投影，并在执行前核对投影版本及端点有效健康和生命周期。

#### Scenario: Restart and conflicting manifest
- **WHEN** 重启使用相同清单、同 revision 不同内容或已被替换的旧 revision
- **THEN** 前者复用代际且保留维护停用；后两者拒绝生效，不使用旧内存放行执行

### Requirement: Ordered health and preserved historical routes
The registry SHALL 按探测开始序号应用健康结果，健康失败或排空立即阻止新派发，保留历史版本和原 Task 查询，不自动迁移在途目标。

#### Scenario: Late probe and removed endpoint
- **WHEN** 旧健康请求迟到或新清单删除端点
- **THEN** 旧结果只归档；删除的端点进入排空，历史记录和任务映射保留

### Requirement: Atomic durable A2A admission
The receiver SHALL 先认证并校验授权载荷，在同一事务持久保存去重记录、唯一标准 Task 和待消费工作，提交前不运行模型或工具。

#### Scenario: Lost response and retransmission
- **WHEN** 相同主体与 operation 重发相同请求或替换载荷
- **THEN** 相同请求返回原 Task 且只有一个待消费项；替换载荷明确冲突；重启仍可查询

### Requirement: Standard authenticated protocol lifecycle
The platform SHALL 通过标准 A2A 1.0 JSON-RPC/SSE 提供 Card、受理、归属隔离的查询和取消意图，在 HTTP 监听后自检且注册投影就绪前拒绝新工作；未配置服务身份时关闭入口。

#### Scenario: Startup and incomplete cancellation
- **WHEN** 服务仍准备中、未经认证或活动任务尚未核实停止
- **THEN** 新工作被拒绝；未授权不可读取任务；取消意图不伪造成已停止终态
