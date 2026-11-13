## Purpose

提供准确候选上的逐项人工审查、隔离预览与业务数据准备，并在满足原质量、审查和数据条件时原子保存接受事实。把候选就绪、人工通过、版本接受和实际发布分别呈现，保障中断后恢复原操作以及业务数据保留。

## ADDED Requirements

### Requirement: Trusted abort consumer preserves original cleanup authority
The system SHALL consume only already recorded original abort decisions without a completion, under explicit trusted project/policy/backend/Runner bindings. New acceptance configuration and current owner membership SHALL NOT be prerequisites for the original backend to recover an already authorized abort. Missing physical evidence MUST retain ABORTING; no replacement preparation or deletion of the dataset is permitted.

#### Scenario: Original abort recovery and acknowledgement loss
- **WHEN** a trusted host resumes unresolved abort work after a lost acknowledgement or restart
- **THEN** it uses the same original decision, service cleanup stages, data revocation journal and completion writer
- **AND** completed history does not occupy work pages, the target gate stays closed, and any source reopening requires the existing exact ownership, fresh health and unknown-write checks

#### Scenario: Stop and timed-out Worker retain unfinished authority
- **WHEN** the host stops or a data Worker exits while an external authority call remains active
- **THEN** new stage and final authorization close on stop, active calls drain before storage closes or their worker slot is released
- **AND** Worker exit alone does not establish physical completion or cancel an external side effect

### Requirement: Trusted publication consumer preserves accepted facts and original stages

The platform SHALL install publication consumption only through explicitly configured trusted project/policy/backend/Runner bindings verified against the original registered policy. It SHALL scan bounded current unresolved accepted publications, exclude published and superseded history, coalesce passes and serialize each project with bounded cross-project concurrency. Publication recovery SHALL remain available to its explicitly configured original backend when new acceptance entry is disabled.

#### Scenario: Original publication continues after failure or lost acknowledgement
- **WHEN** an original dispatch, stage or observation acknowledgement is lost or a route remains unavailable
- **THEN** recovery inspects the same Release and continues only authorized original unstarted stages with unique durable grants, retains T5 and accepted history, performs no data initialization or migration and opens no gate without the complete writer-verified publication proof

#### Scenario: Shutdown closes publication and continuation authorization
- **WHEN** publication consumption stops during preflight, inspection or an active backend call
- **THEN** no new publish or resume authorization is granted and storage closes only after the active original call has drained

### Requirement: Trusted acceptance preparation consumer is bounded and opt in

The platform SHALL consume acceptance preparations only through explicitly installed trusted backends whose project, registered policy, backend principal, backend reference and Runner bindings match the startup policy snapshot. Missing configuration SHALL cause no acceptance scanning or dispatch. The consumer SHALL use bounded unresolved-work pages, exclude closed, aborted and committed originals, coalesce concurrent passes and retain bounded per-project serialization and cross-project concurrency.

#### Scenario: Original work survives history and acknowledgement loss
- **WHEN** terminal history precedes a current unresolved preparation or a prior dispatch or observation acknowledgement was lost
- **THEN** the trusted consumer finds only its original unresolved work, obtains at most one preparation dispatch grant and inspects SENT or UNKNOWN originals without creating replacement effects, accepting T5 or publishing

#### Scenario: Health observation and shutdown remain independent of page reads
- **WHEN** a trusted preparation consumer runs or is stopped during preflight or an active backend call
- **THEN** current health is refreshed only by explicit backend inspection, page GET does not refresh it, stop prevents new dispatch authorization and drains active work before storage closes

### Requirement: T5 atomically records exact acceptance and pending publication

The system SHALL 在一个本地 writer 事务内保存准确原准备／证明／最新观察上的 Release、项目指针 CAS、必要人工 Work 完成、Run COMPLETED、操作结果、专用 promotion Outbox 和事件。新接受 MUST 复核当前 owner、候选／审查／数据方案／Run 代际、READY 内容、当前新鲜 fence／HELD 健康及无未知写。事务 MUST NOT 等待外部文件或 HTTP。原幂等成功恢复 MUST 先于终态／过期检查并仍核实当前权限。

#### Scenario: T5 fails at a persistence boundary
- **WHEN** Release、指针、人工完成、Run、提交结论、发布意图、事件或操作结果写入失败
- **THEN** 全部事实回滚，原准备与原自动评估保持原样，不留下部分接受或重复发布任务

#### Scenario: Acceptance commits but its acknowledgement is lost
- **WHEN** 同一原键在重启、健康过期或 Run 终态后重试
- **THEN** 当前 owner 恢复同一原操作／Release／待发布结果；不同正文拒绝，撤销权限后不返回受保护结果

#### Scenario: Human completion resolves a final pending Work
- **WHEN** 全部自动事实已通过且只有冻结的必要人工项等待，准确候选人工审查全部通过
- **THEN** 接受事务追加准确原人工完成覆盖层并完成 Attempt、释放 slot；自动 assessment／质量及原候选字节保持不变

#### Scenario: A committed preparation no longer blocks a later acceptance
- **WHEN** 项目存在已提交原准备或明确从未派发的失败准备
- **THEN** 新准备可按当前项目与 Run 依据竞争准入；SENT／UNKNOWN 且没有提交结论的准备仍互斥阻塞，不删除历史或伪装失败

#### Scenario: Publication fails after acceptance
- **WHEN** 原接受事务已提交而后续发布或导出尚未完成
- **THEN** 保留原 Release 与 COMPLETED，专用原发布意图继续待处理；普通 A2A Outbox 不派发该任务，不自动重新接受

#### Scenario: A legacy preview claim is presented for a new commit
- **WHEN** 历史准备证明仍可读，但服务 claim 只有旧预览用途
- **THEN** 新 T5 提交拒绝替代 ACCEPTANCE 服务 claim，不改写旧证明或伪造新用途

### Requirement: Acceptance services use original purpose and shared Runner admission

The system SHALL 为 ACCEPTANCE 服务保存独立原请求、数据回执／fences、profile 和容器动作日志，不伪造 PREVIEW effect。作业、预览和接受服务 MUST 同事务核实全局 slot／CPU／内存与跨用途 dataset 独占。原请求及完整归属不可覆盖；UNKNOWN 不释放资源，只有从未派发取消或准确原实例 EXITED 才释放。

#### Scenario: Acceptance service races with preview or job admission
- **WHEN** 接受服务与作业／预览争抢最后容量或相同 dataset
- **THEN** 同一个 Runner writer 至多准入预算内原对象，跨 controller 不绕过占用；重启及未知实例仍计入

#### Scenario: Original service action or hold loses acknowledgement
- **WHEN** 原服务唯一动作许可、执行或 RELEASE_HELD 提交丢 ACK
- **THEN** 重试只查询原动作和原对象，不再次派发、不按新配置替代 profile；准确 claim 恢复同一归属，HELD 不表示 T5 或接受完成

#### Scenario: Preview cleanup encounters an acceptance service
- **WHEN** 预览到期或清理扫描与接受服务同时存在
- **THEN** 接受服务不属于预览扫描用途；其原 release／candidate／review／数据／镜像／reservation／实例均以独立 claim 核验，不能借用预览 TTL 或停止操作

### Requirement: Trusted acceptance composition retains an exact read-only service and stable proof

The system SHALL 将原接受请求、实际数据回执及当前物理 fences 与用途独立的只读服务装配，不伪造预览 effect。新容器动作 MUST 具有原持久唯一许可，并在外部动作前复核当前授权及原 fence；恢复 MUST 只检查原对象。首次完整证明 MUST 持久保存且不可替换，当前健康与不可变原证明分开。

#### Scenario: Exact read-only service reaches held readiness
- **WHEN** 显式可信后端已核实原数据、准确 OCI／目录／网络／实例及实际 HTTP 健康
- **THEN** 取得准确 RELEASE_HELD 并持久保存完整原证明；整个接受 dataset 只读挂载，普通预览的可写参数不能通过核验

#### Scenario: Prepared proof acknowledgement is lost before restart
- **WHEN** 首份完整证明保存后丢 ACK，随后服务重启或后续心跳推进归属观察版本
- **THEN** 返回同一 preparedAt／custodyRevision／proofHash，当前健康另行核实；证明保存失败不留下半份，旧历史不伪造回填

#### Scenario: Original action, authority or fence becomes uncertain
- **WHEN** 原 network／create／start 许可或结果未知，或者授权失效、物理 fence 换代、原实例／profile／端点不匹配
- **THEN** 只核实原对象并关闭 READY，不补发、替代或重新 acquire fence；缺 Linux／硬配额／网络隔离配置不得派发

#### Scenario: Read-only preparation cannot be declared writable by a logical gate
- **WHEN** T5 已提交且准备实例仍保持原不可变只读挂载／APP_READ_ONLY
- **THEN** 发布必须另行核实准确归属下的可写服务转换、健康与写 fence 交接；仅开放逻辑门不能宣称应用可写，不修改原准备 profile／proof 或同时放开旧新 dataset

### Requirement: Dataset preparation retains its actual purpose and origin

The system SHALL 用不可变公共归属绑定每个 dataset 的真实准备 operation、requestHash、项目、策略及 PREVIEW／ACCEPTANCE 用途。接受准备 MUST 使用自己的原操作和策略，初始逻辑写门关闭；登记元数据不得声称业务文件或物理 fencing 已完成。REPLACE MUST 保留基线 release 且不虚构复制来源。迁移 MUST 保留旧写门、访问和历史，失败全部回滚并恢复外键检查。

#### Scenario: Acceptance target has an independent original identity
- **WHEN** 接受准备意图提交或原键恢复
- **THEN** 目标元数据、通用归属和初始关闭门同事务保留，原预览记录不被复用，不新建预览 effect；后续未知观察不能开放该门

#### Scenario: Closing the original accepted source loses its acknowledgement
- **WHEN** 准确后端关闭原准备指定的源门，随后丢回执或重启
- **THEN** 恢复同一闭门请求、fence 和历史；错误主体、来源或版本拒绝，逻辑闭门不作为排空或物理 fence 证明，超时不重开

### Requirement: Exact candidate review with immutable human observations

The system SHALL 从准确冻结候选及原需求生成完整必要审查集合，区分原自动事实与人工结论。人工结果 MUST 绑定候选 revision／manifest、检查依据、操作者、操作、预期、观察和时间，追加保存并采用权限、幂等及当前记录 CAS。未知项、任意 N/A、用人工覆盖自动失败或对陈旧候选新批准 SHALL 被拒绝。

#### Scenario: A necessary item is missing or failed
- **WHEN** 某必要需求项未检查、人工失败或原自动质量未通过
- **THEN** 逐项显示该状态和依据，完整审查不得显示 PASS，不开放接受

#### Scenario: Candidate changes during review
- **WHEN** 源码、计划、材料、候选版本或有效依据变化，随后提交原审查或旧 reviewHash
- **THEN** 拒绝新结论／接受并显示 STALE，历史原结论保持可读且不迁移到新候选

#### Scenario: Concurrent correction and lost acknowledgement
- **WHEN** 两个不同操作基于同一当前记录提交相反结论，或原成功操作丢回执后重试
- **THEN** 仅一个 CAS 修改成功，历史不覆盖；原成功操作恢复同一记录，成员被撤销后不再返回受保护内容

### Requirement: Isolated preview and durable dataset lifecycle

The system SHALL 将生成应用置于独立 origin 和独立业务 dataset，绑定准确候选、镜像和数据来源。迭代预览 MUST 使用隔离快照，停止／到期与数据保留分开。访问 MUST 验证项目权限、用途、期限及状态，不能转交平台身份或允许任意目标代理。

#### Scenario: Preview writes and expiry
- **WHEN** 用户向预览写入业务记录，然后预览到期或被取消
- **THEN** 原已接受数据不被改写，准确实例停止，源码／报告／历史与按策略保留的数据仍存在，旧已接受实例不被连带停止

#### Scenario: Wrong audience or origin
- **WHEN** 平台 origin 被配置为预览目标，或访问凭据用途／项目／预览／期限不匹配
- **THEN** 配置或访问被拒绝，平台 Cookie 和身份不发送给生成应用

#### Scenario: Durable intent and uncertain original effect
- **WHEN** dataset／预览意图已经提交，首次派发后丢失回执或服务重启
- **THEN** 原键恢复同一资源与原操作；只有首次 PREPARED 派发获得执行许可，SENT／UNKNOWN 只查询原对象，未核实前拒绝新建替代对象，不把意图提交称为启动完成

#### Scenario: Wrong backend receipt or accepted instance cleanup
- **WHEN** 非配置后端、不同 requestHash／image／dataset／instance 的回执到达，或停止意图指向已接受版本
- **THEN** 拒绝改变原执行事实或派发停止，保留原数据和版本归属；观察／对象状态／事件失败时全部回滚

#### Scenario: An earlier successful start no longer proves current availability
- **WHEN** 原启动成功后没有新鲜健康观察、实际检查失败或原实例失联
- **THEN** 保留不可变的原启动成功事实，但关闭当前可用性；持续检查原实例，恢复时不新建替代实例或修改原完成回执

#### Scenario: A delayed health observation attempts to replace a newer fact
- **WHEN** 慢响应使用旧 sequence 或更早时间提交，或者观察试图替代已经核实的实例／端口
- **THEN** 拒绝写入，保留准确较新事实；历史、实例绑定、状态与事件保持原子，不通过健康心跳覆盖用户操作版本

#### Scenario: An unaccepted preview expires during recovery
- **WHEN** 原实例已核实且预览到期，或到期时原实例仍未知
- **THEN** 只对已核实的原未接受实例建立一个持久停止操作并核实退出或独立 REMOVED 证明；未知实例继续查询，已接受版本／数据不被停止，不把意图或超时当作已退出

#### Scenario: Jobs and previews compete for one Runner capacity
- **WHEN** 作业或预览申请资源，且 Runner 上已有运行中、停止中、失联或重启恢复的原占用
- **THEN** 在同一事务核实全局 slot／CPU／内存，任何主体不能绕过原占用；UNKNOWN 不释放资源，已派发预览仅在准确原实例退出或独立原 ID 消失证明核实后释放

#### Scenario: A reservation acknowledgement or dispatch acknowledgement is lost
- **WHEN** Runner 预留或唯一派发位已提交但 ACK 丢失，随后重试或重启
- **THEN** 原操作返回同一不可替换预留，派发位不再次给出执行许可；未派发取消可以释放，已派发未知预留继续保留并只查询原对象

#### Scenario: A container action loses its acknowledgement
- **WHEN** 原 network／create／start／stop 动作的派发位或执行 ACK 丢失，或者 Runner 重启
- **THEN** 只检查原持久名称、profile、labels 与实例，不重发原动作；不同镜像、目录、网络或实例不能替代原对象，未核实退出且没有独立 REMOVED 证明继续占用资源

#### Scenario: Generated application tries to change preparation evidence
- **WHEN** 预览容器写业务数据库，或试图改写同目录准备日志、完成回执和应用身份 marker
- **THEN** 数据库及 WAL 在独立 dataset 内按配额可写，原日志／回执／marker 的只读挂载受到核验，不开放平台目录、备份、socket 或凭据

#### Scenario: Control plane disconnects before original preview expiry
- **WHEN** 平台无法连接，Runner 自己保存的原未接受预览到期
- **THEN** Runner 独立扫描原归属和期限；未派发预留可以取消，已核实原实例只持久派发一次到期 STOP；未知动作不重发，未核实退出且没有独立 REMOVED 证明不释放容量，清理不删除 dataset

#### Scenario: Release preparation competes with automatic or explicit stop
- **WHEN** 接受准备尝试持有准确健康原实例，同时原停止或到期处理正在开始
- **THEN** 在同一 Runner writer 内互斥持有与停止，先提交者排除后者；HELD／OWNED 绑定原接受请求与 releaseId，回执丢失恢复原归属，未知提交不靠 TTL 自动解除保护，原数据不被连带清理

#### Scenario: Runner clock moves backwards or an old preview has no custody record
- **WHEN** 观察到宿主时钟回拨，或旧版本预览没有明确归属登记
- **THEN** 新登记预览使用单调经过时间与持久墙钟高水位防止观察到的回拨延长期限，已锁存到期不可撤销；旧预览保持未登记且仅查询，不自动收养、停止或冒充未接受实例

#### Scenario: Dataset directory survives workspace cleanup
- **WHEN** 工作空间被清理，或请求尝试用路径、链接、硬链接替代 dataset 数据库／日志／侧文件
- **THEN** dataset 保留在受控 ID 决定的独立 Runner 目录，拒绝越界或链接文件，不暴露控制数据库和备份

#### Scenario: A never-started original container is removed
- **WHEN** 原停止已持久锁定、准确原容器仍为 CREATED，随后受信任后端执行非强制移除并成功核实原 ID 消失
- **THEN** 保存独立 REMOVED／PREVIEW_REMOVED 证据，原观察、容量释放及历史同事务提交，不伪造 EXITED、不删除 dataset；原创建尚未知且无准确 ID 时继续占用

#### Scenario: Original removal acknowledgement is lost
- **WHEN** 原容器或原独占网络的移除许可／执行／观察提交丢 ACK，或者 Runner 重启
- **THEN** 只按原完整 ID 核实，不重复发送移除；网络清理包含已释放容量的原记录，只有原容器已移除且原网络为空才允许移除网络，HELD／OWNED 和其他对象不受影响

#### Scenario: Actual initialization matches the pinned template
- **WHEN** 显式配置本地可信数据适配器，为当前冻结 INITIAL 方案准备 EMPTY 或 DEMO
- **THEN** 创建能被原模板直接读写的实际 SQLite、独立应用身份和 marker，保存不可变原请求及完成回执；未知模板或 schema／迁移不可用

#### Scenario: A snapshot observes only committed source data
- **WHEN** 同 schema 源数据库有已提交 WAL 和尚未提交事务，随后准备隔离预览副本
- **THEN** SQLite 一致副本包含已提交内容、排除未提交内容；源与副本之后的业务写入互不回写，副本具有新的应用身份

#### Scenario: An original file preparation fails or loses an acknowledgement
- **WHEN** 实际准备因容量等原因留下部分文件、完成后丢回执、控制面观察提交后丢回执，或服务重启
- **THEN** 原日志只创建一次，部分文件保持 UNKNOWN 且不重建；已完成操作通过原文件证据或已提交控制记录恢复，不重复初始化／复制，源后来不可用不使已完成副本依赖源恢复

#### Scenario: Dispatch permission acknowledgement is lost
- **WHEN** 唯一派发许可已提交但调用者没收到许可，也不能证明原动作已完成
- **THEN** 后续只核实原对象并保留 UNKNOWN，不以重试为由再次初始化，不伪造 READY 或解除未知副作用阻塞

### Requirement: Durable private preview access admission

The system SHALL 固定可信网关的项目、service principal 及配置摘要，只向当前成员开放准确原候选／镜像／dataset／实例／端点，并重新检查健康、期限及带 fencing 写门。每次原 HTTP 请求 MUST 持久保存方法／路径／正文摘要及绑定，只派发一次；未知结果不得通过重试或超时解除写入占用。该准入记录 SHALL NOT 充当实际 HTTP、数据排空或接受完成证据。

#### Scenario: Missing or mismatched gateway and dataset gate
- **WHEN** 没有显式策略或原后端写门，或请求的主体／配置／用户成员身份不匹配
- **THEN** 拒绝准入，不开放任意目标代理；viewer 不能取得写方法许可，operator 的预览业务写权限不扩大平台权限

#### Scenario: Gate closure competes with dispatch
- **WHEN** 关闭原 dataset 写门与基于旧 fence 的写请求同时提交
- **THEN** 同一 writer 中先提交关闭则拒绝该派发，先提交派发则关闭后仍计入未确定写；最后授权失败不自行假定未发送，关闭后安全方法读取须基于当前 fence

#### Scenario: Dispatch grant or response acknowledgement is lost
- **WHEN** 原许可已经提交但 ACK 丢失，或原请求为 DISPATCHED／UNKNOWN 时服务重启
- **THEN** 不再次发放派发许可，保留准确原记录和写入计数；只有可信原完整响应或明确未发送观察可终结相应请求，UNKNOWN 不可凭假定未发送消除

#### Scenario: Control clock moves behind an original health observation
- **WHEN** 控制节点时钟回拨使原健康观察落在当前时间之后
- **THEN** 关闭当前可用性及访问许可，原观察和未确定写保持不变，不把负健康年龄当作新鲜

#### Scenario: Logical requests finish without physical quiescence proof
- **WHEN** 原 HTTP 返回包括错误状态在内的完整响应，且网关在途写计数归零
- **THEN** 仅记录传输观察，不把 HTTP 完成或方法分类当作业务成功／数据库排空，不创建 Release、切换接受指针或自动重开旧门

### Requirement: Purpose-separated preview sessions and original HTTP forwarding

The system SHALL 将一次性预览票据与短期预览会话分开，凭据仅由可信网关产生并只持久保存摘要。票据 MUST 绑定当前成员、网关配置、准确原目标、平台与预览 origin，兑换会话与消费票据同事务提交；重复兑换不得产生第二会话。预览 MUST 使用每实例 host、与平台不同的可注册域及 HTTPS，域边界包含私有公共后缀。真实 HTTP 请求 MUST 绑定最终方法、原始路径、正文及净化后请求头摘要，由拥有准确原预留的 Runner 转发。

#### Scenario: Concurrent exchange or a lost exchange acknowledgement
- **WHEN** 同一票据并发兑换，或消费提交后 ACK 丢失／Worker 重启
- **THEN** 至多保存一个原会话，仅准确原内部重试可查询原结果；不同会话身份不再消费，票据不能作为会话使用，原期限不因重试延长

#### Scenario: A browser exchanges a ticket from the wrong origin or host
- **WHEN** 兑换没有准确平台 Origin、JSON 用途或准确预览 host，或攻击者跨 origin 写入业务接口
- **THEN** 拒绝请求；成功兑换只设置 host-only、Secure、HttpOnly 的预览 Cookie，票据不放入 URL，平台身份与任何 Cookie 不转交生成应用，上游不能覆盖网关 Cookie

#### Scenario: An original unsafe HTTP request is repeated or its response breaks
- **WHEN** 相同主体／预览／网关配置的写键重试，或实际数据库已提交但完整 HTTP 响应丢失
- **THEN** 原准入意图保持不变，重复键仅返回原状态且不再次发送；结果未知继续占用原写门计数，注销、到期或重启不将其排空

#### Scenario: Runner target verification fails or forwarding loses authority
- **WHEN** 原 Runner 预留、实例、镜像、dataset、期限、端口或生命周期不匹配，或最后成员／会话／写门授权失效
- **THEN** 请求不得选择替代实例或调用者提供的 URL；构造业务 HTTP 前可确定未发送才记录 NOT_SENT，构造后未取得完整原响应保持 UNKNOWN，不跟随重定向或自动重试

#### Scenario: A session is revoked while the upstream is responding
- **WHEN** 原 HTTP 已开始，随后会话注销、到期或用户失去成员身份
- **THEN** 可信网关可以记录原完整响应的私有传输观察，但向用户返回内容前重新核实当前会话与成员；拒绝返回受保护正文，不把注销当成原请求未发送

#### Scenario: Generated content attempts to escape its preview host
- **WHEN** 生成应用返回 Cookie、平台跳转或试图注册 Service Worker／访问父平台／打开外部连接
- **THEN** 网关过滤响应身份和跳转头，使用明确 CSP／sandbox／worker／frame 策略及独立 origin 隔离；浏览器实测与 HTTP 头验证分别记录，未进行浏览器验证不得宣称完成该边界

### Requirement: Durable acceptance preparation without destructive defaults

The system SHALL 在外部准备前固定候选、审查、原接受指针和数据策略，保存原操作身份。保留数据 MUST 用带 fencing 写门排空旧写入并快照最新数据，经准确迁移／完整性和服务健康验证后才准备完成；替换数据 MUST 有准确明确确认。未知结果 SHALL 查询原操作且不重复执行副作用。

#### Scenario: Unconfirmed replacement or stale preparation
- **WHEN** 没有用户确认就要求清空／替换数据，或准备后候选／计划／数据策略发生变化
- **THEN** 拒绝准备或提交，保留原接受版本和原数据，不把预览克隆当作默认替换来源

#### Scenario: Preparation acknowledgement is lost
- **WHEN** 数据或镜像准备已经发送但响应丢失
- **THEN** 持久状态保持待核实，查询原对象，不新建 dataset 或重跑迁移，不同时开放新旧写门

#### Scenario: Intent acknowledgement reserves only the original preparation identity
- **WHEN** 负责人按当前完整审查、候选版本、原接受指针和明确数据方案保存准备意图
- **THEN** 固定原 operation／requestHash／releaseId／目标 datasetId，不创建数据文件、Release 或接受事实，未取得可信 fencing／完整性／健康证明前不得显示准备完成

#### Scenario: Preparation dispatch acknowledgement is lost
- **WHEN** 准备派发许可已提交但响应丢失，或原副作用仍 UNKNOWN
- **THEN** 重开 Worker 后仍只查询原操作和目标，不再授予派发，不创建替代准备；只有准确从未派发的 PREPARED 可由当前负责人显式关闭

#### Scenario: Fresh health attempts to replace the original prepared objects
- **WHEN** 后端观察替换原数据证明、物理 fence、Runner claim／实例／端点，或非后端主体提交健康
- **THEN** 拒绝写入，原证明保持不可变；没有实际可信后端不得从调用者字段制造准备完成

#### Scenario: Health expires or custody revision regresses across uncertainty
- **WHEN** 健康年龄超出 0～30 秒、当前 fence／归属不再持有、观察时间回退，或 UNKNOWN 后提交更小 custodyRevision
- **THEN** 关闭或拒绝 READY，保留原证明与历史，只核实原对象；重复旧 ACK 不复活旧可用性

#### Scenario: Preparation observation transaction or acknowledgement fails
- **WHEN** 证明、观察、事件或 Run 版本写入失败，或已提交观察丢 ACK 后重开
- **THEN** 事务全部回滚或恢复准确已提交原记录，sequence CAS 防止迟到观察覆盖，不重新执行准备或把准备 READY 当作接受

#### Scenario: Original preparation changes while health is being checked
- **WHEN** 观察核实期间原准备 revision 发生变化，或旧 READY 后原准备在同一毫秒变为 UNKNOWN
- **THEN** 拒绝基于旧 preparationRevision 的观察提交，按持久版本关闭旧 READY；恢复须重新查询原对象，不用墙钟推断提交先后

### Requirement: Actual acceptance data retains original purpose and physical custody

The baseline template's read-only connection SHALL use SQLite read-only access without changing journal mode. Opening, listing and closing a read-only prepared DELETE-mode target SHALL preserve its original database bytes. This connection policy SHALL NOT be treated as proof that other writers are physically excluded.

The system SHALL 使用原接受请求准备实际数据文件并持久绑定 ACCEPTANCE 用途、原 operation／requestHash、数据身份和 journal。新动作 MUST 先通过当前授权及显式可信物理隔离适配器，恢复 MUST 只核实原 fence 与原文件，数据阶段证据 SHALL NOT 被当作完整准备或接受完成。

#### Scenario: Actual acceptance initialization or replacement completes
- **WHEN** 已明确授权的原 INITIAL 或 REPLACE 方案在准确源／目标 fence 下准备 EMPTY／DEMO
- **THEN** 保存实际 SQLite／独立应用身份／原数据回执，REPLACE 不复制旧业务数据，原 sourceReleaseId 仅保留基线，不生成预览 effect 或 Release

#### Scenario: Preserved data requires an exact trusted migration
- **WHEN** 原 PRESERVE_MIGRATE 请求指定准确迁移材料，或材料缺失／摘要不符／计划不受信任
- **THEN** 只允许从原已 fenced 源取得一致副本并执行明确配置的可信计划；缺配置、材料变化和任意 SQL／脚本保持关闭，不回写源数据

#### Scenario: Original data initialization is interrupted or its acknowledgement is lost
- **WHEN** 数据 journal 已保存而初始化／发布中断，或实际完成回执丢失后组件重启
- **THEN** 只检查原 journal／fence／文件；部分对象保持 UNKNOWN、不重建或重跑迁移，完成对象按原 SHA／大小／完整性和原 fence 恢复

#### Scenario: Current authority or physical custody disappears
- **WHEN** 发布文件前授权变化，或当前源／目标 fence 与原持有证明不同，或未配置实际隔离适配器
- **THEN** 不发布新的数据证明、不伪造物理 fence 或健康；已存在对象保留供原操作核实，不重新 acquire 替代 fence

#### Scenario: Read-only template inspects a prepared target
- **WHEN** 模板只读打开、列出数据并关闭已准备的 DELETE-mode 数据库
- **THEN** 使用原生只读连接、拒绝业务变更且保持原文件摘要，不切换到 WAL 或声称其他写入已排空

### Requirement: Atomic acceptance with independent publication recovery

The system SHALL 在短事务重核候选、完整审查、准确原质量、准备凭证、当前接受指针和未知副作用，原子创建不可变 Release、更新接受指针、完成 Run 并保存发布意图。事务外准备和发布不得占用该事务。已提交事实 MUST 在路由或打包失败后保留，恢复只处理原发布／导出。

#### Scenario: Original publication has only one dispatch grant
- **WHEN** 原配置后端消费准确T5 Outbox，或SENT／UNKNOWN操作恢复
- **THEN** PENDING仅一次取得派发许可并固定原源／目标门；已有派发只查询原操作，不创建替代服务、迁移或新Release

#### Scenario: Readonly preparation cannot be relabeled as writable publication
- **WHEN** 发布仅重用原只读profile／instance，或缺少准确退役、永久撤权、后继围栏及独立受控制门约束的RELEASE_OWNED／READ_WRITE服务
- **THEN** 保持接受事实和关闭的新目标门，不记录PUBLISHED或凭普通后端健康标志宣称可写

#### Scenario: Publish the exact restored target atomically
- **WHEN** 原后端核实准确新服务／路由／镜像／dataset、源门关闭且无未知原写、原门快照、30秒内当前健康及准确后继fence
- **THEN** 同一writer保存不可变发布证明／观察／PUBLISHED、目标新fence／门历史与事件；旧源继续关闭，任一写失败整体回滚

#### Scenario: Stable publication proof needs fresh recovery observation
- **WHEN** 原发布证明早已产生而控制ACK丢失，后端再次查询
- **THEN** 原证明不改写；开门前须新鲜查询同一服务／路由／围栏。准确已保存观察重放返回原结果，不重复事件或开门

#### Scenario: Acceptance transaction fails
- **WHEN** T5 保存过程发生错误
- **THEN** Release、指针、Run 完成和发布意图全部回滚，不显示接受成功

#### Scenario: Publication fails after acceptance
- **WHEN** 接受已提交而路由切换或打包失败
- **THEN** 显示已接受及对应恢复状态，原 releaseId 可幂等恢复发布，不创建第二次接受或重跑验证／迁移

#### Scenario: Download without acceptance
- **WHEN** 用户只下载部分成果、查询候选或打开预览
- **THEN** 不创建 Release，不改变接受指针或下一次迭代起点

### Requirement: An immutable abort decision closes preparation authority

系统 SHALL 在任何接受准备的破坏性撤销动作之前持久保存当前 owner 的准确撤销决定，绑定原准备正文／hash／revision、已有 proofHash 或 null、原因和操作者。新命令 MUST 使用 Run scope、强 If-Match 与明确确认，并与 T5 在同一 writer 内互斥。系统 MUST NOT 把该决定解释为物理清理完成。

#### Scenario: An owner aborts a dispatched original preparation
- **WHEN** 当前 owner 对尚未接受的准确 SENT／UNKNOWN 准备提交撤销，即使原候选或 Run 代际已失效
- **THEN** 原子保存不可变决定、原响应、Run 资源版本和事件；投影 ABORTING，关闭继续准备／READY／新观察／源闭门和 T5，保留原派发历史、proof、目标 CLOSED、数据及未核实占用

#### Scenario: Abort and acceptance race or an acknowledgement is lost
- **WHEN** 两命令竞争单一 writer，或撤销 ACK 丢失后按原键重试／重启恢复
- **THEN** 只有一个不可逆决定成功；已接受不能撤销，撤销后不能接受；当前 owner 的原键恢复同一决定，新键不能替换，迟到结果不能复活 READY

#### Scenario: A decision is durable but cleanup is uncertain
- **WHEN** 撤销决定存在而原服务停止、目标 fence 解除或旧源恢复尚无明确独立证明
- **THEN** 保持 ABORTING、项目未核实占用和未核实资源，不声明 ABORTED、不重开旧写门或删除数据；可信原后端仅恢复准确原决定和原对象，已明确清理的服务容量按独立证明释放

### Requirement: Runner cleanup requires the original abort and exact object proofs

Runner SHALL 持久绑定准确控制面撤销决定、controller 与原准备，即使尚无 reservation 也阻止迟到创建。系统 MUST 分别记录 STOP／容器移除／网络移除的原请求、唯一派发及明确观察，保留原 claim／proof 和业务数据，不把服务清理当作完整 ABORTED。

#### Scenario: A late create has no verified object identity
- **WHEN** 原 CREATE 已获许可但原容器 ID 尚未核实，或原动作／查询回执未知
- **THEN** 只核实原名称、完整 profile 和日志，不创建替代对象、不重发原动作，不以 inspect 失败或空列表释放该占用

#### Scenario: The exact original container is removed
- **WHEN** 原决定允许清理且准确容器已核实 CREATED 或 EXITED，并通过不带 force／volumes 的原 ID 移除及成功完整 ID 查询核实消失
- **THEN** 同一 writer 原子保存移除证明、REMOVED、容量释放和历史；CREATED 不伪造 EXITED，原数据／claim／proof 保留；原空网络随后独立核实移除

#### Scenario: Cleanup acknowledgement or observation commit is lost
- **WHEN** STOP／移除许可、物理响应或观察提交 ACK 丢失，或 Worker 重启
- **THEN** 只查询原动作与准确 ID，不二次执行；未知继续占用，准确消失证明落库失败不提前释放；已释放服务容量不丢失待恢复的原网络清理

### Requirement: Dataset abort permanently revokes the original preparation

系统 SHALL 在原服务／网络清理核实后，按相同控制面决定持久保存独立数据撤销日志与原证明。物理适配器 MUST 永久封禁原准备的迟到 acquire／写入、核实原在途动作并保持目标 CLOSED；缺少本地 fences 文件 MUST NOT 被解释为从未取得物理持有。

#### Scenario: Data abort is interrupted or its acknowledgement is lost
- **WHEN** 原数据撤销日志已独占刷新，而物理执行或完成回执尚不确定
- **THEN** 仅查询原撤销，不重派、不替换日志、不删除数据；不完整日志关闭继续执行，源控制门和项目占用继续保留

#### Scenario: Original custody is restored by the configured authority
- **WHEN** 原适配器核实准确原 fences、永久撤权及递增 generation，目标仍关闭、原源 release 归属已恢复
- **THEN** 保存绑定原决定／清理记录／数据日志的不可变回执，原准备日志／fences／业务文件保留；源标为 CONTROL_CLOSED，不据此自动重开旧门或声明完整 ABORTED

### Requirement: Atomic acceptance abort completion
系统 SHALL 仅允许原配置后端在核实原决定、原服务／网络清理、持久数据撤权及目标关闭后追加不可变撤销完成事实；原 SENT／UNKNOWN 历史和数据 MUST 保留。

#### Scenario: Complete an initial preparation abort
- **WHEN** 原后端提交完全匹配的原清理与数据恢复回执，原接受指针未变且目标仍关闭
- **THEN** 同一事务记录完成、Run版本和事件，投影ABORTED并解除本准备占用；不创建Release或开放目标门

#### Scenario: Restore the original source gate
- **WHEN** 原旧Release的准确镜像、后继fence、RELEASE_OWNED／READ_WRITE归属及30秒内健康被核实，原写请求均有确定结局且旧源门由本准备准确关闭
- **THEN** 完成事务仅将该源门重开且fence／revision递增，保留关闭记录与新历史；任一写失败整体回滚

#### Scenario: Uncertain writes or stale source prevent completion
- **WHEN** 存在DISPATCHED／UNKNOWN原写、错误关闭操作、改变的接受指针、过期健康或只读HELD服务
- **THEN** 继续ABORTING和项目占用，不能以数据回执推断可写或清除未知请求

#### Scenario: Completion recovery is immutable
- **WHEN** 原后端重复提交准确原完成证明，或改用不同证明／非原后端
- **THEN** 准确重放返回原结果且不重复事件；更改证明或越权失败，原准备继续永久禁止T5和目标门开放

### Requirement: Rejection preserves scope and user correction

The system SHALL 保存准确候选退回依据，区分原范围缺陷与新增需求，并允许用户纠正分类。新增范围 MUST 经过变更与新计划确认，不能通过人工审查结论直接获得实施授权。

#### Scenario: User corrects rejection classification
- **WHEN** 用户把系统建议的新增需求改为原范围问题，或反向纠正
- **THEN** 追加保存纠正及依据，原分类保留，后续流程使用明确当前分类且不隐式应用未确认变更

#### Scenario: A new candidate cannot hide an unresolved rejection
- **WHEN** Run 中仍有 OPEN 退回时冻结新候选，或负责人明确撤回原历史候选的退回
- **THEN** 新候选继续展示待处理项并阻止接受准备；有理由撤回追加保留历史，只解除该项，不批准质量或人工检查

### Requirement: Authenticated platform preview entry and read-only material download
系统 SHALL 从已配置的可信平台身份解析访问主体，准确展示不可用状态，签票据要求准确平台 Origin 与空 JSON。查询、页面导航与下载 MUST NOT 接受候选或启动替代执行。

#### Scenario: Preview entry has no configured identity or gateway
- **WHEN** 身份解析未配置或准确网关未配置
- **THEN** 鉴权或访问保持关闭，当前成员只看到适用的不可用状态，不创建票据、实例或 Release

#### Scenario: Browser opens the exact preview
- **WHEN** 已鉴权成员明确打开可用预览
- **THEN** 浏览器在准确预览 origin 兑换一次性票据，经限定平台 CORS 确认 HttpOnly 会话，只在受限 iframe 加载该 origin；票据不进 URL，平台凭据不转发

#### Scenario: A frozen material is downloaded
- **WHEN** 当前成员按准确冻结候选的材料键下载
- **THEN** 服务端解析原交付引用，核实内容 hash／大小，发送前复核成员，以不能作为平台 HTML 执行的 attachment 返回，接受指针与 Run 终态不变

### Requirement: Runner retirement preserves the original publication handoff
系统 SHALL 在私有可信装配中核实原已派发T5、固定门basis、Runner稳定prepared proof及准确只读服务journal，持久记录独立发布退役；MUST NOT 把只读HELD服务改写为可写OWNED，或仅因退役完成记录PUBLISHED。

#### Scenario: Permanent revocation precedes exact retirement
- **WHEN** 原发布已唯一派发，原物理Authority核实准备永久撤权且前序观察完整
- **THEN** 才允许依次停止／移除准确原容器及网络，每步只首次dispatch可执行；原profile、claim、proof和数据保留，目标控制门不开放

#### Scenario: Lost acknowledgment only queries an original stage
- **WHEN** 登记许可、撤权或移除回执丢失，或Runner重启
- **THEN** 仅查询已持久原步骤，不重发或发出下一未派发步骤；未知容器继续占用容量，中断未完成不得伪造成功

#### Scenario: Absence and capacity release are atomic
- **WHEN** 成功查询证明准确原容器消失，或服务历史写入失败
- **THEN** 消失观察、REMOVED、容量释放及历史整体提交或整体回滚；原网络尚未消失的记录即使容量已释放也继续可恢复查询

#### Scenario: The dataset remains in handoff
- **WHEN** 原发布已登记退役，其他controller尝试预留相同dataset或登记原接受撤销
- **THEN** 交接屏障拒绝操作，即使只读服务已释放容量；旧prepared proof可只读恢复，迟到事实不能复活旧服务

### Requirement: Runner writable publication preserves staged write admission
系统 SHALL 在原只读退役后以独立 RELEASE 身份持久记录后继围栏、原可写源清理、共享容量、guard、创建启动、归属和路由；目标 MUST 保持 CONTROL_CLOSED 直到控制发布事务成功，所有业务数据写入 MUST 同时受原物理代与当前控制门约束。

#### Scenario: A distinct writable service is staged
- **WHEN** 原只读退役与后继围栏核实完成，guard 覆盖所有业务数据写入
- **THEN** 才允许独立可写 profile 创建／启动；只读连接不写业务盘锁，发布运行锁在临时根，启动与健康不改变准备数据库，首次获准请求才开始数据库写入

#### Scenario: An original writable source is retired atomically
- **WHEN** 后继固定本地原 service／route，准确源容器消失已核实
- **THEN** 观察、旧服务 REMOVED、容量释放与历史同事务；网络清理后才分配新服务，未知状态继续占用，源只能有一个后继

#### Scenario: Recovery queries existing stages only
- **WHEN** 可写阶段回执丢失或 Runner 重启
- **THEN** inspect 只查询原已持久阶段，不预留、接管、安装 guard、创建启动或切路由；完整原 claim／route 可一次派生稳定 proof，缺当前 guard／fence／route／健康不返回可发布观察

#### Scenario: Publication commits under control authority
- **WHEN** 稳定 proof 与新鲜原对象观察通过控制校验
- **THEN** 控制 writer 原子保存发布／路由／数据状态与开门；缺物理 provider、外部源缺本地证明、未执行真实环境验收均不得被本地日志或夹具替代

### Requirement: Release access preserves current route and credential purpose
系统 SHALL 以独立 RELEASE 用途凭据开放准确已发布应用，并固定当前接受指针、持久路由代际、原服务证明和数据写门；MUST NOT 复用 PREVIEW 凭据、直接暴露 Runner loopback 或凭历史发布证明假定当前健康。

#### Scenario: Accepted release is waiting for its route
- **WHEN** 接受已经提交但该 release 尚未 PUBLISHED，或当前路由尚未准确绑定
- **THEN** 平台入口显示恢复中，不签发业务访问票据、不回退到旧路由，不更改接受事实

#### Scenario: Member accesses the exact published application
- **WHEN** 已鉴权成员明确打开当前发布应用，准确原物理服务和 guard 可核实
- **THEN** 独立一次性票据在准确 HTTPS host 兑换为有界用途会话，viewer 只读，写入还核实原 OPEN 门和代际；平台 Cookie／身份头不上游转发

#### Scenario: A release write has an unknown outcome
- **WHEN** 原写派发回执丢失或实际 HTTP 响应不完整
- **THEN** 保留原 DISPATCHED／UNKNOWN 占用，重试不重发；注销、会话到期、成员移除或路由切换均不能清除它，接受／发布／旧门恢复共同受阻

#### Scenario: Route or original service changes
- **WHEN** 会话中的 route hash／generation、claim／profile、实例或当前授权与原绑定不再一致
- **THEN** 新派发／发送前拒绝，不选择替代实例；已完成记账保留，失效成员不能取得响应正文

### Requirement: Explicit continuation never replays an uncertain publication stage

The system SHALL 将原结果查询与后续阶段协调分开。显式 continuation MUST 核实原已派发发布的当前控制授权及同一 basis，未派发阶段 MUST 在 Runner 单 writer 取得唯一许可；已派发阶段只查询准确原对象。inspect MUST NOT 调用 continuation、quota prepare、原阶段重发或下一阶段派发。

#### Scenario: A completed stage loses its acknowledgement before the next stage
- **WHEN** 原动作已执行而回执丢失，随后 Worker 重启并显式继续
- **THEN** 核实同一原动作后才申请下一阶段唯一许可，不重复执行原动作、重新接受或重跑迁移；前驱仍未知则停止推进并保留占用

#### Scenario: A publication dispatch grant is lost before Runner enrollment
- **WHEN** 控制面原派发已提交但 Runner 尚无登记
- **THEN** 只读 inspect 不登记；显式继续经当前原控制授权后登记相同请求并开始逐阶段许可，不创建第二发布或替代对象

#### Scenario: Quota preparation is uncertain or inherited from v11
- **WHEN** 配额准备许可／结果丢失，或升级前已有 profile 但无配额阶段日志
- **THEN** 新操作只核实原配额，不重发；历史 profile 明确只查询，不伪造已完成，也不在恢复中重新应用配额。准确配额不可核实则不开始 guard／容器动作

#### Scenario: Concurrent coordinators lose authority or encounter changed objects
- **WHEN** 多个协调器同时恢复，或原配置／物理 fence／guard／控制门／接受指针变化
- **THEN** 同一原阶段至多派发一次；未知旧动作保留，失去授权时不派发后继，不用新配置、实例或路由替代

### Requirement: Accepted release delivery exports use an immutable independent job
The system SHALL freeze the accepted release identity, exact candidate and source manifest, actual configuration and requirement/plan revisions, control event cutoff and message cursors, and retained content references in a separate idempotent export operation. The system MUST NOT accept, deploy, migrate, rebuild or modify the accepted pointer to create or retry an export. Export metadata and download SHALL require current project membership, while packing and writes SHALL additionally require the original creator and current generation/token lease.

#### Scenario: Retry uses the original version after late records or live source changes
- **WHEN** an export is queued and later records or a live checkout change
- **THEN** packing reads only the frozen records, original immutable Git commit and retained material hashes
- **AND** the manifest identifies the cutoff, exact versions, material hashes, transformations and deliberately excluded scope

#### Scenario: Concurrent or stale packers cannot replace the archive
- **WHEN** packers compete or an expired worker returns after explicit retry
- **THEN** only the current claim can read private materials or register archive bytes
- **AND** the first prepared manifest/hash/size remain immutable and retries produce the same archive

#### Scenario: Packaging failure and lost registration acknowledgement preserve acceptance
- **WHEN** materials are missing/corrupt, a limit is exceeded or a packing acknowledgement is lost
- **THEN** only the export job fails or recovers its already registered READY archive
- **AND** the original Release, acceptance receipt, publication intent and business data remain unchanged

#### Scenario: Download does not schedule work or bypass revoked membership
- **WHEN** a current member reads status or downloads a READY export
- **THEN** GET performs no packing or retry and download streams only the exact authorized immutable ZIP as an inert attachment
- **AND** a removed member is denied on the next read or download

#### Scenario: Delivery scope is explicit and bounded
- **WHEN** the archive is generated
- **THEN** source, formal quality/build materials and projected collaboration/configuration records are included within declared limits
- **AND** business data, platform credentials/runtime authority and private model request/response/reasoning are excluded; unsafe or colliding paths fail without silent truncation
- **AND** delivery completeness does not claim full platform replay/import or physical deployment acceptance

### Requirement: Explicit platform export consumption survives restart
The system SHALL enable local export consumption only with an explicit platform configuration and durable storage. The trusted host SHALL page through QUEUED and expired PACKING originals owned by current project members, with bounded per-pass work and at most two concurrent packs per instance. It MUST preserve the frozen snapshot, use the original generation CAS to recover an expired lease, and MUST NOT automatically retry ordinary FAILED jobs or replay acceptance, publication, development or migration.

#### Scenario: Queued work survives a platform restart
- **WHEN** the explicitly enabled platform starts with a durable QUEUED export, including one created by the Input API before shutdown
- **THEN** the default controlled Git reader packs the original job and provides the same immutable READY archive without an in-memory enqueue record
- **AND** an unexpired PACKING lease is left alone while an expired one can resume only through original-generation CAS

#### Scenario: Concurrent consumption, failure or membership revocation
- **WHEN** consumers compete, a pack fails, or the original creator loses project membership
- **THEN** the database claim prevents competing completion, instance concurrency remains bounded, and a normal failure waits for explicit original retry
- **AND** revoked originals are not scanned and remaining private reads or archive commits require current membership

#### Scenario: Platform shutdown occurs during packing
- **WHEN** the platform stops with active export work
- **THEN** it stops API admission, signals cancellation and waits for actual pack calls to return before closing SQLite
- **AND** a cooperation deadline is not treated as proof of physical termination; hard exits leave the original lease for later recovery

#### Scenario: Export consumption has no authority configuration
- **WHEN** releaseExports is omitted or disabled, or it is enabled without durable storage
- **THEN** omission or disablement installs no consumer, and enabled configuration without storage rejects startup
- **AND** enabling local export consumption does not enable identity, models, A2A Runtime or a physical Runner

### Requirement: Private accepted-release export entry preserves the original operation
The system SHALL expose a current-member React delivery page and protected local browser asset for an accepted Release, including historical accepted versions. GET SHALL NOT enqueue, retry or pack exports. The page SHALL show the exact original version, bounded cursor pages, server-computed retry capability and immutable READY download.

#### Scenario: A committed create response is lost and the tab reloads
- **WHEN** a user explicitly creates an export and the response cannot be verified
- **THEN** the page retains the original UUID in tab session storage and offers explicit recovery with that same key after reload
- **AND** load or polling never creates or retries an operation; unavailable session storage prevents a new create

#### Scenario: State changes, failure or revoked membership
- **WHEN** visible QUEUED or PACKING jobs need a current status
- **THEN** the page uses bounded GET polling, pauses in the background and serializes requests; pagination remains limited to20 jobs
- **AND** retry is offered only through the server capability for the original creator and exact generation; uncertain state disables writes and hides download
- **AND** authorization failure clears displayed jobs and disables actions, with no automatic replacement identity or request

#### Scenario: Unsafe metadata and browser download
- **WHEN** an accepted-release page contains untrusted error metadata or a READY archive is downloaded
- **THEN** bootstrap JSON is escaped, React renders only fixed error labels and inert metadata under nonce CSP with protected local assets
- **AND** the browser receives the original immutable attachment; real enterprise login and physical acceptance require their own evidence

### Requirement: Private manual review entry preserves exact human observations
The system SHALL expose current-member JSON, React page, protected local script and bounded history for an exact candidate. Only an interactive Run owner SHALL append explicit human results or rejection corrections. The entry MUST preserve the original expected text, automatic quality, candidate, Work and acceptance facts, and MUST NOT automatically accept, repair or apply scope changes.

#### Scenario: A human result commits but its response is lost
- **WHEN** a user submits an explicitly filled procedure, observation and verdict and the response cannot be verified
- **THEN** the tab retains the exact original payload, UUID and version for an explicit same-request recovery after reload
- **AND** loading or refreshing never POSTs, an unreadable saved request blocks replacement, and unavailable session storage prevents new submission

#### Scenario: A member reviews current or historical candidate records
- **WHEN** a current member reads the candidate or pages history
- **THEN** the entry returns its exact SHA and review basis with bounded item/history pages and inert user text under nonce CSP
- **AND** a viewer cannot append records; an interactive owner can withdraw an original historical rejection with a reason but cannot newly approve stale items

#### Scenario: Concurrent, stale or revoked writes
- **WHEN** a request changes the original expected value, current result, candidate, Run version or ownership
- **THEN** the original server CAS and permission rules reject the new write without replacing existing observations
- **AND** unseen resources return404, uncertain state closes new actions, and revoked access clears the protected browser projections

### Requirement: Private acceptance entry preserves exact two-phase authority
The system SHALL expose current-member reads for exact candidate acceptance basis and bounded original preparation history. Trusted host configuration SHALL select already registered per-project policy hashes; HTTP SHALL NOT register a backend or accept paths, endpoints, backend identities or prepared proof bodies. Reads SHALL NOT dispatch or refresh backend health.

#### Scenario: Create or recover an original preparation
- **WHEN** the current owner explicitly submits preparation, independent replacement confirmation, unsent closure or a dispatched abort decision
- **THEN** the system enforces the original UUID and body, current ownership, Run If-Match and exact candidate, review, data plan and accepted-source basis through the existing writer
- **AND** committed original recovery precedes new revision and configuration checks; abort acknowledgement records a decision and does not assert physical cleanup
- **AND** URL Run/candidate/operation ownership is checked, revoked or foreign resources return404, and public projections omit private proof bodies and host details

#### Scenario: Exact material preflight and lost T5 acknowledgement
- **WHEN** an owner explicitly submits AcceptCandidate with the original preparation request/revision, current observation sequence/proof hash, candidate/review/data plan/source and ACCEPT_RELEASE
- **THEN** the trusted ReleaseAcceptor reads and validates the exact immutable content bytes before the T5 writer, while missing bytes or changed basis prevent a new acceptance
- **AND** a committed acknowledgement lost after T5 is recovered with the original key/body without repeating material generation or preflight, even when new acceptance configuration is disabled; current owner authorization still applies
- **AND** the fixed receipt distinguishes ACCEPTED from its original PENDING publication and links the exact current-member preparation query

### Requirement: Private React acceptance uses explicit original decisions
The system SHALL provide a current-member HTML page and protected local React script for an exact candidate acceptance entry. It MUST display the frozen data strategy and accepted source, keep replacement confirmation separate, and require independent explicit confirmation for preparation, unsent closure, dispatched abort and final acceptance. Refreshing basis or selecting a preparation SHALL clear previous consent. Reads MUST NOT dispatch preparation or refresh backend health.

#### Scenario: Readiness and final decision remain separate
- **WHEN** a member opens the page, creates a preparation, or refreshes its original state
- **THEN** no acceptance occurs without a distinct owner confirmation using the selected original preparation and its exact basis, revision and observation
- **AND** missing configuration or readiness keeps final acceptance closed, and ABORTING means cleanup remains unresolved
- **AND** a committed receipt distinguishes its original pending publication from current publication and independent export

#### Scenario: Reload after a lost acknowledgement
- **WHEN** a preparation or final acceptance response is lost after the server commits
- **THEN** the browser retains the original request before POST and reload does not automatically POST
- **AND** explicit recovery uses the same key, body and If-Match while new submissions remain closed; corrupt storage also closes new submissions until explicitly cleared after checking
- **AND** known rejected submissions require a successful state refresh before explicit abandonment, and revoked access clears protected basis, preparations, history and receipts

#### Scenario: Bounded history projection preserves current authorization
- **WHEN** a candidate has at least 21 original preparations and the member pages its history
- **THEN** each bounded page is projected from one synchronous Worker transaction with a fixed number of platform-to-Worker round trips, rather than a round trip per item
- **AND** qualification reuse is confined to that transaction and exact original actor/basis/epoch/source; role changes and revocation are recomputed on the next request without extending health or browser request deadlines

### Requirement: Acceptance data Worker drain includes parent-process calls
The system SHALL retain an acceptance data preparation call and its bounded Worker slot until every parent-process authorization, custody and trusted migration RPC started by that Worker has settled. Worker timeout or exit SHALL close late authorization and MUST NOT count as cancellation of those external calls. Consumer shutdown SHALL await the actual backend drain.

#### Scenario: Worker exits while an external call remains unfinished
- **WHEN** a preparation Worker times out during preflight, final authorization, migration loading, custody acquisition or original custody verification
- **THEN** the caller and its Worker slot remain occupied until the external call actually returns, and queued work cannot exceed the configured concurrency
- **AND** late authorization is denied, late responses cannot resume the terminated file Worker, and the caller reports an unknown outcome after drain
- **AND** any original journal and custody remain intact; incomplete originals permit inspection only and never repeat acquisition, initialization or migration

#### Scenario: Shutdown while original acquisition is still returning
- **WHEN** a trusted preparation consumer stops after original custody was acquired but its external call has not returned
- **THEN** stop closes new physical authorization and remains pending through Worker timeout until the original call drains
- **AND** restart queries the same original preparation, preserves incomplete evidence and does not create a Release or replacement physical action

### Requirement: Trusted preview lifecycle consumption retains original authority
The system SHALL allow only explicit executable host composition to install a bounded preview lifecycle consumer. Each project, policy hash, service principal, backend reference and Runner binding MUST match its original registered policy before any backend work. No preview backend SHALL be installed by default. Later startup failure MUST NOT start this consumer.

#### Scenario: Original preview recovery without an API request
- **WHEN** a trusted consumer scans existing original lifecycle work
- **THEN** PREPARED can obtain only its original one-time execution grant, while SENT or UNKNOWN only inspects the original object
- **AND** periodic current health does not rewrite the original start receipt, expiry retains one deterministic original stop, and accepted ownership prevents expiry or stop
- **AND** work is bounded and rotated with one serial scope per project, at most two unfinished projects, coalesced ticks and safe per-scope errors
- **AND** no dataset creation, new owner decision, acceptance, publication or data deletion is inferred from consumption or API reads

#### Scenario: Stop during original preflight or execution
- **WHEN** the consumer or host stops while preflight or an original execution call remains unfinished
- **THEN** new scan and final physical authorization close immediately, preflight is rechecked before the original grant, and shutdown awaits actual backend drain before storage closes
- **AND** any already committed original grant remains available for query-only recovery without a replacement execution

### Requirement: Trusted host consumes recorded preview datasets
The system SHALL consume only original owner-recorded dataset preparations through explicitly registered trusted bindings and a bounded private work page. It SHALL preserve terminal history, inspect SENT/UNKNOWN without a new prepare, and drain real backend work before closing storage.

#### Scenario: Host restarts after dataset result ACK loss
- **WHEN** actual data preparation completed but its original result was lost
- **THEN** the host consumer inspects that original journal / receipt and does not initialize another dataset, create a preview or accept a release

#### Scenario: Stop or revoked owner before file creation
- **WHEN** stopAdmission or original owner revocation precedes final dataset authorization
- **THEN** no new original file journal is created; a timed-out Worker cannot use a late authority result, and its parent call retains its slot until the real authority RPC drains

### Requirement: Exact candidate preview management
The system SHALL expose authenticated bounded member projections and explicit owner dataset/start/stop intents for the exact candidate. New dataset/start intents SHALL require a trusted selected original policy, standard idempotency and Run If-Match. Reads SHALL NOT dispatch, refresh health or accept.

#### Scenario: Original intent after configuration removal
- **WHEN** an owner retries the original committed intent with identical body/key/If-Match after new-intent policy selection is removed
- **THEN** the original identity is returned, with no duplicate dataset or preview

#### Scenario: Explicit stop preserves owned resources
- **WHEN** an owner submits STOP_PREVIEW with the original preview revision and impact hash
- **THEN** only the original unaccepted instance may be stopped; dataset bytes and Release-owned instances remain protected

### Requirement: Explicit preview management page
The system SHALL provide an authenticated exact candidate management page with separate dataset/start/stop consent, original request persistence before POST and independently paged histories. GET and page reload SHALL NOT dispatch or resend owner intents. Membership loss SHALL remove protected UI state.

#### Scenario: Recover original browser request
- **WHEN** an acknowledgement is lost and the page is reloaded
- **THEN** the original request remains pending without automatic resend, and explicit recovery uses the same UUID, body and version conditions

#### Scenario: Stop and preview data are distinct
- **WHEN** a user confirms stopping an original preview
- **THEN** the page shows the saved stop decision separately from cleanup completion and keeps the original data history

#### Scenario: Independent history cursors
- **WHEN** a user pages dataset history or preview history
- **THEN** the other cursor and selected original detail remain unchanged
