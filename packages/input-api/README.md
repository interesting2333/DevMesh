# 项目输入 API

`@devmesh/input-api` 是 `/api/v1` 的持久输入边界，独立于模型和 Runner。默认关闭，平台配置显式启用后还必须由宿主注入可信 `IdentityResolver`；没有 resolver 时受保护请求返回 503。当前 CLI 不接入企业 OIDC/OAuth，不签发默认用户、匿名会话或测试 bearer。测试中的身份解析器只存在于测试文件。

平台配置中的 `inputApi` 接收 `enabled`、可信绝对 `repositoryRoot`、固定 40 位 `commit` 和可选 `templatePath`。启动时用 Git 核实确切提交并读取该提交的模板清单，随后冻结版本与基线；请求不能传入主体、代码 SHA、存储目录或执行状态。该步骤仅核实模板来源，项目仓库准备随后续 bootstrap 实施。

公开接口包括逐文件 `POST /attachments`、附件元数据／内容读取与逻辑移除、项目创建／列表、已有项目新任务、Run 消息、workspace、项目 Run 事件，以及 operation 按 ID／原键核实。写入使用 UUID `Idempotency-Key`；条件写入使用强 ETag `If-Match: "r17"`。API 检查 socket loopback、精确 Host、同 Origin、歧义头和 JSON 大小，不信任客户端自报身份。Cookie 认证当前明确拒绝，企业浏览器登录与 CSRF 待对应接入。

正文按 Unicode code point 限制 20,000，保存原始空白；首次允许纯附件输入，空正文与空白正文不会被改写成系统摘要。每次输入最多三个独立附件。上传为一个 `file` part 加一个 `clientAttachmentId` 字段，支持非空 UTF-8 `.md/.markdown/.txt`，每文件最多 2 MiB；名称仅为展示元数据。Busboy 固定 1.6.0，类型固定 1.5.5；其源码实际为每 part 16 KiB header／2,000 header pairs 的硬上限，不能用更小的 headerPairs 参数冒充已生效。另有总字节、part、field、30 秒期限及并发上限。

上传先提交原键与 claim、再写随机 staging；完整字段／字节通过后冻结请求 hash，复用内容库发布，最后把 READY 附件与原操作结果提交。并发不会接管原 claim，失败或中断必须查询原键，不自动创建新请求。重启在内容恢复之后核实 intake，只有完全匹配的已发布附件可被恢复为 READY。残缺接收保留 INTERRUPTED。staging、附件或失败记录均不触发自动 GC。

创建 T1 在一个 SQLite Worker 事务中完成 owner 成员、Task、唯一活动 Run、原文 artifact/message、附件绑定、独立 WAITING 理解 operation、Outbox 和事件。文件／Git／网络均不进入事务。创建成功表示输入已保存；没有模型也不会伪造理解结果。当前成员权限先于原键返回，原键先于新操作 CAS；暂停时补充消息保持暂停，消息意图不会直接修改实施计划。

workspace 在单个读事务中冻结元数据、材料引用与 eventCursor，随后读取不可变正文，再复核当前成员权限；事件可从该 cursor 补取，默认 50、最多 200 条。历史 Run 只读，项目列表按更新时间和 ID 分页。现有项目新任务必须从当前人工接受 release 的固定代码提交开始，且项目没有其他活动 Run。

显式 `previewGateway` 组合增加以下预览入口，`startPlatform(config, {identityResolver, previewGateway})` 透传同一可信对象；其 HTTPS listener、DNS／证书及原 Runner transport 由宿主拥有，平台停止不据此宣称外部预览已停止。网关平台 origin 必须准确匹配实际 socket 协议／固定 loopback Host／端口；本模块不信任转发协议头，也不默认开启网关或身份。

- `GET /runs/:runId/previews/:previewId` 返回当前成员可见的状态与受限访问投影，排除实例、Runner 端点和宿主路径；未配置、恢复中、到期等分别显示。
- `GET .../view` 是只读预览页，使用 nonce CSP 与受限 iframe；点击才通过 `POST .../access` 的空 JSON、准确平台 Origin 和已解析身份签票据。页面兑换 Cookie 后查询原会话，确认跨站凭据实际保留才加载 iframe；不把 ticket 放进 URL 或持久浏览器存储。实际 Cookie 登录仍未配置，当前页面不创造匿名身份；测试按平台 origin 单独注入明确的本地身份夹具。
- `GET /runs/:runId/candidates/:candidateId/materials/:materialKey/download` 只解析原冻结 delivery 材料，经内容库授权、实际 hash／大小与发送前当前成员复核后流式下载。统一 attachment／octet-stream／nosniff／sandbox，禁止任意 hash／宿主路径；Range 当前返回 416，打包与续权由独立导出工作包继续。

查询／打开预览／下载没有接受命令、替代执行或重建材料的路径。共享 HTTPS／企业身份、实际容器和 T5 验收与这些本地入口验证分开记录。公共 DTO 及 OpenAPI 与入口一同维护。

企业身份、真实模型、完整工作台、WebSocket 和真实 Runner 均不由本模块的离线测试宣称验收。运行 `pnpm test:input` 查看实际 HTTP、真实 Worker、迁移和进程 SIGKILL 恢复检查；原始结果随父工作包保存。

## 已接受版本交付页

GET /releases/:releaseId/exports/view 提供独立 React 18 入口，GET 同级 client.js 提供已打包的本地资产；两者均要求当前成员，不依赖预览／Release网关。原 Release /view 包含链接。创建／重试／下载调用原导出 API，详情与消费者启用见 [EXPORTS.md](../result-verifier/EXPORTS.md)。页面加载只读取；创建先保存标签会话原键，响应未知后显式核实。活动任务有界轮询，后台暂停；撤权清除作业，暂时失联关闭下载和写动作。

嵌入入口由本包 tsdown.web.config.ts 构建到 dist/web/export/export-client.js，包含固定 React／ReactDOM／scheduler／Zod 和完整许可证；tsdown 的 node clean 必须先执行，两个单入口浏览器构建各只 clean 自己的 dist/web/export 或 dist/web/review。完整工作台仍是 P1-04 React／Vite 范围。默认身份关闭，浏览器专项的可信 IdentityResolver 仅是测试夹具。

## 候选人工审查

预览页的“逐项审查此候选”进入 /runs/:runId/candidates/:candidateId/review/view；页面／本地client.js和JSON读取均要求当前成员，默认身份仍关闭。GET /review 返回准确SHA／审查及Run ETag；POST /review/results、/review/rejections 需要原Idempotency-Key和新操作If-Match，原记录CAS由Worker复核；返回201表示该人工记录已保存，仍不代表版本接受。输入不能提供principalId、Run或后端健康／策略。

GET /review/history?itemId=… 与 /review/rejections/history?rejectionId=… 支持afterSequence、limit（默认20，最多100）。owner可写当前候选；历史候选只允许在原Run仍可交互时明确撤回既有退回，服务端canWithdrawRejections单独控制。viewer只读。不存在／不可见对象统一404，原依据／记录冲突返回409，Run版本冲突412、缺新操作版本428；原成功键优先于新版本核对，仍授权。

React表单要求明确结论和实际操作／观察，原预期只读，证据按artifact ID＋SHA-256逐行填写。退回区分原范围与新增范围，追加纠正／撤回，不自动修复或应用变更。当前标签在会话存储保留单个原提交用于未知结果恢复；只有点击才核实，损坏原记录先核对再显式清除，失联关闭新提交，撤权清空投影。页面不配置企业登录、接受后端、T5或发布调度。

## 接受准备和准确T5入口

GET /runs/:runId/candidates/:candidateId/acceptance 读取准确依据和Run ETag；同级preparations支持GET游标列表（默认20／最多100）及POST原准备意图；/replacement-confirmations独立确认REPLACE。GET preparations/:operationId查询原状态，POST其close-unsent只关闭未派发意图，POST其abort保存有理由撤销决定。GET不推进准备或刷新健康；撤销回执RECORDED不意味着物理清理完成。

POST /candidates/:candidateId:accept现在使用AcceptCandidate完整两阶段契约，须显式ACCEPT_RELEASE和准确准备requestHash／revision、最新观察sequence／proofHash及candidate／review／dataPlan／原接受指针。仅可信组合的ReleaseAcceptor实际核对材料字节后执行T5；不能传证明正文、Runner地址／路径或新后端身份。成功202的SUCCEEDED结果固定原ACCEPTED和当时PENDING，发布状态另查；links.preparation可GET当前原准备。通用InputOperation不包含这些准备／撤销操作；未知提交用原键正文重放核实。

mountInputApi的acceptance选项仅供可信宿主：policies为已登记projectId→policyHash快照，commit必须组合ReleaseAcceptor；startPlatform通过显式acceptancePolicies安装该组合。配置缺省关闭新准备／接受；DB须有准确原策略且满足模板与数据方案。不要将接受后端主体作为用户身份，也不要用storage.commitReleaseAcceptance直接代替材料预检。已成功原请求可在配置关闭后恢复，新的请求仍关闭，授权继续复核。字段／范围校验、原操作去重和If-Match由领域再次执行。

准备／数据后端的注册、定时恢复／advance由可信宿主另行装配，此HTTP入口不自动调用它们。公共状态去除storageKey、原proof、端点和后端主体；完整状态仍保留在私有控制面供可信适配器恢复。当前CLI没有企业IdentityResolver或默认接受策略／Runner后端，不能把本地协议夹具当成可部署的完整产品登录与执行环境。

## 接受页面与浏览器恢复

审查页面链接到 /runs/:runId/candidates/:candidateId/acceptance/view，受保护的同级client.js由第三个独立单入口IIFE构建。共享当前成员鉴权、no-store及nonce CSP，默认无身份继续503；脚本前后复核成员，JSON引导转义。没有公共后端登记或健康回执入口。

页面显示固定数据方案／来源和准确版本，REPLACE单独确认；准备、未派发关闭、已派发有理由撤销与最终接受分别由用户明确确认。GET只读。历史每页20项；ABORTING保持清理待核实，不声称物理完成。刷新或切换原准备会清空勾选；最终接受使用选中原准备的完整依据和观察，writer再做准确CAS。

会话存储键devmesh.acceptance.pending:<runId>按标签页保存原命令，POST之前持久保存UUID、正文、If-Match和原candidate／operation。丢回执／刷新仅显式恢复同一请求，不自动POST或改键。未知状态、新记录损坏或存储不可用关闭新动作；已知409／412／422／428的原提交仍须成功刷新核对后显式放弃。撤权发现后移除页面中的依据／历史／回执，原请求记录不自动换身份重试。接口默认关闭与真实身份／后端装配要求见上节。

原准备列表使用getCandidateAcceptancePreparationPage私有Worker读取，在同步事务内形成去除私有proof的整页投影，资格缓存仅限本次页内相同主体／固定依据／epoch／来源。API仍在响应前核实当前成员，commit配置缺失时清除canCommit；写入权限／CAS独立检查，浏览器15秒超时不放宽。

Trusted acceptance preparation consumption is opt in through the platform host's `acceptancePreparation` factory. Its fixed project/policy/principal/backendRef/Runner bindings must match registered policies and the host's startup `acceptancePolicies` snapshot. The private bounded unresolved-work queue and periodic backend inspection drive original preparations, never page GET, T5, publication or cleanup. Shutdown revokes new dispatch authorization and drains active backend work before closing storage. No physical Runner adapter or identity is enabled by default.

准确候选预览管理位于 `/api/v1/runs/:runId/candidates/:candidateId/preview-management`。显式 `previewPolicies` 按项目选择已注册策略用于新dataset／start，默认关闭；不代表后端或访问健康。GET为当前成员单次writer投影，datasets／previews各1～20项稳定游标；排除本地路径、后端／Runner／实例／端点与proof。POST datasets和previews沿用原UUID／Run If-Match；GET不派发。stop须独立STOP_PREVIEW确认、previewRevision／impactReviewHash，原preview scope、USER原因并保护Release归属。关闭新策略后仍可原键恢复旧意图。真实后台消费／访问另配置。

## 预览管理页面

逐项审查链接到同级 `preview-management/view`；受保护 `client.js` 为第四个独立 React IIFE。页面分别确认数据准备、启动和停止，展示固定数据来源、原数据／服务详情及各10项独立历史；GET不派发、签票据或接受。REPLACE接受方案在预览时仍使用来源隔离快照，数据替换确认留在接受入口。启动有效期在页面选择2～1440分钟，服务端首次60秒～24小时边界保持。

会话存储键 `devmesh.preview.pending:<runId>` 在POST前保留严格原UUID／候选／完整正文及创建Run If-Match或停止原preview版本／impact hash。重进不重发，仅显式核实原提交；损坏／不可用存储、未知结果或未刷新关闭新动作，条件拒绝须刷新成功后明确放弃。刷新／切换／错误清空确认，发现成员撤销后移除受保护内容。原预览访问使用既有受保护view，不在管理页创建访问票据。


项目显示名称支持 `PUT /projects/:projectId/name`，正文为 `{name, previousName}`，使用 UUID Idempotency-Key。owner/operator可写，事务比较旧名称且重放重新授权，返回InputOperation；名称冲突409／PROJECT_NAME_CHANGED。仅修改名称和更新时间，不更改任务／Run依据版本。工作台创建前使用默认名称，创建后在项目标题旁重命名。

## 持续对话工作台

配置ConversationAccess后新首页进入持续对话，legacy=1及projectId/runId保持旧工作台。会话创建／列表、按seq读取、messages、control及原键lookup位于conversations.ts；模型／准备／执行能力分别反馈。inputApi.conversationAdmission=false关闭新输入，准确会话读取、原请求核实和控制仍保留。

新本机库devmesh.conversations保存草稿CAS、原文件／上传身份、消息与控制原命令，不删除旧库。消息只读轮询恢复，正文采用安全React文本格式；候选和版本入口来自准确Run的delivery事实。模型API根或完整chat/completions均兼容，读取旧配置不改写原密钥。

## 2026-11-18 桌面对话工作台优化增量

新增会话POST rename（name／previousName CAS）和plan-confirmations（inputRevision及所见basis，另含可选carryForwardHash），使用会话scope、UUID Idempotency-Key，返回202 InputOperation。GET work-context返回准确Run的薄上下文，前后重读核对会话输入／Run／项目版本和当前权限；无绑定返回null，版本不稳409 BASIS_SUPERSEDED。

新确认受conversationAdmission约束；改名及原请求核实仍可用。确认／改名与旧control共用原生controls日记但按kind分离，刷新不POST，显式恢复先查原键。确认复用严格确认检查并与会话消息／调度记录单事务。任务标题从已有goal提炼，人工名称优先，迁移56保存来源。

桌面conversation-shell独立限定样式，旧页面兼容保持。新回复定位、稳定键盘提示、紧凑输入、按需上下文及能力状态均依据实际事实；本轮不实施移动端专项。

### 模式选择器补充（2026-11-18）

模式入口由ConversationMode渲染，使用ARIA combobox／listbox、带解释的深色浮层，支持键盘与外部关闭。选择沿用edit({mode})事务草稿，下一次消息发送前不POST；不改变现有执行授权、默认模式或暂停边界。真实执行能力缺失时说明环境未连接。

### 执行详情页签恢复（2026-11-18）

ConversationDetails恢复五个执行信息页签，任务使用已有薄上下文，其余按需读取准确Run的workspace、协作、交付和事件；取消旧上下文的展示并忽略迟到请求结果。成果／预览复用WorkbenchDelivery及候选选择／分页，专用页面在新标签打开并保留草稿守卫。记录显示已保存对话和最近50条执行事件；所有切换仅GET。

## 任务删除补充（2026-11-18）

GET /conversations/:id/deletion-state提供当前删除资格；POST /conversations/:id/deletions以{revision}和UUID保存删除，202 InputOperation。owner及当前成员写权限、非活动／无未知主轮次、Run暂停或结束和效果收尾必须同时满足。删除是对话移除，关联项目／成果／记录保留；不依赖新输入准入开启。

删除后普通会话读写404，原操作lookup在当前权限下仍能查到旧回执；受保护原书签渲染恢复入口而不读出已删内容。controls的DELETE日记独立恢复，不自动POST，不与控制、改名及方案确认混淆。

## 工作空间管理补充（2026-11-18）

空间管理 API：GET／POST /workbench-spaces，GET /workbench-spaces/:spaceId，POST /:spaceId/updates、/:spaceId/deletions（body带revision），POST /conversations/:conversationId/space-moves（revision、targetSpaceId）。变更返回202 InputOperation；UUID Idempotency-Key 与原正文绑定，GET /workbench-space-operations/:key?scope=...核实原结果。对话列表支持 spaceId／query，创建可选spaceId，省略保留默认空间兼容。目录 GET /workbench-directories?path=... 及 /inspection?path=... 仅在宿主配置受信任根内读取；inputApi.workspaceRoots 可配置最多20个绝对目录，默认 inputApi.repositoryRoot。目录必须是已有提交的受控 Git 根；不自动 git init。目录编辑只作用新任务，空间迁移不改变任务原代码基础。独立空间命令日记不与既有控制／删除混合；原设置、附件、项目审计入口保留。
