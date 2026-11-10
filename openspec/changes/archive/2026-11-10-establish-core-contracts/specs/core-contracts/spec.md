## Purpose

为 DevMesh 后续存储、Agent、业务 API 和 Runner 提供统一且可执行的核心契约；明确结构校验、依据版本与宿主权限比较的边界，使无效或陈旧载荷不能静默进入后续业务实现。

## ADDED Requirements

### Requirement: Strict versioned contract parsing
The contracts package SHALL 验证带固定 schemaVersion 的核心命令、领域事件、四角色输出和内部委托，拒绝错误类型、未知字段、错误 ID 命名空间和未知版本，并返回字段路径。

#### Scenario: Invalid or future payload
- **WHEN** 输入含未知 schemaVersion、拼错字段或不合法角色输出
- **THEN** 解析失败，错误为 422 且包含字段路径，不执行隐式转换

### Requirement: Separate execution owners
The package SHALL 用严格判别联合区分 workflowAttempt 与 invocationAttempt，比较服务端提供的当前宿主、epoch、activation、grant、资源范围及有效期。

#### Scenario: Mixed or stale permit
- **WHEN** Invocation 许可含 run 字段、用于不同宿主／旧代际，或申请超出许可的资源
- **THEN** 校验拒绝，不把该许可解释成另一类宿主

### Requirement: Conditional commands
The package SHALL 为新操作提供版本守卫，缺失 If-Match 返回 428，不匹配返回 412，业务内容版本或审查哈希失效返回 409。

#### Scenario: Old confirmation
- **WHEN** 用户依据旧 ETag 或旧 planRevision／reviewHash 确认
- **THEN** 守卫拒绝并返回当前／提交版本诊断；调用方须保留草稿并重新获取依据

### Requirement: Reproducible API contract
The repository SHALL 从共享 schema 生成 OpenAPI 3.1 初版，携带 planned 标记与实际模块边界，并提供正反样例、生成一致性检查及自动化失败测试。

#### Scenario: Generated document drift
- **WHEN** 提交的 OpenAPI 与当前源码生成结果不一致
- **THEN** 一致性检查非零退出；业务 API 不因文档存在被当成已部署
