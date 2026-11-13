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
