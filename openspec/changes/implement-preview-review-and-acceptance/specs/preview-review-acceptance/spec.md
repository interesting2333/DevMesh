## Purpose

提供准确候选上的逐项人工审查、隔离预览与业务数据准备，并在满足原质量、审查和数据条件时原子保存接受事实。把候选就绪、人工通过、版本接受和实际发布分别呈现，保障中断后恢复原操作以及业务数据保留。

## ADDED Requirements

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

### Requirement: Atomic acceptance with independent publication recovery

The system SHALL 在短事务重核候选、完整审查、准确原质量、准备凭证、当前接受指针和未知副作用，原子创建不可变 Release、更新接受指针、完成 Run 并保存发布意图。事务外准备和发布不得占用该事务。已提交事实 MUST 在路由或打包失败后保留，恢复只处理原发布／导出。

#### Scenario: Acceptance transaction fails
- **WHEN** T5 保存过程发生错误
- **THEN** Release、指针、Run 完成和发布意图全部回滚，不显示接受成功

#### Scenario: Publication fails after acceptance
- **WHEN** 接受已提交而路由切换或打包失败
- **THEN** 显示已接受及对应恢复状态，原 releaseId 可幂等恢复发布，不创建第二次接受或重跑验证／迁移

#### Scenario: Download without acceptance
- **WHEN** 用户只下载部分成果、查询候选或打开预览
- **THEN** 不创建 Release，不改变接受指针或下一次迭代起点

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
