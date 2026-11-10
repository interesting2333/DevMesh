# SQLite Storage Specification

## Purpose

为 DevMesh 提供统一的正式 SQLite 存储基础，通过单连接数据库 Worker、版本化迁移及原子领域事务保存状态、幂等操作和投递意图，在异常或响应丢失后能够查询原事实而不重复执行。

## Requirements

### Requirement: Controlled migrations and database identity
The storage package SHALL 验证数据库 store/layout 身份与不可变迁移历史，显式创建空库，已有版本升级前生成一致性备份，并原子应用每个迁移批次。

#### Scenario: Upgrade or invalid history
- **WHEN** 打开上一受支持版本或校验和被修改的历史
- **THEN** 前者先备份并保留历史数据后升级，后者拒绝启动；失败批次不留下部分表或虚假版本

### Requirement: Single bounded Worker
The client SHALL 仅发送白名单类型化请求到单连接 Worker，在容量耗尽时于发送前拒绝，并在关闭或故障时处理所有未完成请求。

#### Scenario: Overload or Worker death
- **WHEN** 请求超过上限或 Worker 在写请求确认前退出
- **THEN** 前者 503 且未受理；后者明确 OUTCOME_UNKNOWN，调用方按原键核实，不自动重发

### Requirement: Atomic domain facts and durable idempotency
The storage transactions SHALL 同时提交业务对象、操作结果、事件和 Outbox，同主体／scope／键且同请求返回原结果，异请求拒绝。

#### Scenario: Lost response or transaction failure
- **WHEN** 提交后响应丢失或提交前发生错误
- **THEN** 重开后前者原键定位唯一对象，后者业务状态、事件和 Outbox 一同回滚

### Requirement: Concurrency and immutable history
The schema and transactions SHALL 保证同项目一个活动 Run、同工作一个未结束 Attempt、同角色一个槽位和每 Run 最多两个槽位，终态与已发布内容版本不可复活／改写。

#### Scenario: Paused run and unknown attempt
- **WHEN** Run 暂停或 Attempt 处于 OUTCOME_UNKNOWN 后收到重复创建／重试
- **THEN** 原对象仍占用名额，拒绝第二个活动执行或尝试，并可查询历史事实
