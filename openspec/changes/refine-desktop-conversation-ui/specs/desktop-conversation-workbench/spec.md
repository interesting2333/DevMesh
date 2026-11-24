## ADDED Requirements
### Requirement: Complete execution detail navigation
The conversation workbench SHALL provide Overview, Collaboration, Results, Preview and Records tabs in execution details, using saved facts from the selected conversation and its exact Run.
#### Scenario: Inspect without leaving the conversation
- **WHEN** the user switches between the five detail tabs
- **THEN** the corresponding real content or an explicit empty state is shown without submitting commands or replacing the conversation draft
#### Scenario: Review a plan from another detail tab
- **WHEN** the user opens the full plan from the conversation
- **THEN** execution details selects the Overview tab and displays the current plan

### Requirement: Understandable mode selection
The composer SHALL explain plan and execute choices, preserve the current saved mode and report unavailable execution conditions without claiming execution has started.
#### Scenario: Choose a mode for the next message
- **WHEN** the user chooses a mode with pointer or keyboard
- **THEN** only the local draft mode changes until the user sends a message, and the active task is not immediately paused or restarted

### Requirement: Readable desktop conversation
The workbench SHALL align readable conversation text and its composer, allow desktop navigation collapse and preserve history reading position while reporting new replies.
#### Scenario: User reads history
- **WHEN** another reply arrives while the user is reading earlier messages
- **THEN** the view preserves the scroll position and offers a return to the latest reply

### Requirement: Exact plan decision
The workbench SHALL show the actual current plan and confirm only its displayed version and input basis through one persistent command.
#### Scenario: Displayed plan becomes stale
- **WHEN** the input or reviewed plan basis changes before confirmation
- **THEN** the command is rejected without recording a plan decision or starting execution

### Requirement: Recoverable conversation title
The workbench SHALL persist original rename commands and preserve manual titles over automatic goal titles.
#### Scenario: Rename acknowledgement is lost
- **WHEN** a rename response is lost and the page is refreshed
- **THEN** the original command remains available for lookup and recovery without automatic mutation on refresh
### Requirement: 明确执行详情的职责
工作台 SHALL 显示概览、协作、成果、预览、记录五个页签；概览优先呈现阶段、已知待办与工作状态，需求和完整方案默认折叠；完整方案入口 SHALL 展开同一方案。

#### Scenario: 同一候选跨成果与预览
- **WHEN** 用户在成果选择候选并查看效果
- **THEN** 预览 SHALL 使用同一候选，展示受保护读取的真实状态和专用管理入口，不重复接受、审查和导出区域；新候选不得自动替换用户选择。

#### Scenario: 未接入的协作信息
- **WHEN** 缺少交接或工具读取投影
- **THEN** 协作 SHALL 明确说明未接入，不推断零记录或模拟 Agent 活动；需求变更位于概览。

#### Scenario: 阅读执行事件
- **WHEN** 用户打开记录
- **THEN** 记录 SHALL 展示准确 Run 的最近事件及范围，未知类型保留原类型名称；聊天正文通过定位查看，不复制全文，不宣称完整回放。

#### Scenario: 保存与隔离阅读状态
- **WHEN** 用户切页、关闭、刷新或切换会话
- **THEN** 页签、候选和阅读位置 SHALL 按主体／会话／执行隔离保存，草稿和原提交不变；迟到读取及撤权不得留下旧执行内容，查看 SHALL 不触发业务写操作。

### Requirement: 精简详情上下文
执行详情 SHALL 在普通状态下直接呈现页签，不重复主顶栏任务名、等待输入和常驻模式文案；需要审阅、补充、恢复或处理执行条件时 SHALL 提供准确提示与适用动作。

#### Scenario: 查看普通对话
- **WHEN** 用户打开无需注意事项的执行详情
- **THEN** 标题后直接显示页签，草稿与附件保留，任务控制在底部按原权限提供。

#### Scenario: 处理需要注意的状态
- **WHEN** 任务等待确认或已暂停
- **THEN** 详情分别提供定位主区方案或恢复任务的入口，不以查看动作触发业务提交。

### Requirement: 常规对话输入快捷键
新旧对话输入框 SHALL 使用 Enter 发送、Shift+Enter 换行，并保留 Ctrl／Cmd+Enter 兼容；键盘发送 SHALL 经过与发送按钮相同的有效性及可用性检查。

#### Scenario: 发送多行消息
- **WHEN** 用户通过 Shift+Enter 输入多行正文，再按 Enter
- **THEN** 系统 SHALL 保留正文中的换行，并通过原发送流程提交一次。

#### Scenario: 避免误发
- **WHEN** 输入法处于组字／确认候选词、回车键重复、正文为空或发送按钮不可用
- **THEN** 系统 SHALL 不因此创建新的发送请求，已输入正文和附件保持原发送语义。
