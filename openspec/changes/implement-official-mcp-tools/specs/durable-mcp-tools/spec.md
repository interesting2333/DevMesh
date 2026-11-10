## Purpose

为 DevMesh 的 Agent 提供可验证的 MCP 工具调用边界，通过官方协议访问授权的输入快照与独立执行作业，并在服务断线、权限变化和结果未知时保留原操作事实，避免重复执行或跨宿主访问。

## ADDED Requirements

### Requirement: Real authenticated protocol

工具调用 MUST 经过官方 MCP Client／Server 的实际 transport；服务身份、协议和工具 schema SHALL 可定位，未配置或签名变化不得静默降级为直接执行。

#### Scenario: Missing service identity
- **WHEN** 请求没有有效服务身份或请求不被允许的工具
- **THEN** 服务拒绝请求，不读取快照或登记 Runner 作业

#### Scenario: Changed tool schema
- **WHEN** 冻结连接重新建立而工具 schema 与已保存快照不同
- **THEN** 客户端阻塞新动作并要求重新验证，不自动替换活跃执行的签名

### Requirement: Scoped immutable repository reads

repo 只读工具 SHALL 校验快照授权和显式文件清单，并验证所读字节与快照哈希一致；MUST 拒绝越界、链接和不在授权清单内的文件，不执行仓库脚本。

#### Scenario: Snapshot changed or escaped
- **WHEN** 请求越界路径、链接文件或内容与清单哈希不一致
- **THEN** 返回确定错误，不能读取其他宿主文件或把新字节视为原快照

### Requirement: Durable long jobs and reconciliation

tests.start SHALL 使用稳定 operationId 登记独立作业；断线或结果未知时 MUST 查询原操作。查询与停止 SHALL 检查原作业宿主，工具确认不得等同于测试通过。

#### Scenario: Reply lost after admission
- **WHEN** 原 start 已提交但 MCP 回包丢失
- **THEN** 调用方只查询原 operationId，得到原 job 或保持未知，不重建作业

#### Scenario: Stop during closed admission
- **WHEN** 原作业的授权主体请求查询或停止且新执行准入已关闭
- **THEN** 服务仍按该主体的收尾权限核实原作业，不允许新启动或其他宿主操作
