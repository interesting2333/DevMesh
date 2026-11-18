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


### Requirement: Read-only event observation preserves editing
The browser SHALL validate exact project/Run frames, merge persisted events only in consecutive sequence order and bound future buffering and authorized HTTP gap reads. Transport loss, invalid frames or resync SHALL cancel the obsolete channel and reauthorize a fresh snapshot before reconnecting. Both failed network retries and repeated successful resnapshots followed by invalid protocol SHALL have bounded automatic budgets and an explicit retry path. Observation SHALL NOT issue business commands or replace drafts, immutable originals, input basis, selected tabs, focus or reading context.

#### Scenario: Real transport loses or reorders persisted events
- **WHEN** committed frames arrive duplicated or out of order, or the actual connection closes after a workspace snapshot
- **THEN** the browser SHALL deduplicate and fill an authorized bounded gap or resnapshot before reconnecting, retain user editing and submit no business command

#### Scenario: Successful resnapshot is repeatedly followed by invalid frames
- **WHEN** the automatic resnapshot budget is exhausted despite successful HTTP reads
- **THEN** the browser SHALL close obsolete transports and stop automatic attempts, expose explicit reconnection and retain user input without POST

#### Scenario: Idle event authorization is revoked
- **WHEN** the current event connection loses its trusted identity or project membership
- **THEN** the browser SHALL stop its observer and clear protected projections without deleting local original journals or posting drafts

### Requirement: Temporary model output has independent bounded lifetime

The system SHALL expose only content deltas from an explicitly enabled provider stream through a trusted internal publisher and an exact authorized project/Run channel. Temporary frames SHALL have independent stream identity and local index, consume bounded queue and text budgets, and SHALL NOT receive durable event sequence numbers or be replayed as persisted history. Tool execution and saved status SHALL require the complete validated response to be persisted first.

#### Scenario: A live stream disconnects or ends without a complete response
- **WHEN** a stream has a gap, exceeds its budget, loses transport or ends incompletely
- **THEN** the browser SHALL mark its temporary view interrupted, preserve editing and recover only authoritative saved progress; it SHALL NOT reconstruct missing tokens or issue model or business retries

#### Scenario: A completed response is saved while a user edits
- **WHEN** the actual model response commits successfully
- **THEN** the stream MAY show saved status while persistent business progress remains independently read, without changing input basis, original journals, selected tabs, focus or durable event cursor

#### Scenario: Authorization changes while temporary output is queued
- **WHEN** membership is revoked after queueing and before transmission
- **THEN** the service SHALL reauthorize before each frame and close unauthorized observation without sending protected content

### Requirement: Workbench visual hierarchy remains readable across viewports
The workbench SHALL distinguish project navigation, saved conversation and the fixed five-tab detail workspace with the user-approved graphite surfaces, flat separators, spacing and off-white primary actions. Inputs, draft errors, attachments and original recovery actions SHALL remain readable and reachable at a 390px viewport, without horizontal page overflow or changing business state through navigation.

#### Scenario: A user edits while viewing a narrow workspace
- **WHEN** the workbench switches between desktop and a 390px viewport or the user opens a detail tab
- **THEN** all region navigation and existing form controls SHALL remain reachable, and the current draft, exact execution context and original command identity SHALL be retained

#### Scenario: Desktop content exceeds the available panel height
- **WHEN** a desktop workspace has a long project list, draft or detail content, or its shared header changes height
- **THEN** the sidebar SHALL span the viewport, the main toolbar SHALL occupy its own row, and the output, composer and optional execution details SHALL fit their allocated viewport space; overflowing content SHALL remain reachable through its own region without hiding the composer

### Requirement: Task launch uses a persistent composer and optional execution details

工作台 SHALL 将新建首页作为任务发起点，在主区域上方显示输出、底部固定输入；需求理解、澄清回答、计划确认及模型临时输出在主区域。执行详情默认收起，桌面展开约320px，窄屏采用覆盖式抽屉；开关不得卸载当前草稿或附件。

#### Scenario: User launches with text, files or both
- **WHEN** 用户明确点击“发起任务”并提供文字、附件或两者
- **THEN** 系统按所选原附件身份查询／上传并核实全部READY后，按原草稿及全量附件快照登记并提交主请求；打开、选择、拖入或刷新不得自动POST

#### Scenario: Upload response is lost during explicit launch
- **WHEN** 附件已上传但回执丢失，用户刷新后再次明确发起
- **THEN** 系统保留原字节和身份并先查询同一原上传；核实已成功时复用准确附件，不重复建立上传身份，不省略未核实附件，主请求按原幂等规则创建一次

#### Scenario: Long output and collapsed execution details
- **WHEN** 输出增长或用户展开、收起执行详情
- **THEN** 输出独立滚动、输入持续可见；理解、澄清回答和计划确认在主区域保持可用，原草稿、附件、阅读偏好及只读边界保持

### Requirement: Default composer keeps auxiliary information on demand

系统 SHALL 默认仅展示任务正文、添加附件和发起操作，正常草稿保存静默；附件限制通过添加附件的提示可知，非法输入、保存失败和原操作恢复必须保持可达。上传记录 SHALL 经“更多 → 附件管理”打开，不改变原文件、主体隔离和幂等规则。

#### Scenario: Draft silently persists and an attachment is invalid
- **WHEN** 用户编辑需求或选择不符合要求的文件
- **THEN** 正常正文持久后可刷新恢复，非法文件保留且明确报错，不因为隐藏正常提示而吞掉错误或自动提交

### Requirement: Projects have default names and safe metadata renaming

系统 SHALL 沿用服务端默认名称且不要求创建前命名；owner/operator可在创建后更名，viewer及历史页面无更名入口。更名 SHALL 比较原名称并在既有操作事务内幂等提交，重放重新授权，不改变项目／Run的任务依据。

#### Scenario: Rename acknowledgement is lost
- **WHEN** 更名已提交但回执丢失，用户重开页面
- **THEN** 原更名UUID和正文保留，重开不自动发送，明确重试使用同一原请求；补充需求草稿保持不变

#### Scenario: Concurrent or unauthorized rename
- **WHEN** 两个编辑基于相同旧名称提交，或viewer／非成员提交更名
- **THEN** 并发更名仅一方成功，其他修改被拒绝；不覆盖新的名称，不改变执行版本或绕过成员检查


### Requirement: Approved dark workspace uses real project navigation

工作台 SHALL 使用固定石墨黑背景、平面侧栏和简洁顶栏。侧栏包含品牌、新建、已加载真实项目的名称过滤及设置入口；主输入保持左侧附件与右侧发起操作。不得把确认稿的示例项目预置到真实列表。

#### Scenario: User filters projects or uses the narrow composer
- **WHEN** 用户输入项目名称过滤词，或在390px宽度点击添加附件
- **THEN** 过滤只影响已加载项目的显示，不提交任务或丢失草稿；附件入口可实际触发文件选择且不与发起按钮重叠，输入和提交仍在视口内

#### Scenario: Operating system prefers a light theme
- **WHEN** 用户系统主题为浅色或切换深浅偏好
- **THEN** 工作台保持已确认的深色稿，执行详情与设置仍可打开、关闭并返回原输入


### Requirement: Empty task entry provides safe request examples

工作台 SHALL 在新建页展示业务系统、数据看板和展示网站需求示例；示例仅在可编辑的空白正文上填入本机草稿，并聚焦输入。已有正文、待核实原提交、关闭依据或保存异常不得被示例覆盖；所选附件保持，任务必须明确发起。

#### Scenario: User selects a request example with a file selected
- **WHEN** 用户在空白新项目输入中点击或键盘选用需求示例
- **THEN** 示例通过原草稿保存流程写入并可刷新恢复，所选文件保留，不发送业务命令或上传；已有正文时示例不可覆盖，390px宽度下示例及底部发起操作仍可达
