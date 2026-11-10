## Purpose

为 DevMesh 的输入、附件与模型会话提供真正持久的本地内容存储，明确目录身份、授权引用、消息顺序和文件与数据库的一致性，使中断后能够核实原写入、重建阅读视图并继续读取已保存资料。

## ADDED Requirements

### Requirement: Explicit and isolated storage layout
The platform SHALL 仅显式初始化新的控制存储，核对目录与数据库身份，拒绝根目录交叉、非预期链接和未知非空目录，并保证单控制实例。

#### Scenario: Misconfigured or occupied roots
- **WHEN** 路径误配、布局身份不匹配或已有活动实例
- **THEN** 启动明确失败，不新建空库掩盖历史或覆盖现有内容

### Requirement: Publish bytes before successful references
The store SHALL 在成功提交内容与业务引用之前完成实际字节大小／哈希核实与不可变发布，并持久记录可恢复写入操作。

#### Scenario: Failure across publication and index commit
- **WHEN** 字节接收失败或发布后数据库提交／响应中断
- **THEN** 前者没有 READY 引用；后者按原键核实和完成唯一引用，完整孤立内容不导致重复消息

### Requirement: Durable sessions and authorized reads
The session store SHALL 将顺序消息、模型请求／完整回复和上下文快照绑定真实 Attempt，使用 READY 内容与同归属外键，附件可先于 Run 保存；读取以授权业务引用进入。

#### Scenario: Restart or cross-scope access
- **WHEN** 已保存消息后重启或其他主体尝试按同 hash／其他项目引用读取
- **THEN** 原消息与步骤保持可查询；无授权读取被拒绝，缺失内容明确阻断而不伪造正文

### Requirement: Rebuildable reading projections
The platform SHALL 从已提交索引和内容生成有源游标及校验值的 JSONL／manifest 阅读投影，投影不能修改或代替权威历史。

#### Scenario: Deleted or edited projection
- **WHEN** views 被删除或人工修改
- **THEN** 会话恢复仍从 DB 与内容读取，重新生成后顺序与正文和源游标一致
