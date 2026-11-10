## Purpose

为工作台提供可核实的需求提交入口，在已认证主体和项目权限下保存原文及逐文件结果，通过持久去重、原子创建与一致 workspace 快照使断线重试回到同一项目，同时为后续理解、计划和执行保留准确的材料来源。

## ADDED Requirements

### Requirement: Explicit identity and current project authorization

输入 API MUST 从可信身份接入点取得主体，未配置身份时拒绝受保护请求，不接受客户端自报用户。项目权限 SHALL 每次以当前成员记录校验，owner/operator 可提交，viewer 只读；不可见的对象返回 404。企业认证未配置不得记录为已验收。

#### Scenario: Missing identity or another user's resource
- **WHEN** 未认证请求、伪造 principal 字段或无项目权限的用户请求项目、材料、operation 或事件
- **THEN** 拒绝请求且不返回隐藏对象内容，不产生业务写入

### Requirement: Bounded original input and independent attachments

首次输入 SHALL 保留最多 20,000 Unicode code point 的原文，正文或有效附件至少一项有实际内容；每次输入最多三个附件，每个为不超过 2 MiB 的非空 UTF-8 Markdown／纯文本。上传 MUST 逐文件核实，失败／移除不能覆盖其他成功材料。文件名不得决定物理路径，内容 hash 不授予读取权限。

#### Scenario: Invalid file alongside a valid file
- **WHEN** 用户的一份附件为空、超限、非法编码或中途断开，另一份已完成
- **THEN** 保留各自的成功／失败事实，未处理失败材料不能静默进入项目；移除失败项后可用原正文及成功材料提交

### Requirement: Atomic initial project admission

创建项目 SHALL 在一个事务中核实原操作键与 READY 附件归属，创建项目、成员、任务、唯一活动 Run、原始输入及附件引用、理解 operation、Outbox 与事件。文件读写、Git 与模型 MUST 在事务外；事务成功只表示材料保存与处理意图已持久，不能表示模型理解已完成。

#### Scenario: Lost creation acknowledgement
- **WHEN** 提交成功后响应丢失，客户端查询或重发相同主体／scope／键及相同材料
- **THEN** 返回原 operation 与同一项目／Run，事件和处理意图不重复；同键不同材料返回冲突

#### Scenario: Failure before commit or invalid attachment
- **WHEN** 附件不归属于主体、未 READY，或事务在提交前失败
- **THEN** 不留下部分项目、Run、输入、处理作业或事件；已上传成功的原文件仍可核实

### Requirement: Scoped command recovery and messages

操作查询 MUST 复核主体和作用域权限，支持按 ID 与原键核实。追加消息 SHALL 检查当前资源版本，原键重发优先返回原结果；正文、附件、解释意图和事件同事务保存，不自动应用变更或恢复暂停。已有项目的新任务 MUST 服从单活动 Run 与当前接受版本限制。

#### Scenario: Message saved while paused
- **WHEN** 有权限的用户向暂停 Run 提交有效消息并随后重试原键
- **THEN** 保留唯一原文和处理意图，返回原结果，Run 继续暂停且没有仓库实施

### Requirement: Consistent workspace and event cursor

workspace SHALL 在同一数据库读事务中返回所选项目／Run 的投影、版本、权限、允许动作和 eventCursor，明确 current/history；事件分页 MUST 限界且不可跨项目读取。正文通过快照中的不可变引用和当前权限读取，不能用现在版本补写历史事实。

#### Scenario: Concurrent snapshot and input commit
- **WHEN** 工作台读取快照时另一个合法输入同时提交
- **THEN** 快照与 cursor 对应同一个已提交时点，后续事件可从该 cursor 补取，历史上下文不会获得当前执行动作
