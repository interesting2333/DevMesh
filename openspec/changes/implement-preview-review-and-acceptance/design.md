## Context

父工作包、动机与验收依据见 proposal.md。准确候选由 P1-06 的 candidate_freezes／release_candidates 固定，包含 Work 正式证明、当前最终 Tester 原质量、交付数据方案与实际内容预检集合。其历史正文不可变，当前资格会因来源、计划、问题或材料变化变为 STALE。本变更开始时尚无人工审查、dataset、预览运行或接受服务；当前具体实施进度见 tasks.md，核心 releases 表不能单独构成 T5 实现。

## Goals / Non-Goals

**Goals:** 按 design/04 §6～8、design/05 T5 完成版本绑定的人工审查、隔离预览、数据准备和接受／发布持久内核，以真实本地 SQLite／文件／HTTP 验证事务、恢复、访问边界。缺少真实后端时关闭相关能力。

**Non-Goals:** 本变更不新增模型权限、不替代企业身份接入、不把镜像字节身份视为构建／健康证明、不在本机模拟 Linux 隔离通过。P3-01 仍负责持续迭代的完整业务流程、迁移负载和旧数据并发写入验收。

## Decisions

原预览生命周期的可信后台装配见 [preview-consumer-design.md](./preview-consumer-design.md)。

可信撤销消费的宿主、原决定队列及停机排空补充见[abort-consumer-design.md](./abort-consumer-design.md)。

验收数据准备的父进程 RPC 与文件 Worker 分别管理生命周期：preflight、acquire、inspect／verify、authorize 和 loadMigration 全部纳入该调用的未结束集合。Worker 超时立即关闭最终授权并终止线程；exit 先关闭新消息处理并真实等待集合排空，之后才结束调用和交还有界名额。外部调用没有强制取消，不能用超时 Promise 竞赛将其视为已结束。已开始的原物理事实与本地日志保留；无原日志的只读预检可重新请求，有原日志而无完整回执的准备只能查询，不能重做 acquire、初始化或迁移。消费者 stop 同样等待实际 RPC 结束，真实适配器须自行限制 I/O。此修复不新增默认物理后端、持久格式或数据库迁移。

### 1. Review is an append-only overlay over an exact candidate

新增候选审查域，读取已冻结且当前有效的 candidate、原需求 revision 和 plan，不更改原质量或 Work 评估。每条必要需求的 acceptance 文本形成稳定逐项人工审查项；额外收集当前最终 Work 的 human-decision 和原质量策略的 human 检查。历史沿用 Work 的人工许可按原正式证明保留，不能重复批准旧失败。自动检查只显示原正式评估，不接受人工把 FAIL 改为 PASS。

需求项 ID 由候选、需求 ID、验收序号和原文本哈希生成；Work／质量人工项使用类型、原操作和 checkId 的独立命名空间，拒绝未知项和重复冲突。每条人工记录保存候选 ID／revision／manifestHash、条目 hash、PASS／FAIL、实际操作者、操作、预期、观察、时间、可选的同 Run READY artifact 引用。预期须匹配展示依据；用户补充操作说明不改变检查定义。不适用只能来自原自动规则，不提供人工随意 N/A。

使用标准 meta、owner 权限和 If-Match；每条修改追加，前置 resultId CAS，防止两个标签页覆盖结论。原键丢回执返回原记录，仍核实当前成员权限。只读历史允许查看，但新记录须候选 CURRENT 且 Run REVIEW／可交互。reviewHash 覆盖完整必要集合、准确候选、当前记录和自动状态；任何结论、候选或依据变化使旧 hash 失效。人工审查不完成 Work、不改变 Run 终态或接受指针。选择此覆盖层是为保留自动原始失败；改写原结果或把 candidate READY 当审批均不成立。

### 2. External effects have durable original identities

dataset、预览、接受准备和发布各用独立持久操作、稳定远端键、请求 hash、状态、证据和查询接口。外部文件／网络／容器动作在 Worker 事务外，Worker 只保存意图和原 ACK。SENT 后失联进入 UNKNOWN，仅查询原对象，不新建替代实例，不重跑迁移。跨项目复合外键和原内容 hash 保护归属；缺失／不一致证据拒绝进入 READY。

首次预览明确 INITIAL 的空／演示数据，迭代预览使用原接受 dataset 的隔离快照并显示时间。预览写入不回写源数据。目录依本地存储 layout 建在独立 Runner dataset 根下，持久 ID 决定目录键，用户路径不参与；停止预览不清 dataset。真实数据完整性／迁移必须由可信适配器实际执行，未配置时明确不可用。

### 3. Preview access is separate from platform identity

预览目标 origin 必须与平台 origin 不同，服务端固定允许目标和路由，禁止任意 URL 代理。成员先经平台鉴权获取短期、preview audience、指定 previewId／projectId／到期的访问凭据；平台 Cookie 不转发到生成应用，响应去掉上游 Set-Cookie 等平台不允许字段，iframe sandbox 与 CSP 限制平台身份读取。网关检查权限、用途、过期、状态、原 image／dataset 绑定及写门；地址不可用显示恢复中，不伪造健康。预览到期和取消只停止对应未接受实例，已接受版本通过独立 release 归属保护。

### 4. Acceptance preparation and commit are separate facts

负责人显式请求接受，固定 candidate revision／manifestHash、reviewHash、当前 acceptedReleaseId、数据策略／确认决定和 image digest。准备凭证由可信适配器绑定以上依据、准确 targetDataset、schema／迁移哈希、完整性与真实服务健康／写门状态；客户端、普通模型或自报健康不能签发。首次准备不创建旧数据；保留原数据必须持有递增 fencing 写门，排空在途写，最新一致快照后迁移；REPLACE 必须准确独立确认，不能把预览克隆悄然覆盖原数据。

T5 在短事务复查原准备、当前候选、完整审查／质量、内容 READY、准确原接受指针、Run／计划／epoch 和无未知动作；一次提交不可变 Release、指针、必要待人工 Work 的最终人工完成、Run COMPLETED、operation、promotion Outbox 和事件。外部准备或内容实际读取在事务外，提交中重核其准确 hash／版本。回滚不显示接受成功。提交后不得因路由或打包失败撤销接受记录。

### 5. Promotion is recoverable without replaying acceptance

promotion 使用 releaseId 作为幂等键，含准确 image／dataset／原写门 fencing。提交后消费者仅路由／开放新写门；ACK 丢失查原发布，只有原目标一致才完成。失败或 UNKNOWN 保留“已接受，预览恢复中”，不重复创建 Release、不重跑测试／迁移、不重新接受。旧写门在准确切换已证实前保持关闭，不同时开放两份数据。导出打包使用独立任务和失败状态。下载和只读查询没有接受副作用。

发布消费者采用独立release_publications台账，迁移42只给原promotion Outbox回填PENDING及初始历史，不伪造派发、路由或健康。原后端一次性PENDING→SENT取得许可并固定源／目标门快照，SENT／UNKNOWN恢复只查原releaseId，不重派publish、创建替代服务或重跑迁移。不可变T5响应仍保存当时的PENDING，当前发布另行查询，普通A2A Outbox不消费该用途。

发布证明与当前观察分离。原准备只读profile／claim／proof保留；发布证明必须绑定一个不同reservation／instance／profile／network的RELEASE可写服务，原只读实例／网络已准确退役，原准备物理许可永久撤权，源／目标fence为准确原持有的严格后继。目标先ARMED／CONTROL_CLOSED、旧源保持CLOSED，新服务所有写入口受控制门fence约束；裸READ_WRITE进程或逻辑开门不能替代实际围栏。路由固定release／dataset／镜像／新instance／endpoint／claim及原接受版本。原证明时间稳定，恢复另查30秒内当前服务、路由和围栏状态，不用过期健康开门。

writer复核原Outbox／提交、原后端、当前接受指针、原门快照、旧源无未核实写及完整新鲜观察，同一事务保存原发布证明、观察、PUBLISHED、目标门fence／revision递增、门历史和完成事件。旧源门不重开，接受事实及Run终态不回滚。准确旧观察重放先于当前时间／指针检查，换证明或并发CAS冲突拒绝。显式ReleasePublisher只负责此原操作协议，未装配真实Runner可写转换／路由／物理gate适配器时保持关闭；4.3仍包含实际适配器、访问与独立导出恢复，不凭此台账勾选。

### 6. Rejection and scope correction remain explicit

退回保存准确候选、原范围缺陷／新增需求分类及证据；用户可纠正分类。原范围问题连接新前向修复，新范围连接变更审查和新计划，不通过更改候选审查表扩写已确认范围。P2-03 尚未实现的变更应用只保存待处理事实，不伪造已应用。

退回先保存 NOT_APPLIED 的明确下一步，不自动调用修复／变更。每个逻辑退回有稳定 ID 与当前记录 CAS；纠正和有理由撤回均追加历史。整个 Run 仍有 OPEN 退回时阻止接受准备，创建新候选不能隐去旧待处理问题。历史候选允许负责人明确撤回已有退回，仍禁止新批准或新 OPEN 退回；撤回只解除该待处理项，不改变人工检查或自动质量。原范围问题必须绑定已有审查项，新增需求可无既有条目，不能借分类更改验收定义。

### 7. Intent acknowledgement does not assert an external effect

迁移 32 为私有 Worker 域新增 preview_backend_policies、datasets、previews、preview_effects 与不可变观察历史。配置策略固定 project、template／schema、Runner、backendRef 和可信后端主体；仅显式可信装配可使用该内部登记接口，当前没有公共 HTTP／MCP 登记或回执入口。项目 owner 的普通主体不能替代已配置后端主体提交成功回执。未登记策略返回不可用；策略登记本身不启动服务，也不证明后端已配置／健康。

owner 通过标准 meta／If-Match 保存准确候选上的 dataset 或 preview 意图。通用 operation 的 SUCCEEDED 表示意图事务已保存；外部执行状态必须读取独立 preview_effects，初始 PREPARED。原键恢复的是同一资源／操作，返回其当前状态，不是重新执行。effect 固定 requestHash、原 remoteKey、准确镜像／dataset／候选和服务主体；数据库短事务只允许一次 PREPARED→SENT 的 dispatch=true，SENT／UNKNOWN／终态再请求均为 false。后端失联或无充分证据保持 UNKNOWN，仅检查原对象。未发送且已过时的 PREPARED 可由可信后端明确关闭为 FAILED，释放后续准入；不把它伪装成外部动作完成。存在未核实意图时拒绝新建替代 dataset／preview。

成功回执核实原 requestHash 与类型、dataset／存储键／来源／schema、准确 preview／image／instance 和观察时间；终态回执不可改写，观察追加保存，并与对象状态及领域事件同事务提交。后端动作、文件操作和网络请求全部位于这些事务外。后续适配器负责实际执行、可靠本地日志、内容／健康证据；本步骤的受控回执测试只证明持久核验规则。

后端重启可按显式 project／policyHash 使用受限分页扫描原 PREPARED／SENT／UNKNOWN 操作；只有配置的原后端主体可扫描。游标按不可删除原行的位置排序，每轮恢复扫描从 0 开始，不把它当作状态变化流；找回 SENT／UNKNOWN 只查询原 remoteKey，不申请第二次执行许可。实际调度消费者仍由后续适配器实现。

首次数据只允许冻结方案声明的 EMPTY／DEMO；迭代预览始终克隆原接受 dataset，即使最终接受方案选择 REPLACE 也不提前清空旧数据。源接受指针、项目、可用状态与 schema 需准确匹配；跨 schema 的生产迁移尚未配置时关闭，不将简单复制视为迁移成功。dataset 不能同时绑定两个可写预览。停止意图使用独立 previewRevision／impactReviewHash，只有原实例可核实退出或取得独立 REMOVED 证明后才 STOPPED／EXPIRED；已被 Release 引用的候选／dataset 拒绝新停止和停止派发。

RunnerDatasetPaths 从已初始化且身份匹配的 Runner layout 解析 `datasets/<projectId>/<datasetId>/app.sqlite` 和同目录 `operation.json`，调用者不能传任意路径；控制面、备份和 Runner 根互斥。路径组件、数据库／日志／WAL／SHM 的链接与硬链接均受检查。该目录独立于 workspaces，预览停止及工作空间清理不删除 dataset；当前只实现保留，不提前实现到期 GC。实际 SQLite 数据适配见下一节；真实实例健康／到期、独立 origin 与接受发布仍按后续步骤实施。

### 8. Local SQLite preparation is a real file operation with one original journal

`DatasetPreparer` 组合实际私有控制面命令与显式配置的 `LocalSqliteDatasetBackend`，不在平台启动时默认启用。未配置返回不可用且保持 PREPARED；先执行只读 preflight，再取得唯一派发许可。只有该次许可返回 dispatch=true 才执行 prepare，后续 SENT／UNKNOWN 仅 inspect。许可提交后 ACK 丢失也不重新派发；准备完成或观察提交后 ACK 丢失则读取原文件／控制记录。受限分页恢复每轮从 0 开始，无公共回执入口。

适配器仅接受严格的原请求、requestHash、项目／候选／操作／dataset、策略、Runner 与 backendRef，固定支持 `web-crud-v1`／`web-crud-v1.schema.1`。首次 EMPTY／DEMO 只执行适配器内可信 SQL；其 schema 和 marker 与原模板一致。未知 schema／模板或跨 schema 迁移关闭，不能通过配置声明伪装为迁移已实现。

每次文件操作由独立 Worker 完成，默认最多 2 个 Worker、128 个等待项、30 秒超时和 64 MiB 文件容量。路径解析只允许受控 ID；新增检查 `receipt.json`、`dataset.json`、writer.lock、临时数据库及其侧文件。新操作先独占创建并刷新 `operation.json`，包含原请求 hash、应用 dataset UUID 与时间；存在此日志时 prepare 只核实，永不重跑初始化／复制。只允许新建本次 `preparing.sqlite`，检查原模板 schema、身份、行数、字段与 SQLite 完整性后独占发布 `app.sqlite`；marker 与完成 receipt 各只写一次，部分文件保留 UNKNOWN，不覆盖、不自动清理。

迭代快照通过只读源连接的读事务和 SQLite backup 取得一致副本，包含已提交 WAL、排除未提交写；副本换用新的应用 dataset UUID，业务记录保留，源数据不写入。副本准备成功后恢复只依赖自己的日志、receipt、marker 和实际数据库完整性，不要求源仍可用。receipt 的 SHA／字节数描述准备完成时的快照，后续合法预览写入不改写原完成证据，不能拿当前可变数据库 hash 强行替代原快照身份。

日志和文件刷新在控制面事务外；Windows 使用有写权限的本次临时文件句柄执行 fsync，非 Windows 额外刷新目录。当前本地 Windows 测试不是 Linux 文件系统或突然断电验收。实际模板兼容、WAL 一致性、写入隔离、原操作并发／重启、实际配额失败及两类 ACK 丢失均单独验证；测试源 Release／源码准入仍是显式夹具，不推导 T5、真实容器或产品通过。装配和恢复说明维护于 `packages/runner/DATASETS.md`。

### 9. Runtime health is a separate append-only observation

迁移 33 保存独立的 `preview_runtime_observations`，不更改已终结的原启动／停止回执。当前可用性必须同时满足准确 dataset READY、预览 READY、未到期以及 30 秒内原实例的 HEALTHY 观察；首次健康成功之后失联、检查失败或超时均关闭当前可用性。历史启动成功仍保留，不重复创建实例来恢复显示。

新启动请求固定完整已核实 OCI 身份（manifest／config／层）、准确 dataset 准备操作、模板／schema 及受控存储键。停止请求固定原启动 operation／requestHash 和原 instanceId。旧请求缺少新增绑定时不作无证据回填；后端只应关闭新准入并保留原对象用于核实。持续观察由原配置后端主体提交，绑定启动原请求；实例一旦核实不能替代，首次核实的 loopback 端口也不能漂移。UNKNOWN 不清空已核实的原 instanceId。

观察在外部 I/O 前取得 sequence，写回使用 CAS、观察时间和原主体检查，避免更慢的旧响应覆盖后来的事实。历史追加、实例绑定、状态变化、Run 版本及事件同事务提交；相同健康状态的心跳只追加检查时间，不持续抬高用户操作版本。首次 READY 回执要求同一次准确 HEALTHY 观察，停止完成要求同一次原实例 EXITED 观察。仅一个自报成功回执不足以显示可用或已停止。

`PreviewLifecycleManager` 使用私有生命周期扫描，覆盖已成功启动的持续健康和待核实原操作，恢复每轮从 0 开始。首次派发前 preflight，取得唯一许可后由后端在实际动作前再次调用 `verifyPreviewExecution`；停止清理始终复核 Release 归属。许可 ACK 丢失、动作 ACK 丢失或观察提交 ACK 丢失均不能获取第二次执行许可。未派发但已过期的启动意图可以明确关闭；已知原实例的未接受预览到期生成独立、幂等的停止操作。原实例尚未知时继续核实，不按名称替代新建，不伪造停止。

Runner 的健康检查只允许后端从原容器事实取得的 `127.0.0.1` 高位端口，固定 GET `/api/health`，不携带平台身份、不跟随重定向；限制响应大小、结构及超时。真实 HTTP 测试仅证明这段请求边界。当前此节控制面和恢复器可用受控容器事实验证，统一持久容量准入见下一节；实例适配／watchdog／模板监听代码见 11～13；真实 Docker／gVisor、硬配额／宿主隔离与可信平台装配尚待继续实施，子项 2.3 保持未完成，不把受控事实称为真实镜像运行。

### 10. Preview reservations share the Runner admission transaction

Runner 前向迁移 v3 为预览保存独立于短租约作业的持久容量预留，绑定原启动 requestHash、完整请求、controller、project、dataset 和固定资源。私有 Worker 同一事务累计所有未退出作业及未释放预览的 slot／CPU／内存；UNKNOWN、停止中和重启后的预留继续扣除。所有准入使用同一显式容量配置，同一 Worker 不接受彼此矛盾的容量值；重启后的较低预算只关闭新准入，不自动释放原占用。

预留成功不是执行许可或健康证明。Runner 原派发位只允许一次 RESERVED→DISPATCHED；丢回执后的重试不再次授权执行。只有从未派发的预留可以明确取消；已派发预留必须由可信后端提供准确原实例 EXITED，或按第 13 节记录独立 REMOVED 证明才释放。原实例、首次端口及 CAS／观察时间不可被慢响应替代，UNKNOWN 不清空身份或退还资源；同一 Runner 上跨 controller 也不能同时为同一 preview／dataset 建立可写预留。

容量增量本身只实现真实 Runner SQLite 迁移、持久预留、统一作业准入和事实核验，不新增公共 HTTP／MCP 准入或回执入口。资源字段来自显式可信容器策略，不由普通用户／模型任意指定；原容器动作日志及独立 watchdog 见后续 11／12，实际 cgroup 与磁盘配额仍需目标环境验证。

### 11. Container actions have a durable Runner journal

在容量预留之外，Runner v4 固定原启动请求、完整容器 profile 和唯一 network／container 名。每个 NETWORK_CREATE／CREATE／START／STOP 动作先提交不可替换 SENT 记录，只有明确收到该次 dispatch=true 才允许外部调用；每一步重新核实当前控制面授权。ACK 丢失或进程重启只查询原名称及 labels，不重发原动作、不按新的配置替代原镜像／目录／网络。物理观察与原对象绑定同事务提交，启动成功和当前健康保持分离。

每个预览使用独立的 internal bridge，不共享可互访的生成应用网络。Docker 适配固定 runsc、非 root、只读根、cap-drop、资源上限、无重启、loopback 单端口与原 OCI manifest／config／层；inspect 复核完整 profile 和原网络／镜像／挂载。dataset 目录保留现有布局，数据库／WAL 可写，但 operation.json、receipt.json、dataset.json 分别覆盖只读挂载，原准备日志不能被生成代码覆盖。真实硬配额和可写目录权限必须由可信配置的适配器落实，缺失则关闭。

容器内模板显式支持受控 APP_HOST=0.0.0.0，默认仍 loopback；宿主端口仅绑定 127.0.0.1。CLI／镜像解析可使用明确测试输入验证，不能据此宣称物理容器健康。已创建但从未启动的清理不能伪造 EXITED；独立 watchdog 和原对象明确清理证明见下节及 13；可信平台装配继续与完整 2.3 一起实施，未验证的 Linux 条件单列。

### 12. Runner expiry and Release custody are mutually exclusive

Runner v5 为新预留显式登记持久归属：PREVIEW、STOPPING、RELEASE_HELD、RELEASE_OWNED。原请求与登记不可替换，状态变化保存不可变历史。只在 RESERVED、尚无容器动作时登记；v4 旧对象不凭当前配置自动收养。停止动作获得派发许可时，在同一 writer 事务将归属推进 STOPPING；接受准备必须先取得准确原实例的 RELEASE_HELD，二者互斥。HELD／OWNED 均禁止预览到期和普通预览停止；未确认接受结果的 HELD 不因超时自动退回 PREVIEW。未来 T5 必须先持有该 Runner 凭据并在准确原接受提交后确认 OWNED；该私有握手本身不实现或证明 T5。

独立 Runner watchdog 只依赖 Runner store／可信 Driver，按原 controller 有界分页扫描、每轮从零开始。到期先持久锁定原停止意图，已派发或 UNKNOWN 只查原对象，不重发停止；原 CREATED 在独立移除证明完成前继续持有资源，不能为清理伪造 EXITED。未派发预留可明确取消；准确原实例 EXITED 或第 13 节独立 REMOVED 证明才释放已派发占用。网络／容器移除及从未启动对象的清理证明见第 13 节，完整 2.3 保持未完成。

到期判断同时使用 Worker 内单调时钟和原墙上时钟截止时间；观察到期在当前 Worker 锁存，外层事务回滚也不撤销该观察，成功提交后持久锁存跨重启保留。每次成功检查更新持久墙上时钟高水位，重启发现时间回退则关闭继续执行并按到期处理；不会用短时作业租约延长预览。单调时钟不能跨主机重启证明未被观察到的时钟变化，目标 Runner 仍须可信时间。定时器关闭等待在途工作结束，失联、单对象失败或丢回执不阻塞其余对象的扫描。

### 13. Removal has its own proof and forward migration

Runner v6 为准确原容器增加 REMOVED，区别于进程 EXITED；PREVIEW_REMOVED 回执必须对应同次原实例 REMOVED 观察。按 SQLite 的事务重建流程扩充预留 CHECK，逐字保留原行／索引／触发器及外键，核实后恢复 foreign_keys；不修改 v2～v5 迁移正文。新清理日志固定原 profile、启动 hash、STOP hash、容器／网络 ID，每个移除只有一次 SENT／dispatch，观察与未释放容量的 REMOVED／历史同事务提交。

仅 STOPPING 且有准确原 STOP／容器／网络绑定才可清理。先核实原容器为 CREATED 或 EXITED，立即复核授权后按准确 ID 执行不带 force／volumes 的 rm，再用成功的 Docker 原 ID 列表查询证明消失；命令非零、超时或 inspect 找不到不直接当作已移除。ACK 丢失只查原 ID，不重发；创建结果尚未知且没有已核实 ID 的对象继续持有资源，不能凭空列表释放可能仍在创建的实例。dataset 不移除。

准确原容器消失后才能移除原独占空网络。Runner watchdog 另扫已停止但清理未完成的原记录，包含已 EXITED／REMOVED 释放容量的对象，网络移除丢 ACK 后仍可恢复，不因活动预留扫描排除它而遗失。HELD／OWNED、未登记旧对象及运行中／未知容器都不会被清理；每步最后授权和原对象校验保留。Windows 的受控 Driver 事实不构成实际 Docker 移除或 Linux 隔离验收。

### 14. Preview access admission is durable and does not assert data quiescence

独立 HTTP 网关使用每个 preview 独立的 host，不以换端口或共享 path 代替应用隔离。平台身份与预览短期用途凭据分开，正式部署还须隔离可注册域及 Cookie 作用域；HTTP／浏览器验证另行接入，不把仅有授权表当作网关已运行。

迁移 34 为显式可信装配登记不可替换的 gateway／project／configurationHash／service principal 策略；没有公共登记或回执入口。每次访问先以用户成员身份取得准确原 preview／image／dataset／实例／loopback endpoint 绑定，并核实 READY、新鲜健康和期限；健康年龄须在 0～30 秒内，控制时钟回拨后原未来观察不保持可用。owner／operator 可写业务预览，viewer 只读；这不授予平台写权限。服务主体、配置、项目及原请求均不能由请求 URL 任意替换。

dataset 写门只由原数据后端显式登记，固定原准备 operation／hash；缺登记关闭访问。关闭门使用固定原请求、递增 fence 和不可变历史，与访问派发在同一 SQLite writer 串行。读请求仍可通过关闭门；新写请求不通过。每次 HTTP 访问持久保存方法／路径／body hash、准确目标、用户及原 fence；只有明确一次 dispatch=true 才可转发，并在实际发送前复核授权。丢许可、未知请求或重启后不重发写请求，UNKNOWN 不因超时减去在途写计数。

该门仅证明网关准入与原请求观察，不证明 HTTP 实际发送、数据库写成功或后台写入已排空。GET／HEAD 只按 HTTP 安全方法分类，模板仍须证明这些路由无写副作用、无绕开网关的后台写入；不能把方法名当作数据库只读强制。真实 HTTP 适配器必须回填原请求的完整响应或明确未发送事实；无法核实保留 UNKNOWN。T5 的数据排空／Runner 停止或 fencing 证明以及明确未提交后重开门的协议继续实施；本增量没有自动超时重开接口，不伪造迁移或接受准备完成。

### 15. Preview tickets and sessions have different durable purposes

票据／会话只在显式可信网关内生成 256 bit 随机值，控制 SQLite 仅保存带不同用途前缀的完整令牌摘要、原用户／项目／预览／目标、平台与预览 origin、原期限及追加历史。迁移 35 增加两类独立用途和复合归属外键；不修改旧迁移或回填旧预览的登录权限。原票据最多 60 秒，消费与唯一会话创建同事务，单会话最多 5 分钟且不超过原预览到期；私有原参数重试只能恢复同一个会话，不能用消费过的票据另建会话。凭据只在 body／受限 Cookie 传递，不进 URL、日志、模型上下文或导出。

每次消费和使用均复核原 gateway／configurationHash、精确 origin、当前成员、准确原目标、健康及期限；会话不固定旧写门 fence，后续每次请求重新取得当前 fence，关门后仍可读取。会话撤销是独立原子事实，不能删除未确定写请求或重开写门。原参数和终态不可覆盖，令牌摘要跨用途不复用，活跃凭据按项目／用户限量；ACK 丢失、成员撤销、重启和事务故障按原记录恢复。

HTTP 网关使用 HTTPS、每预览独立 host，与平台隔离可注册域；Public Suffix List 判断包含 private domains，不把字符串末两段当作可注册域。开发模式仍显式监听 loopback，测试证书仅在运行时临时生成，不进入 Git。公开交换入口仅允许原平台 Origin 的 JSON POST／准确 CORS，设置 host-only、Secure、HttpOnly、SameSite=None 的预览用途 Cookie，禁止向生成应用转发任何平台认证或 Cookie，剥除上游 Set-Cookie，限制 CSP／sandbox／Service Worker。共享部署仍需真实证书、身份和 DNS 验证。

HTTP 业务请求须绑定实际转发的方法、原路径、正文和筛选后 headers 的摘要；旧持久请求缺 headers 摘要时只读恢复，不猜测头字段或转发。写请求的幂等键映射为按用户／预览／网关隔离的稳定原请求 ID；重复或未知原请求只返回原状态，不自动重发。只在该次唯一派发和最后授权后调用可信 Runner 本地传输；传输核实本地 Runner／controller 的原预留、原实例／端口与实际 Driver 健康，固定 loopback，禁重定向／任意 URL／自动重试，限制请求、响应、超时及并发。完整响应后保存原 FINISHED，再次核实会话方可向用户返回内容；连接不确定保留 UNKNOWN，明确尚未创建请求才可保存 NOT_SENT。

以上为 3.1／3.2 的目标装配与验证协议，具体已实现范围仍以 tasks.md 和实际证据为准；不将新授权表、受控容器事实或本地 HTTPS／浏览器测试代替 Linux／企业身份、物理数据排空或 T5 验收。

### 16. Platform preview entry uses authenticated reads and an explicit access action

3.2 复用平台 Input API 的可信身份解析和 loopback 请求边界，通过显式组合的 gateway 提供准确 Run／preview 查询、只读预览页及 POST 访问票据。未配置身份不开放入口；未配置网关、健康失效、到期和停止状态分别显示，不泄露 Runner 端点、实例或宿主路径。POST 票据要求准确平台 Origin 和空 JSON，主体只能来自解析后的身份；GET 页面与状态不签票据、不启动实例、不接受候选。`startPlatform` 只显式传入组合对象，不从客户端字段登记 service principal。

现有本地平台使用固定 loopback IP／端口；开发模式允许它作为平台 origin，预览仍为独立 HTTPS DNS host 且仅 loopback 连接。共享模式继续要求平台 HTTPS 与不同可注册域，不能把开发例外带入共享部署。浏览器从平台先签票据，再在准确预览 origin 兑换 HttpOnly Cookie，并通过仅允许原平台 Origin 的会话查询确认浏览器实际保留凭据，最后设置受限 iframe；原票据不进 URL 或父页面持久存储。

下载从准确冻结候选的 delivery materialKey 解析原操作／hash／字节数，经内容存储权限、实际内容校验及发送前成员复核后，以 attachment／octet-stream／nosniff／sandbox 输出。调用者不能传内容 hash 或宿主路径；历史候选可只读查看，下载不修改接受指针、Run 终态或质量。下载失败只影响该次读取，不重新生成或接受。此入口不实现导出打包任务或企业登录提供者；各自按已有工作包继续。

### 17. Acceptance intent precedes any readiness proof

迁移 36 新增私有 acceptance_backend_policies、acceptance_data_decisions、acceptance_preparations 及不可变历史。可信宿主显式配置接受后端策略，不因已有预览后端或 owner 身份自动启用。负责人以标准原键／If-Match 固定准确 candidate revision／manifestHash／reviewHash、原接受指针、原数据来源、数据方案、镜像和 Run 代际；服务端预留 releaseId／targetDatasetId 与派生存储键，客户端不能传目标路径、健康或 READY。策略登记及意图提交不创建 dataset 文件、Release 或接受指针。

REPLACE 必须有独立的准确确认记录，绑定候选、reviewHash、原 release、完整 dataPlanHash 与实际确认主体；初始方案不能伪造替换确认。原接受数据的具体内容 hash 不在关闭写门前虚构固定，目标始终为新 ID，不静默使用可写预览克隆。后续可信准备协议仍须实际关闭／排空、快照／迁移、Runner 归属与健康凭证；迁移 36 接口本身没有 READY 或提交命令；第 18 节补充独立证明／观察协议，实际适配器及完整验证继续，4.1 保持未勾选。

原项目只能有一项未核实接受准备。只有 PREPARED 可申请一次 SENT 派发许可，并重新核实当前候选、审查、权限及原接受指针；丢派发 ACK 后不重授，SENT／UNKNOWN 只查询原 operation／requestHash／远端身份。当前 owner 可用独立命令关闭准确从未派发的 PREPARED，不能关闭 SENT／UNKNOWN 或靠 TTL 清除。状态、历史、operation 与事件同事务；历史只追加。恢复分页仅供准确策略的后端主体扫描，不开放公共 HTTP／MCP 注册或回执入口。

### 18. Prepared proof is immutable; availability is observed again

迁移 37 把准备证明与当前健康观察分开。原 dispatch 状态继续 PREPARED／SENT／UNKNOWN／FAILED，新增只读 readiness 投影 UNPREPARED／READY／UNAVAILABLE／STALE，不凭意图 ACK 或历史健康完成接受。完整证明固定原请求／候选／审查／数据方案／目标数据与 schema、实际快照／完整性／迁移／journal、源逻辑关门／物理 fence、目标关闭 fence、准确 Runner reservation／profile 和 RELEASE_HELD claim。首次写入不可替换，后续失联保留原证明。

当前观察只允许准确后端主体写入，核实同一 fence／claim／实例／端口的当前持有与健康；健康年龄须在 0～30 秒、时间不回退、custodyRevision 维持跨 UNKNOWN 的高水位。preparationRevision 与观察 sequence 双 CAS 防止核实期间准备变化及慢响应覆盖；同一毫秒内后提交的原准备 UNKNOWN 也按持久版本关闭旧 READY，不用墙钟判定提交先后。重复原观察只读恢复当前投影，不能复活旧 READY。证明／观察／Run 资源版本／事件同事务，当前依据改变或不确定写未排空拒绝 READY。源关闭记录和物理 fence 必须先于快照；物理隔离由实际适配器落实，逻辑计数不能代替。

`AcceptancePreparer` 为可信装配提供恢复控制器：缺后端不派发；首次唯一 grant 才 prepare，原 SENT／UNKNOWN 或丢许可 ACK 只 inspect，每个新外部动作前须通过最后授权。没有默认具体后端，也没有公共回执入口。受控证明测试仅验证 Worker 绑定、恢复及原子性，不是实际数据／fencing／容器健康验证。实际适配器、正向保留／替换和 T5 继续原范围，4.1 保持未勾选。

### 19. Dataset ownership spans preview and acceptance without fabricated effects

迁移 38 将原策略实表原位更名为 dataset_backend_policies，以 PREVIEW／ACCEPTANCE 区分用途；preview_backend_policies 保留筛选兼容视图及原登记语义，接受策略只从真实 acceptance_backend_policies 镜像。不可变 dataset_preparations 绑定准确 project／dataset／原 operation／requestHash／policy／用途和 baseReleaseId。预览仍由原 DATASET_PREPARE effect 登记，接受由原 acceptance preparation 登记，不伪造预览策略或 effect。

接受意图同事务登记 PREPARING 的目标元数据、归属和初始 CLOSED 写门，不创建业务文件或声称准备成功。保留迁移才把旧数据登记为物理 origin；REPLACE 的 origin 为空，原接受版本仅作为 baseReleaseId 保留。接受准备数据暂无限期保留，retentionUntil 使用明确的无限期标记 9999-12-31T23:59:59.999Z，不按预览 TTL 清理。准确准备证明落库时推进 WRITE_FROZEN；未知观察不改写已固定数据身份，也不能开放写门。

共用写门保留原物理名称 preview_write_gates／closures／events，外键改为通用 dataset_preparations，旧访问请求及历史保持原样。新接受目标允许 fence=revision=0 的初始 CLOSED 且没有“从 OPEN 关闭”的记录；该状态仅可用于接受用途。源数据关闭由准确接受后端／原准备授权，固定原源数据操作与 hash、expectedFence，闭门、历史和 Run 事件同事务；闭门 ACK 恢复原记录，逻辑闭门不证明后台写入已停止或物理 fencing。当前不提供开放或超时重开命令。

写门采用受校验前向重建：仅带入校验和的明确 rebuild 标记迁移在事务外暂关 foreign_keys，单 writer 事务内复制旧行、重建外键／触发器并 foreign_key_check，成功或失败均恢复原 pragma；事务内调用拒绝。失败连同 schema／迁移历史／版本标记回滚。旧准备／证明只回填准确元数据，不回填新的健康、物理 fence、Release 或接受事实。实际数据适配、服务装配与 T5 继续原 4.1／4.2 范围。

### 20. Actual acceptance data uses its own journal and verified custody

接受数据组件直接消费原 acceptance preparation，不翻译为 PreviewEffect。本地 SQLite v2 journal 固定 ACCEPTANCE 用途、完整原 request／hash 和独立 appDatasetId；源／目标实际 fence 的原证明另存不可变记录，完成回执绑定实际 SQLite SHA／大小／完整性、snapshotAt 与 journalHash。它只返回数据阶段证据，不生成服务健康、完整 prepared proof、Release 或 T5。

物理隔离通过显式可信 authority 装配：preflight 只读检查，唯一 journal 的胜出者才 acquire 原 fence，新建原 journal 前、取得 fence 前及快照／发布阶段重新检查当前授权；复制后发布前再次 inspect 原 fence 和授权。恢复只 inspect 原 fence／日志／文件，不能 acquire、重新初始化或重跑迁移。没有实际 authority 时派发关闭，接口字段或逻辑门不能产生物理隔离证明。真实 Linux／隔离适配器继续单列缺项。

INITIAL／REPLACE 按原方案初始化 EMPTY／DEMO，REPLACE 不复制旧数据且保留旧 sourceReleaseId；PRESERVE_MIGRATE 使用最新受 fence 保护的 SQLite 一致副本及独立应用身份。迁移必须读取准确 artifactRef 的实际字节、核对 SHA 并匹配操作方配置的可信摘要；首个内置执行计划仅允许已固定 web-crud 同 schema 的一致复制，不执行模型 SQL／任意脚本，其他迁移缺配置即关闭。v1 预览与 v2 接受的原 journal 共用受限读取／归属核验，后续预览可读取准确接受数据源，不伪造原用途。接受目标检查严格复核原字节；作为已接受业务源复制时允许合法后续业务写入，但仍复核准确原操作、marker／schema／项目和 Runner。

模板只读连接使用 SQLite 原生 readOnly 与 query_only，不切换 journal_mode、不依赖 mutate 的入口检查来防止修改数据库文件头；固定 DELETE 模式目标经模板只读打开／查询／关闭后仍保持相同文件字节。模板进程锁继续只表示进程准入，不算物理 fence；其他服务归属和实际写排空继续独立验证。

### 21. Acceptance services retain their own Runner purpose and capacity

接受服务以 ACCEPTANCE 原请求登记，不构造 PREVIEW_START 或预览 effect。原服务请求固定完整接受依据、原数据回执及源／目标 fences；Runner 预留固定其摘要、真实用途、原 operation／release／dataset 和资源。服务 profile 独立固定仓库、目录、只读访问、配额与唯一网络／容器名。Runner v7 前向迁移保留旧版本迁移正文及历史，不收养旧预览为接受服务。

作业、预览与接受服务共用一个 writer 的 slot／CPU／内存准入；跨用途 dataset 独占，UNKNOWN 和重启均继续占用。只有从未派发可取消，派发后的资源仅在准确原容器 EXITED 观察后释放。每个 network／create／start 先持久 SENT，唯一 dispatch 才可执行；丢许可／执行 ACK 只查原名称／profile／ID，不能补发或替换。原实例、端口、观察 CAS／时间及不可变历史一并核验。

接受服务使用独立 `devmesh.acceptance-service-claim.v1`，固定原接受 hash、服务 requestHash、reservation／profile、release／candidate／review／dataset／image 及原实例；原预览 claim 协议保持兼容，预览专用入口仅接受原预览 schema。只有新鲜的准确 HEALTHY 观察且没有释放容量时可推进 RELEASE_HELD；未知提交不因超时解除，预览 watchdog 不扫描或停止该用途。HELD 仅为准备归属，不表示 T5 或 RELEASE_OWNED。完整后端装配、物理容器／fencing、明确未提交后的安全撤销、T5 与发布继续原范围，4.1 仍须按完整验收判断。

### 22. T5 records acceptance separately from dispatch and publication

T5 由 owner 的独立 `commitReleaseAcceptance` 命令触发，原幂等键先于当前性检查恢复已提交结果；新命令在单一 BEGIN IMMEDIATE 内核实原 preparation／requestHash／revision、最新观察 sequence／proofHash、当前候选／完整 reviewHash、原接受指针、Run 代际与 OPEN、全部 READY 内容及无未知写。新提交要求完整 ACCEPTANCE 服务 claim；旧预览 claim 的历史证明可读，不作为新服务用途替代。事务只读本地持久证据，不持锁执行 HTTP 或文件操作。物理材料复核和后端装配继续由可信调用层落实，缺失时不能将领域测试称为完整接受联调。

迁移 39 保存不可变 acceptance_commits，关联准确 Release、原准备／证明／观察和本次操作；保留原 SENT／UNKNOWN 派发历史，不把成功改写为 FAILED。项目唯一未核实准备采用 writer 内查询及数据库准入触发器：已有提交记录或从未派发的 FAILED 才解除占用，未知准备不靠 TTL 解除。新命令完成 Release、指针 CAS、必要 MANUAL_PENDING Work 的独立人工完成记录／Attempt／slot、Run COMPLETED、原操作结果、专用 promotion Outbox 与事件。任一步失败全部回滚。

人工完成固定原 assessment 和本候选已通过的具体人工结果，不修改自动检查、自动状态、原质量或原证据。不可变 promotion 意图固定原请求、数据、镜像、HELD 服务及 fence；普通 A2A Outbox 不消费此用途。T5 返回已接受与发布待处理两个事实，后续服务归属确认、路由切换、开放新门和导出各自恢复，失败不得倒退接受事实。所有新历史及 Release 禁止更新或删除；旧 Release 不因迁移伪造准备证明。

### 23. Trusted preparation composes real data, an exact read-only service and a stable proof

接受服务 Driver 直接消费 ACCEPTANCE 原请求及独立只读 profile，不翻译成预览 effect。预览与接受只共享底层 Docker 参数／inspect 安全核验；用途 labels、原请求／profile、数据挂载和 APP_READ_ONLY 各自准确固定。接受容器整个 dataset 只读挂载，仍须 runsc、非 root、只读根、资源／硬配额、独占受隔离网络、准确 OCI 和 loopback 单端口；缺可信 Linux／quota／network 配置关闭派发。

显式 RunnerAcceptancePreparationBackend 依次核实原接受、实际数据 journal／回执／当前物理 fences、持久服务预留／profile、唯一原动作、实际 HTTP 健康与准确 HELD claim。每次新外部动作前再次检查当前授权和原 fence。恢复只查询原对象及追加准确观察，不重发 network／create／start，不补建替代对象。数据已完成而服务动作未获原许可时保留待核实，不用 inspect 隐式续发；安全撤销及后续发布仍依独立协议推进。

Runner v8 新增不可变完整 prepared proof，原 v2～v7 迁移正文／摘要不变。只有准确原服务已 HELD 且新鲜健康时才从持久请求、原数据回执／fences、profile 与 claim 生成首份证明及固定 preparedAt／custodyRevision；后续健康心跳或重启只返回原证明，当前可用性另按新鲜观察核实。证明创建失败回滚；丢 ACK 恢复同一证明，不凭当前时间重构新 hash。该记录和显式受控 Driver 测试不代替物理 fencing／真实容器联调，完整 4.1 和产品验收仍按实际证据判断。

### Abort decision precedes destructive recovery

安全撤销首先由当前 owner 使用独立 meta／Run scope／强 If-Match、原准备 operation／hash／revision、原因和明确 ABORT_ACCEPTANCE_PREPARATION 写入不可变决定。迁移 40 保存完整原准备、实际已存在 proofHash（没有则 null）、操作者与时点，和 T5 共享单一 SQLite writer；原接受已提交、指针切换或目标已属 Release 时拒绝撤销，已有撤销决定阻止 T5。相同键恢复同一结果并重新核实 owner，新键不能替换决定。原依据 STALE 或 Run 取消不阻止 owner 关闭原执行权，未派发对象继续使用明确未派发失败协议。

决定之后投影为 ABORTING，原 SENT／UNKNOWN 历史、proof／观察和 CLOSED 目标不变。新外部准备授权、当前 READY、新观察、UNKNOWN 更新和源闭门全部关闭；数据库反向触发器阻止迟到证明／观察／Release／提交和目标开门。恢复准备器跳过撤销中的对象，原后端和当前成员可按原请求 hash 查询准确决定。决定事务无外部 I/O，事件／Run 版本／操作结果失败全部回滚。

决定不是物理清理证明。决定前已授权的外部动作仍可能在途，拒收迟到 READY 不表示 Runner 已停止；必须先按原对象核实。决定事务本身不执行服务停止／移除、fence 解除、源写门恢复或容量释放，不产生 ABORTED；项目未核实准备占用继续保留。Runner 服务清理按下节独立核实，只释放已明确清理的服务容量；源恢复／目标停止／fence 交接未齐全不得解除项目占用或重开旧门。完整4.1仍未完成。

### Runner cleanup is bound to the original abort decision

Runner v9 前向重建接受服务表扩充 REMOVED，逐字保留旧行／索引／触发器和 v2～v8 摘要；外键关闭仅用于迁移事务，检查后恢复。独立不可变撤销记录绑定原准备 operation、controller、完整控制面决定／hash与可空原 reservation；即使尚无 reservation 也保存记录，阻止迟到创建原服务。准确原后端显式读取控制面决定，调用方不能传入任意清理决定或公开取得破坏性权限。

登记后禁止新 network／create／start、当前事实／新 HELD 和新 proof；已存在 proof 仍只读恢复。旧派发日志允许观察已获许可的原对象，用于核实在途创建的真实 ID，但不得启动新动作。原容器 ID 仍未知时继续持有占用，不以 inspect 失败或空列表释放可能仍在创建的服务。仅实际无容器动作的预留可明确取消；只有网络时单独移除原网络。原 CREATED 不伪造 EXITED。

STOP／CONTAINER_REMOVE／NETWORK_REMOVE 使用独立固定原决定、profile、服务 hash 和准确 ID 的 SENT／OBSERVED 日志，每动作只有首次 dispatch=true 才能执行。Driver 复核完整原 profile／用途，非 force／volumes 移除原停止容器，原网络须为空；成功完整 ID 列表查询才证明消失，命令失败或超时保持未知。丢 ACK／重启只查原动作，不再执行。容器消失证明、REMOVED、占用释放和历史同一 writer 原子保存，网络后续恢复不受已释放容量的扫描条件排除。

Runner 服务清理结果不等于完整 ABORTED：目标业务文件／原 claim／proof 保留，物理数据 fence 解除、源恢复、控制面占用解除与旧门重开仍需独立握手和证据；真实 Linux／gVisor／quota／networkIsolation 验收单列。4.1 在这些条件齐全前不勾选。

### Dataset abort has a permanent revocation and an independent original journal

服务和网络已由原决定核实清理后，显式 RunnerAcceptanceDatasetAbortBackend 再从控制库读取相同不可变决定、从 Runner store 读取已完成的原清理记录；请求方不能提交任意决定或清理成功标志。独立 Worker 在原目标 dataset 目录独占写入并刷新 `abort-operation.json`，固定决定／controller／清理摘要、原准备 journal 摘要及已保存原 fences；日志存在后永不重派数据撤销，半写文件和失联保持 UNKNOWN。准备 Worker 看到该文件即关闭原准备，包括尚无数据 operation.json 的情况；并发在途动作仍须物理适配器永久撤权，文件标志不能替代它。

专用 AcceptanceDatasetAbortAuthority 必须持久封禁原准备的后续 acquire／写入，并核实已获许可的原操作终止，目标继续 CLOSED；按准确原 fence／generation 解除原接受持有并恢复原源 release 归属，返回稳定、可查询的原证明。原 fences 尚未落盘时不能以缺文件推断从未 acquire，适配器须查询自身原记录并覆盖该在途边界。证明绑定决定／原请求／原 fences／目标和源，后继 generation 严格增长；源即使恢复物理归属也标为 CONTROL_CLOSED。只有首次日志创建者可在最后授权后调用 abort，恢复只 inspectAbort，不续约、重派或删除数据；完成回执独占持久化，保留原准备日志／fences／receipt。

物理后端调用另按该实例 maximumWorkers 限制未结束数量，文件 Worker 超时不提前释放仍在进行的后端调用名额；查询或撤销未返回时，后续调用明确保持忙／未知。缺物理适配器默认关闭；本地夹具只验证协议／真实文件日志和恢复，不证明物理 fence 已解除。本步骤仅生成数据归属恢复证明，不自动重开控制面源门、释放项目占用或投影 ABORTED。后续控制面还须在同一 writer 核实原接受指针、源门准确关闭记录、原未知写的处理与源服务恢复，保存完整撤销结论后才解除占用；完整4.1继续。

### Abort completion is a separate atomic control fact

前向迁移41保存不可变 acceptance_abort_completions；原准备 SENT／UNKNOWN、错误、revision、proof及撤销决定全部保留。只有原 backendPrincipalId 可以提交完整证明或读取私有恢复上下文，普通 owner 无完成标志入口。RunnerAcceptanceAbortFinalizer 显式启用，读取原控制决定、Runner SQLite 清理、数据 Worker 原回执；缺源服务恢复适配器保持 UNKNOWN。重复完成先复核原后端及原决定，再返回准确原结果，不受后续健康过期／新准备影响。

完成事务绑定原决定、controller／清理摘要、数据 abort request／journal／永久撤权证明、原 prepared fences 及严格递增的后继 generation，目标永久 CLOSED。存在源时还须原 accepted pointer 未变，旧 Release 冻结镜像一致，独立可查询的 RELEASE_OWNED／READ_WRITE 服务及准确恢复 fence，健康不超过30秒。原 DISPATCHED／UNKNOWN 写请求不得被恢复证明抹掉；必须先核实原请求结局。只允许重开本准备准确关闭的旧源门，fence／revision各加一，原关闭记录及历史保留；未关闭的原 OPEN 门不制造一次关开。其他门／目标门不适用该重开权限。

完成事实、源门 CAS、门历史、Run资源版本和事件同一 writer 事务；任一点失败全部回滚。提交后投影 ABORTED 并解除本准备的项目占用，但不创建 Release、不切换接受指针、不删除数据、不放行旧 T5 或晚到准备。4.1仍需真实源服务恢复、保留迁移／替换全流程与物理验证，不能凭控制协议夹具勾选。

## Risks / Trade-offs

- 接受准备实例的只读挂载／APP_READ_ONLY与profile不可变，T5或开放逻辑门不能直接变为可写服务。4.3须独立验证准确原归属下的新可写服务、健康及写fence交接；不能改原proof、凭接受成功宣称可写或同时开放旧新dataset。Runner v11独立发布组件与受控联调已实现；真实物理转换、Release入口与默认装配继续实施与验收。

- [无真实模型／容器／OIDC] → 本地可验证接口、签名用途、访问隔离和恢复；真实构建／启动／健康和人工产品验收单列缺项，生产能力未配置即关闭。
- [复用旧质量或人工结论] → 绑定候选完整 manifest、原质量、条目和 reviewHash；新候选重新审查，原失败追加保留。
- [接受与外部动作竞态] → 数据准备 fencing、原接受指针 CAS、短 T5、单一发布 Outbox；未知不重发。
- [大候选／审查阻塞 Worker] → 沿用 256 KiB 请求限制，逐项写入和分页历史，当前投影设置条目和序列化总量上限；不返回无界正文列表。
- [身份尚未接入] → 复用显式 local-development 的可信平台主体边界；公共服务 token 无人工确认入口；不将本地测试主体称为企业用户认证通过。

## Migration Plan

按现有前向编号新增审查、dataset／预览、接受准备与发布表及内容外键，启动前由现有备份／migration 流程保护。先部署默认关闭的领域 API 与只读投影，再显式配置可信适配器和独立预览 origin。历史候选不回填人工通过、准备凭证或 Release；无 candidate_freezes 的旧候选只能历史阅读。故障回退关闭新准入，保留已提交记录并恢复原操作，不回滚已接受事实或清理 dataset。

发布路由也属于派发基准：固定上一个release／route hash／generation，release_route_bindings与新proof、数据READY／旧数据RETIRED、目标开门和事件同事务更新。初代无旧路由，后代准确上一代加一；旧PUBLISHED仅是历史发布结论，不能作为当前健康或当前路由的保证。

### Runner publication retirement is an independent original journal

Runner v10前向增加不可变release_retirements／追加actions，原v2～v9 SQL和摘要不变。显式RunnerReleaseRetirementBackend自行从控制库核实原SENT／UNKNOWN、策略身份和固定basis，再绑定Runner原稳定proof、只读profile、准确容器／网络登记；不会以调用者声明替代正式T5。登记、每阶段唯一SENT派发和独立观察分别持久化。

REVOKE_PREPARATION必须由专用可信物理Authority永久封禁原acquire／renew／写入并排清已获许可动作；逻辑记录不证明撤权。随后STOP→CONTAINER_REMOVE→NETWORK_REMOVE，Driver末次复核原授权，成功准确ID查询才证明消失。容器观察、接受服务REMOVED、容量和历史同事务，失败全部回滚；原profile、claim、proof及dataset文件不改。

交接和原abort决定互斥，迟到服务变更关闭；dataset交接占用独立于容量，其他preview／acceptance不能抢占。网络未清理的已释放服务仍可按原controller分页找到。登记ACK或阶段ACK丢失后只查询已持久原动作，不重发、不从查询发出下一未派发阶段；跨步骤中断保持未完成，继续协调协议尚待实施。该适配器只完成只读服务退役，不返回PUBLISHED；独立可写容量／guard／fence／路由、默认装配和实际入口／导出仍继续4.3，完整任务不勾选。

### Runner writable release service

在独立原只读服务退役完成后，v11 前向新增 release_service_handoffs／reservations／profiles／actions／events／proofs；原 v2～v10 SQL 保持不变。ARM_FENCES 持久核实原 HELD 的后继代，目标 ARMED 且 CONTROL_CLOSED、源 RETIRED 且 CLOSED，保留永久撤权。迭代必须绑定原本地已发布 service／route；源 STOP／准确容器消失与容量释放原子提交，网络清理完才预留新可写容量。

全 Runner 单 writer 共同计算 job／preview／acceptance／release 的 CPU、内存、槽位；新 purpose=RELEASE profile、reservation 和容器独立于被退役的只读服务。GUARD_ENFORCE 必须在任何可写创建／启动前持久核实 ALL_DATASET_WRITES：精确物理代和当前控制 gate 同时准入，包括后台与直接文件写入，代理标志不能替代。随后 NETWORK_CREATE→CREATE→START、准确健康观察、内部生成 RELEASE_OWNED claim、ROUTE_BIND，凭证只从原 journal 派生一次；只有控制发布事务可以开门。

每阶段只有唯一持久 SENT 获准物理派发，查询仅记录已派发阶段观察，不预留、不接管、不创建、不切路由；缺 Authority／guard／route 的实现保持关闭。跨阶段自动继续和默认生产装配仍需后续完成，单独 writer 或受控物理 fixture 不代表完整 4.3 或产品验收。

### Release access uses its own purpose and the shared pending-write barrier

Release 入口要求当前 accepted 指针、PUBLISHED 原证明与持久 route 同时准确匹配；接受已提交但路由未恢复时返回恢复中，不回退到旧 release。前向迁移43增加独立 release_access_policies／requests／events 与 release_tickets／sessions／credential_events，不伪造 PreviewEffect 或使用 PREVIEW 凭据。固定 RELEASE target 包含原 publication proof、claim／profile／reservation、Runner／controller、准确实例／网络、loopback 端点及 route hash／generation。每次签发、兑换、鉴权、派发及发送前复核当前成员和绑定；可写还须原 OPEN gate、初次发布 fence／revision 及原数据操作准确匹配，viewer 只读。原 CLOSED 门允许新准入安全方法，但实际原物理服务／guard 不可用时仍关闭访问。

票据最长60秒，会话最长5分钟，256 bit 随机原串只在签发／浏览器 Cookie 边界使用；库内只存摘要和固定目标，每成员／项目各最多20项有效票据和会话。独立 dmr_ticket／dmr_session、host-only Cookie、r-摘要 host、准确平台 CORS 和受限 iframe 与预览用途隔离。共享模式保持独立可注册域及 HTTPS；平台 GET／view 不签票据，access POST 要求可信身份、准确 Origin 和空 JSON。默认未配置返回明确状态，不引入企业身份假实现。

Runner 转发仅在原 Runner 节点连接原 loopback，先实际查询原独立可写 journal、稳定 proof、当前 guard／fences／route 及 HTTP 健康；再次检查控制授权后才构造一次有界 HTTP 请求。不接受 URL、重定向、连接池或自动重试。请求保存净化后 headers／body 摘要、原目标及 gate fence／revision；唯一派发回执丢失不转发，构造 HTTP 后的不完整响应记录 UNKNOWN。完整响应先记账，再复核成员／会话才返回正文。

business_pending_writes 合并预览和 Release 的 DISPATCHED／UNKNOWN 写。接受准备／T5、发布、门 pending 计数和撤销恢复全部接入该屏障；新派发与关门在同一个控制 writer 串行，补充 SQLite 触发器拒绝未确定写下的提交／发布／旧门恢复，历史迁移1～42正文不改。注销、移除成员或路由切换不解除原写占用，历史原请求可核实但不重派。该增量仍须实际 HTTPS、控制／Runner／业务 SQLite 联调与原失败留证；物理 Provider 和独立产品验收缺项不因此消失。

### Publication continuation grants each unstarted stage separately

恢复查询 inspect 继续禁止派发。新增显式 resume 协调原发布，先读取原动作结果；仅在控制面新 continuation 核验确认原 SENT／UNKNOWN、当前接受指针、原请求／basis、准确关闭门与无未决写后，才尝试 Runner 已有阶段的唯一 actionBegin。已派发阶段只查询，不重发；前驱未核实不开始下一步。没有原 Runner 登记时可按同一请求登记，不创建替代资源。初次 publish 及原 verifyReleasePublication 的 SENT 边界不放宽。

配额准备也属于物理动作。Runner v12 新增 PROFILE_PREPARE 阶段、原 profile 的执行模式，prepared 查询只验证准确目录／字节上限。新 profile 同事务登记 EXECUTE_ONCE，唯一许可后才 prepare；ACK 丢失只查。v11 既有 profile 在迁移中标 INSPECT_ONLY，不回填已完成，不在恢复时重新 enforce；配额无法验证则保留未完成。迁移保留历史 SQL、原行／动作／proof／容量，失败完整回滚。后续重新 own 和 prepareProof 只恢复同一不可变本地事实；任何配置／guard／fence／原实例变化关闭后续派发。

本轮不把导出、正式后继保留／替换 T5、默认装配或物理 Linux 验收计为完成。4.3、5.1、5.2 继续按完整范围验收。

### Accepted Release export is a separate frozen job

独立导出协议和约束见 [export-design.md](./export-design.md)。迁移44独立持久化 job/snapshot/材料引用/历史，ZIP仅从固定原源码与正式材料生成；失败和重试不触及 T5 或发布。API 排队/列出/查询/重试/下载与显式 ReleaseExporter 分离；默认调度装配和通用回放/导入仍按原范围继续。

### Private manual review product entry

既有逐项审查和退回域新增私有HTTP／React入口，详细决定见[review-entry-design.md](./review-entry-design.md)。原自动检查和候选不修改；历史withdraw能力由服务端当前owner／Run控制，原成功请求按原键找回。此入口是5.1组合的前置，完整准备、T5／发布和产品默认装配继续按任务验收。

### Acceptance entry

准确准备／替换确认／原操作查询／撤销及T5公共入口见 [acceptance-entry-design.md](./acceptance-entry-design.md)。

### Private React acceptance entry retains explicit decisions

发布原操作的可信宿主消费、未决队列与停机边界见 [publication-consumer-design.md](./publication-consumer-design.md)。

可信接受准备后台消费的范围、固定绑定、未决队列、周期健康和停机排空见 [acceptance-consumer-design.md](./acceptance-consumer-design.md)。

候选审查链接准确接受view／受保护client.js，新增独立单入口IIFE而非多入口IIFE。当前成员／nonce CSP／no-store与共享身份边界保持关闭默认。页面只读固定数据方案／原来源，独立替换确认、准备、关闭、撤销与最终接受；后端ready和当前owner能力是必要条件，刷新或切换准备清空勾选。

原历史20项游标；ABORTING显示清理待核实，当前观察不替代原dispatch记录。最终接受使用选中原准备的candidate／review／dataPlan／source及request／revision／观察hash。固定成功回执不代表当前发布状态，原Release页面与导出分别访问。每Run／标签页POST前保存原请求，丢HTTP应答或页面重载仅显式恢复原键／正文／If-Match；未知关闭新动作，损坏存储须核对清除，明确拒绝须成功刷新后才能放弃。当前撤权清空依据、原准备／历史及回执，串行超时请求并离页取消。没有HTTP自动advance或虚构健康；可信消费、物理环境、完整工作台和正式后继业务流程继续。

Acceptance history is projected through one bounded synchronous Worker transaction. Candidate qualification reuse is local to that page and keyed by the original actor, exact candidate/review/data basis, Run epoch and source binding; readiness and resolution remain per original. The API rechecks membership before sending and disables commit when the trusted committer is absent. No cross-request cache, backend health refresh, new dispatch, public proof or relaxed browser timeout is introduced.

### Recorded preview dataset consumer

原预览数据准备的宿主消费、专用工作页、最终授权与文件Worker排空见 [dataset-consumer-design.md](./dataset-consumer-design.md)。

### Preview management entry

准确候选预览管理API及其可信策略、原意图与公开投影见 [preview-management-design.md](./preview-management-design.md)。

### Preview management React page

准确候选的受保护React管理页、原请求恢复、独立历史与数据语义见 [preview-management-page-design.md](./preview-management-page-design.md)。

### 后继数据方案与替换确认顺序

交付REPLACE只收集方案，批准绑定冻结候选与审查，继续使用已有接受前独立确认。循环前置修正、同库两轮T5测试范围及物理夹具边界见[successor-data-strategy-design.md](./successor-data-strategy-design.md)。

### 替换确认的追加历史

审查变化后的再次确认、首次锚点与追加历史、前向迁移及原键恢复见 [replacement-reconfirmation-design.md](./replacement-reconfirmation-design.md)。

### 同库两轮接受后的原发布组合

后继正式T5之后的原服务退役、实际新dataset读写、路由换代、丢ACK重开与控制提交失败范围见 [successor-publication-design.md](./successor-publication-design.md)。
