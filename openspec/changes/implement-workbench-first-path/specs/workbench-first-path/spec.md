## Purpose

为授权成员提供从空项目输入到理解、计划、执行观察、交付审查和接受入口的连续工作台，明确服务端事实、本机未提交草稿和未知提交的差别，并在刷新、多页、权限变化和事件重连时保持准确上下文与原操作身份。

## ADDED Requirements

### Requirement: Protected workbench shows authoritative context

系统 SHALL 对工作台页面、脚本和业务读取应用当前身份与项目权限，显示准确项目／执行／模式及服务端允许动作；历史上下文 MUST 从命令依赖层只读，打开页面不得创建项目、命令、票据、预览或接受。

#### Scenario: Identity is absent or membership is revoked
- **WHEN** 身份未配置、无权限或读取过程中成员被移除
- **THEN** 系统关闭相应入口或清除受保护显示，不授予默认owner或使用游标恢复权限

#### Scenario: Historical execution is opened
- **WHEN** 用户选择历史Run
- **THEN** 三栏共享历史上下文且没有可用写客户端；切换前的迟到响应不能写入新上下文

#### Scenario: Account changes while an original local request exists
- **WHEN** 旧页面主体与当前服务端身份已不同
- **THEN** 旧页面请求在执行前被拒绝，不把旧主体的草稿或原信封作为新身份提交；重进按新主体加载本地上下文

### Requirement: Draft persistence is scoped and conflict aware

系统 SHALL 按主体、项目、Run、表单和依据隔离本机草稿，在持久事务完成后才显示本地已保存；陈旧页保存 MUST 检测本地版本冲突，不静默覆盖其他页。服务端提交成功与本地草稿保存 MUST 分别显示。

#### Scenario: Refresh restores only the matching draft
- **WHEN** 用户输入后刷新或切换到另一个项目／账号／依据
- **THEN** 相同上下文恢复持久正文，不把旧上下文内容写入新表单或自动提交旧依据

#### Scenario: Storage fails or two pages edit concurrently
- **WHEN** 持久写失败或另一页已更新相同草稿
- **THEN** 保留本页内存输入并显示未保存／冲突；切换或离开须先成功保存或由用户明确放弃

### Requirement: Original command is durable before sending

系统 SHALL 在网络写之前持久保存经严格验证的原主体、上下文、UUID、正文和版本条件，事务性核实准确草稿版本和未决状态。相同上下文多个页竞争提交 MUST 只登记一个原命令，不能覆盖原信封或生成未知请求的替代键。

#### Scenario: Persistence is denied before submission
- **WHEN** 本机无法提交原请求事务
- **THEN** 系统不发送业务写请求，输入保留且明确显示失败

#### Scenario: A reply is lost and the page reopens
- **WHEN** 提交已发送但结果未知，用户刷新或重新进入
- **THEN** 页面保留原请求且不自动POST，先核实原操作；明确继续提交只能使用完全相同原信封，未决期间禁止新键提交

#### Scenario: 明确关闭已核实过期且不存在的Run原提交
- **WHEN** 用户明确要求关闭原消息／回答／计划确认，准确授权Run读取显示版本高于原条件，随后原键查询以受保护的200结果明确返回准确主体／scope／key及operation:null（不接受404）
- **THEN** 系统事务CAS保存独立关闭事实并释放准确未决锁，保留原请求和旧草稿；不生成成功回执、不自动复制／新建请求或POST

#### Scenario: 关闭核实遇到已提交、未知或并发观察
- **WHEN** 原键已有操作、权限／网络核实失败，或另一页已观察／关闭同一原提交
- **THEN** 系统观察原操作或拒绝关闭，不能覆盖成功、删除原内容或仅凭一次404解锁

#### Scenario: Original lookup returns not found
- **WHEN** 当前未查到原操作
- **THEN** 页面不把缺少记录当作新键许可，不自动更改正文、版本条件或提交身份

#### Scenario: New form is unavailable but its original request remains pending
- **WHEN** 当前非viewer的准确Run关闭新消息准入，或原确认／回答所需的计划／问题依据成为历史或不可读
- **THEN** 系统 SHALL 按准确主体／项目／Run／表单显示独立原提交恢复区域，验证原日记与草稿指针，允许显式原键核实／同信封重试／符合条件的明确关闭；该区域不得登记新请求或提供新确认／回答，历史Run和viewer不挂载命令客户端

### Requirement: Attachment selection preserves original upload facts

系统 SHALL 在同一原生本地数据库事务中保存文件准确字节、原上传 UUID／clientAttachmentId／metadata／hash 与准确草稿选择，本地版本冲突或事务失败 MUST 保留原草稿。升级保留版本 1 的草稿及命令日记；未知上传不得自动重发、替换或释放文件内容。

#### Scenario: Attachment upload succeeds but its reply is lost
- **WHEN** 文件已按原身份上传成功但客户端未收到回执并重新进入
- **THEN** 本地保留准确原字节／上传身份／草稿选择且不自动 POST，可查询原操作及准确附件；成功原操作与实际 READY 元数据核对后，主输入事务冻结准确附件 ID，不能漏为无附件或使用其他主体的附件

#### Scenario: Selected file is unresolved, removed, stale or corrupt
- **WHEN** 选择中存在未知上传、REMOVED 状态、并发修改的映射或 hash 不符的本机文件
- **THEN** 主命令入队被拒绝，原草稿和上传保留；解除选择独立于服务端删除，明确成功／失败后方可显式释放本机内容并保留原日记

### Requirement: Navigation and keyboard preserve user work

系统 SHALL 提供三栏和任务、协作、成果、预览、记录五页签，以及窄屏导航／主区／详情切换；导航和事件更新不得覆盖未提交输入、选择、阅读位置或抢焦点。多行Enter换行，Ctrl／Cmd+Enter可提交，输入法组合和重复键 MUST 不触发发送。

#### Scenario: User navigates while a draft save is pending
- **WHEN** 用户切换项目／执行或关闭修改表单
- **THEN** 系统先排空该上下文保存，失败保留原输入并提供明确处置；不静默切走丢失内容

#### Scenario: Narrow screen receives events during composition
- **WHEN** 用户在窄屏使用输入法且新事件到达
- **THEN** 当前输入和焦点保持，组合中的快捷键不提交，关键待办与执行入口仍可使用

### Requirement: Events resume from an exact snapshot

系统 SHALL 使用同一快照返回的seq续读，按连续seq去重补发，不用文本推断状态；正式实时订阅 MUST 先建立有界缓冲再补历史，慢客户端明确resync并重快照。授权失效、上下文切换或超前／缺口游标不得被当成完整回放。

#### Scenario: Connection drops between snapshot and subscription
- **WHEN** 快照读取后发生新事件且连接重建
- **THEN** 客户端恢复连续序列，不遗漏、不重复应用，不重置草稿或执行重复命令

### Requirement: Protected event host bounds transport and replay

The host SHALL attach `/events` to its actual HTTP server, require exact same-origin upgrade and the configured trusted identity, and authorize the exact project/Run before upgrading. Subscription parameters SHALL carry context and cursor only; the expected principal SHALL constrain the current identity and SHALL NOT act as a credential. The server SHALL subscribe to bounded payload-free commit notifications before reading authorized persisted history, validate consecutive sequence numbers, and reauthorize after asynchronous reads before exposing facts.

#### Scenario: Membership or account changes during replay or idle subscription
- **WHEN** current membership disappears or the trusted resolver returns another principal
- **THEN** the server SHALL send an authorization-lost control when transport permits, close the connection, and expose no facts from the earlier pending read

#### Scenario: Replay or transport exceeds a limit
- **WHEN** the cursor is ahead, retained history has a gap, initial catchup exceeds its limit, pending commit notifications overflow, or sends exceed their byte/deadline budget
- **THEN** the server SHALL require resnapshot and close within its bounded transport-close allowance; it SHALL NOT claim complete catchup or retain an unbounded queue

#### Scenario: Event service stops
- **WHEN** the host stops
- **THEN** it SHALL reject new upgrades, abort pending identity reads, unsubscribe and close active transports, drain their pumps before closing storage, and retain all durable event facts for a later authorized reconnect

#### Scenario: Client tries to execute a command over the event socket
- **WHEN** any application message is received from the client
- **THEN** the server SHALL close the read-only subscription without creating domain commands or events

### Requirement: First path links real planning and delivery facts

系统 SHALL 从准确工作台上下文展示真实理解、问题、计划／DAG／来源以及已有审查、预览、接受和导出入口，区分分析等待、验证、人工记录、接受和发布。没有模型或执行资源时 MUST 显示实际未配置／等待事实，不能用模拟结果完成产品验收。

#### Scenario: New project is submitted without external model resources
- **WHEN** 用户从空项目提交输入但模型／Runner未配置
- **THEN** 已提交输入可刷新恢复，后续仅展示实际已存在事实与未满足条件，不能伪造计划或发布成功

#### Scenario: Reader follows a stored source
- **WHEN** 从理解、问题或计划打开消息、材料或准确需求版本来源
- **THEN** 当前成员与准确Run归属被核实，材料ID及hash必须对应已保存引用；原内容有界读取且响应前重新检查权限，同一详情栈可返回，不读取任意磁盘路径或未引用内部材料

#### Scenario: Plan review has changed or its reply is lost
- **WHEN** 用户明确确认已审阅计划后发生版本冲突或丢失回执
- **THEN** 原确认UUID、版本、审阅hash与继承依据被持久保留；重进不自动确认或替换原键，核实成功只表示原计划已确认，不表示实施或发布完成

#### Scenario: Question answer is stale or its acknowledgement is lost
- **WHEN** 用户填写准确版本的问题回答后刷新、遭遇条件冲突或丢失回执
- **THEN** 系统保留原答案／问题版本与Run条件，不自动采用默认选项或发送；先持久后提交，原键核实可恢复已回答问题的唯一提交，切换失败时保留本页未保存答案

### Requirement: Committed original results survive workspace refresh

The workbench SHALL retain feedback for a locally committed successful original receipt or verified closure across workspace refresh and child-form remount, independently of refresh progress or failure. It SHALL clear that feedback on context navigation or lost identity or permission, and SHALL reject callbacks from an obsolete context. The feedback SHALL describe only the committed original result and SHALL NOT imply downstream execution success or initiate another POST.

#### Scenario: Confirmed original remains visible after a real workspace refresh

- **WHEN** an authorized user explicitly retries an original plan confirmation while the current plan view is unreadable and the actual successful response has been committed locally
- **THEN** the workbench retains the original success feedback after the actual workspace refresh completes, retains the exact envelope and successful receipt, and creates only one confirmation without starting an implementation attempt

#### Scenario: Saved original result remains visible across mobile panels

- **WHEN** the original successful receipt has been committed and the user switches between project, input and detail panels at a 390px viewport
- **THEN** exactly one committed-result status remains visible in the shared header, the layout does not overflow horizontally and switching panels does not issue another confirmation POST

#### Scenario: Planning read fails before a plan is available

- **WHEN** reading the current planning projection fails and no readable plan is available
- **THEN** the page reports the plan as temporarily unreadable and does not assert that no saved plan exists

### Requirement: Permanently removed attachment originals can close without losing input

The workbench SHALL preserve the complete immutable project/message original and draft snapshot when explicitly closing a pending original proven impossible by permanent attachment removal. It SHALL first read the exact protected REMOVED attachment and then the exact principal/scope/key positive absence with200;404, non200, unknown operation or failed authorization SHALL NOT release the lock. The native closure SHALL compare the complete original observation, pending index and draft atomically, retain the original input and record a separate closure without inventing success.

#### Scenario: User explicitly starts blank after verified removal closure

- **WHEN** the user explicitly starts blank from an exactly matching removed closure and draft, including a message whose Run basis did not advance
- **THEN** a native CAS creates a fresh input identity with empty fields and selection at a greater local revision, retains the full closed original and does not copy or POST input automatically

#### Scenario: Current input succeeds after an older original was closed

- **WHEN** a later input succeeds or the user reopens the project/message context or an old-basis draft reference
- **THEN** the closed original remains discoverable through bounded immutable history links, each checked for exact principal/context and decreasing original draft rank across pagination; missing, foreign or cyclic links fail explicitly

#### Scenario: Another page changes the original during verification

- **WHEN** another page observes an operation, closes the same original, changes the draft or starts blank before the native CAS
- **THEN** the stale action fails without replacing that observation, clearing history, inventing a receipt or sending another request


### Requirement: Explicit original attachment controls
The workbench SHALL retain a chosen File until its exact bytes, immutable upload identity and draft selection commit atomically. It SHALL send uploads only by explicit user action, preserve unknown originals, and freeze main input only after protected exact metadata observations and native snapshot CAS.

#### Scenario: File admission fails locally
- **WHEN** validation, quota, native abort or a competing draft update prevents attachment admission
- **THEN** the page SHALL retain the unsaved File, block navigation and main submission, and allow explicit retry or confirmed discard without HTTP upload

#### Scenario: Upload acknowledgement is lost
- **WHEN** an original upload may have committed but its acknowledgement is unavailable
- **THEN** reload SHALL not POST automatically, and explicit lookup or retry SHALL preserve its exact original identity and bytes

#### Scenario: Main input rechecks selected material
- **WHEN** a selected attachment is unknown, removed, unreadable, foreign or changes concurrently
- **THEN** no attachment SHALL be silently omitted and no main original SHALL be admitted from stale upload snapshots

#### Scenario: Reuse from the local upload library
- **WHEN** a user explicitly reuses available bytes of a known upload result
- **THEN** a fresh upload identity SHALL be created and the prior journal SHALL remain, without directly selecting an old possibly bound attachment ID

#### Scenario: Releasing local bytes
- **WHEN** a known-result original file is explicitly released
- **THEN** the upload identity, hash and receipt SHALL remain, and unknown-result original bytes SHALL never be released by this action


### Requirement: Task originals bind project and accepted release
The local journal SHALL isolate task drafts by principal, project, project revision and accepted release, keep task intent separate from Run input, and freeze the exact project-scoped create-task envelope before sending. One pending task SHALL lock all task bases for the same principal and project.

#### Scenario: A new Run exists after task acknowledgement loss
- **WHEN** the exact task may already have created a Run and fresh createTask admission is unavailable
- **THEN** project-scoped original lookup and explicit exact replay SHALL retain the original identity and recover one task; no reload SHALL POST automatically

#### Scenario: Task success is observed
- **WHEN** a successful receipt has the exact project, a new Run at revision1, project revision equal to original basis plus1 and all task, message and understanding-operation identifiers
- **THEN** the native transaction SHALL release only that task lock, clear only that exact draft and retain the immutable envelope; mismatched results SHALL preserve the lock

#### Scenario: A task original has an obsolete project basis
- **WHEN** an authorized current project at a strictly greater revision is read before exact principal/project/key positive absence
- **THEN** explicit closure SHALL compare the full command and draft snapshot atomically and retain the complete original; Run proofs, inconclusive reads and observed unknown operations SHALL NOT close it

#### Scenario: An original task attachment is permanently removed
- **WHEN** ordered exact removal and positive absence are verified for the task original
- **THEN** full native CAS closure and explicit blank start SHALL retain task fields, selection and identity in immutable history while a new blank receives a distinct input identity

#### Scenario: Next target is drafted before the first accepted release
- **WHEN** the current project still has no accepted release
- **THEN** an isolated task draft SHALL remain saveable with an explicit null release basis, but SHALL NOT enqueue a create-task original; switching later to a real accepted release SHALL require explicit review


### Requirement: Separate next-target UI and original task recovery
The protected workbench SHALL isolate the next target from current Run input, persist its kind, title, goal and selected material, and use guarded explicit switching. Current nonviewer users MAY draft during active execution or before an accepted release; fresh task submission SHALL require the exact current accepted project basis and server admission.

#### Scenario: Project changes before a fresh task freeze
- **WHEN** the protected current-project recheck finds a newer project, different accepted release or closed createTask admission
- **THEN** the page SHALL retain the target and material without a native task command or task POST, and SHALL require explicit current-basis review

#### Scenario: Pending task remains after fresh createTask disappears
- **WHEN** a task acknowledgement is lost and a new Run already exists
- **THEN** the authorized current project SHALL expose its exact project-scoped original recovery, never POST on reload, and enter only the new Run returned by the verified original receipt

#### Scenario: Native target saving fails
- **WHEN** a task draft transaction aborts or the chosen File remains unsaved
- **THEN** the page SHALL retain task fields and memory input, block switching, and allow explicit retry or discard without HTTP submission

#### Scenario: Task history and authority
- **WHEN** a task original closes from a verified stale-project or removed-attachment proof
- **THEN** its complete target and original history SHALL remain readable through explicit task references; history and viewer pages SHALL mount no task command client


### Requirement: Exact delivery navigation preserves the launching workspace
The workbench SHALL list authoritative frozen candidates for its exact authorized Run with bounded ordered revision pagination and explicit selection. The project's accepted release SHALL retain its own Run and candidate identity independently of the displayed Run. Opening existing review, preview management, acceptance, release and export pages SHALL use GET without creating business effects.

#### Scenario: A member selects a frozen candidate
- **WHEN** the member explicitly opens a selected candidate from the workbench
- **THEN** its exact Run/candidate SHALL be preserved, stale qualification SHALL remain visible, and concurrent basis or membership changes SHALL prevent mixed or unauthorized facts

#### Scenario: Return follows a release from another Run
- **WHEN** the current workspace opens a previously accepted release owned by an earlier Run
- **THEN** the target SHALL remain bound to that release's actual Run while a valid principal/project/target-scoped launch record MAY restore the original workspace Run and its reading selection after protected reauthorization

#### Scenario: Saving the return position fails
- **WHEN** input guards, an unsaved File or session reading-state persistence prevents safe navigation
- **THEN** the workbench SHALL retain the current page and input, allow explicit retry or discard as appropriate, and SHALL NOT navigate or create a business command

#### Scenario: A return record is absent, damaged, foreign or expired
- **WHEN** a dedicated protected page cannot validate the bounded session launch record
- **THEN** it SHALL retain the server-derived canonical target-Run return link, accept no arbitrary return URL and grant no access from browser state

#### Scenario: Saved candidate selection cannot be read
- **WHEN** a stored selection is unavailable or inconsistent with the exact Run
- **THEN** the page SHALL allow an explicit reset of reading selection only, preserve command and draft journals, and never silently choose a different candidate
