## 1. Exact candidate review

- [x] 1.1 新增逐项审查协议、前向迁移及 Worker 只读投影，验证必要需求／人工检查集合、稳定 ID、历史候选与无正式冻结的兼容边界。
- [x] 1.2 实现人工结论追加、标准 meta／If-Match／当前记录 CAS 和证据引用，验证权限、丢回执、冲突修改、陈旧候选、错误预期／材料及不改变原自动事实／接受指针。
- [x] 1.3 实现退回及分类纠正记录，验证原范围与新增范围不混用、历史保留及未确认范围不自动执行。

## 2. Dataset and preview persistence

- [x] 2.1 增加 dataset／预览意图与原操作状态迁移，验证跨项目约束、幂等、目录边界、UNKNOWN 原对象恢复及独立保留。
- [x] 2.2 实现可信 dataset 准备接口和首次空／演示、隔离快照适配，验证实际 SQLite 一致副本、源数据不回写、失败和 ACK 丢失不重建；真实生产迁移未配置时关闭。
- [ ] 2.3 实现准确镜像／dataset 预览启动、健康／停止／到期核实，验证原实例绑定、未知不替代、停止未接受预览不影响旧 release／dataset；真实容器另留缺项。

2.3 当前开发范围：持续健康持久观察、原启动／停止／到期的私有控制面恢复器及受限 loopback HTTP 检查已完成本地验证；Runner v3 持久预览预留与原作业统一累计 slot／CPU／内存，UNKNOWN 保留容量，只有未派发取消、准确原实例 EXITED 或独立 REMOVED 证明才释放。Runner v4 新增不可变原 profile／NETWORK_CREATE／CREATE／START／STOP 日志、唯一派发许可、原对象核验和显式 RunnerPreviewBackend 组合；Docker Driver 代码固定 OCI／config／层、独占网络、只读准备元数据挂载及沙箱／资源策略，缺真实 Linux／硬配额／宿主网络隔离适配器保持关闭。Runner v5 增加持久归属和独立到期 watchdog，私有 ReleaseHold／Commit 与 STOP 在同一 writer 互斥；HELD／OWNED 不因 TTL 失去保护，旧未登记预览只查询，观察到的时钟回拨锁存到期。新用例实际执行本地定时器、Worker 重启、归属与 STOP 并发、事务回滚及历史升级，网络／容器事实仍明确受控。2026-11-12 定时器回归修正测试等待：原 EXITED 预留不可变，后续移除事实独立保存；等待两项原 OBSERVED 消失证明后再关闭 watchdog，不改产品代码或原90秒用例超时。两次错误等待 REMOVED 的失败及最终单例回归分别保留。原控制面组合和实际 dataset 保留已有本地验证，模板显式容器监听另有 HTTP／SQLite／浏览器验证。Runner v6 新增独立 REMOVED／PREVIEW_REMOVED、原容器／网络唯一清理日志、准确 ID 消失观察与容量历史同事务、包含已释放预留的清理恢复扫描，前向迁移不改旧迁移正文；HELD／OWNED、未知创建无原 ID 和 dataset 继续保护。真实 Docker CLI／gVisor 启动／退出／移除联调、实际 quota／network-isolation 适配器、可信平台装配及 T5 必需归属握手仍待完成；完整子项不提前勾选，受控容器事实不是实际镜像健康或物理退出证据。

## 3. Separate preview access

- [x] 3.1 实现独立 origin、固定目标、短期用途凭据与成员复核，使用真实本地 HTTP 验证 Cookie／用途／项目隔离、目标限制、读写门和到期。
- [x] 3.2 接平台预览查询／访问入口、隔离 iframe 策略及下载只读边界，验证未配置关闭、状态明确、访问或下载不接受。

3.1 本地实现与验证：迁移 34 的私有策略、原 dataset 写门与唯一派发保留；迁移 35 增加摘要存储、事务单次消费的 ticket／短期 session、当前成员与原目标复核。独立可注册域／私有 PSL、每预览 HTTPS host、host-only HttpOnly Cookie／准确 CORS／业务 Origin 与实际请求头正文绑定已实现；可信 Runner 本地传输核验原 journal／reservation／lifecycle／实例及实际 HTTP 健康，最后授权后仅发送一次，明确 NOT_SENT／UNKNOWN／完整 FINISHED 边界。真实 HTTPS／控制和 Runner SQLite Worker／模板业务 SQLite 组合 40/40，存储全量 33/33，实际 Edge Cookie／iframe 隔离 1/1；模板另验证原写 key 与认证失效恢复保护。失败执行、源码指纹及范围见 `project/evidence/P1-07/preview-http-development-review.md`。本项勾选只对应已写明的本地实现／真实 HTTP 验证；上游候选／镜像／容器事实为显式夹具，可信平台身份查询／签发入口、页面与下载边界继续 3.2，真实容器／物理排空／T5 与产品验收不据此通过。

3.2 本地实现与验证：可信 IdentityResolver 与显式 previewGateway 组合增加准确成员查询、nonce CSP 页面、空 JSON／准确 Origin 签发和实际跨站 Cookie 留存探测；缺身份、网关或原写门明确关闭。隔离 iframe 加载实际 Vite／React 模板并通过原 Runner HTTP 转发写入业务 SQLite，平台身份不转发到预览。冻结 delivery materialKey 下载使用原内容引用、实际 hash／大小及发送前成员复核，固定 inert attachment，越权统一 404，Range 明确 416；查询／打开／下载均不接受。最终入口及契约 23/23、实际 Edge 1/1，失败运行、构建／源码绑定与身份／容器边界见 `project/evidence/P1-07/preview-entry-development-review.md`。变更 7/13；企业 Cookie 登录／共享身份、实际容器、物理排空／T5 和正式 P1-07／门槛继续等待，不归档。

## 4. Two-phase acceptance and publication

- [ ] 4.1 持久固定接受依据与外部准备原操作，验证原接受指针、reviewHash、数据策略／明确替换决定、fencing／健康凭证和陈旧依据拒绝。
- [x] 4.2 实现 T5 原子 Release／接受指针／必要人工完成／Run 终态／Outbox／事件，验证每个写入故障回滚、并发 CAS、原键恢复、缺项／未知写阻塞与不可变接受历史。
- [ ] 4.3 实现发布 Outbox 和独立导出任务恢复，验证路由／打包失败保留接受事实、ACK 丢失不双建、不重复迁移、旧写门未核实不重开。

4.3 当前范围：独立 RELEASE 访问协议／迁移43、票据会话、共享未确定写屏障、原 Runner 本地传输及显式 HTTPS／平台入口；另实施原发布逐阶段 continuation 和 Runner v12 配额日志。实现与验证记录见末尾，独立导出及物理 Provider 继续推进，4.3保持未勾选。

4.1 当前首批范围为迁移 36 的私有后端策略、固定候选／审查／原接受指针与数据方案、独立替换确认、预留原 release／目标 dataset ID、唯一派发、UNKNOWN 原操作恢复和仅未派发关闭。实际 Worker 并发／重开／丢 ACK／事务故障、INITIAL 及权限边界通过：最终接受／契约／迁移／质量收集 32/32，存储全量 34/34；失败原输出、夹具签发时点／测试参数修正和各组源码差异见 `project/evidence/P1-07/acceptance-intent-development-review.md`。迭代保留和正向替换确认仍待后续验证。没有准备 READY、外部数据执行、fencing／健康凭证或 T5 命令；这些继续同一子项，4.1 不勾选，变更仍 7/13。

4.1 本轮补充迁移 37 的不可变原准备证明、独立当前观察及显式 AcceptancePreparer：准确 data／schema／迁移／源目标 fence／Runner claim，0～30 秒健康与当前持有，跨 UNKNOWN 的归属高水位、准备版本／观察双 CAS，同毫秒后续原准备 UNKNOWN 关闭旧 READY；仅唯一许可 prepare，丢 ACK／重开只 inspect。首次综合 37/38，端点负例因测试对象别名失败，独立诊断后仅复制测试健康端点，受影响五项重跑 5/5；存储全量 35/35、Runner 归属／清理 33/33。四组各自源码指纹不变，唯一组间差异为该测试夹具，其使用范围已核实；最终构建、类型、Lint／契约及 134/134 源码映射通过。原失败、构建差异和留存范围见 `project/evidence/P1-07/acceptance-readiness-development-review.md`。回执中的物理 fence／健康是显式受控声明，没有默认实际准备后端、数据文件／Release 创建或 T5。实际接受数据／写门的共用归属、准确 Runner 服务装配、正向保留／替换与安全失败恢复继续实施，不能伪造预览策略／effect；4.1 仍不勾选，变更仍 7/13，不归档。

4.1 本轮补充迁移 38 的通用数据策略／不可变准备归属、用途隔离、接受目标 PREPARING／初始 CLOSED 门和原 proof 同事务冻结、原后端准确源关门及 ACK 恢复。存储全量 38/38、旧证明升级 1/1 通过；综合 80/81 的一项上游交付夹具失败原样保留，原因未确认，同输入 readiness 整文件重跑 5/5 通过。最终构建／类型／Lint／契约及 134/134 源码映射通过。失败、诊断、各组指纹和历史夹具范围见 `project/evidence/P1-07/dataset-ownership-development-review.md`。这没有实际接受文件／物理 fencing／服务装配或 T5；4.1 不勾选，变更仍 7/13，正式工作包与门槛不变。

提交前补充：修正新SQL的一处尾随空格并更新迁移38校验和，最终构建／类型／Lint／契约及迁移专项6/6通过；早前综合与存储日志保留原校验和，TS／既有测试／可执行JS不变，补充绑定和已暂存检查见同一开发复核记录。

4.1 本轮增加 ACCEPTANCE v2 原 journal／物理 custody 记录和实际 SQLite 数据文件组件，INITIAL／REPLACE 的 EMPTY／DEMO、受限可信同 schema 保留快照、WAL 已提交状态／独立 UUID、文件摘要和原对象恢复；缺适配器、授权变化、fence 换代、超时与半成品不重派。模板只读原生连接修正后保持准备文件字节。最终数据／预览副本／原归属 24/24、模板单元／HTTP 24/24，构建／类型／Lint 和 137/137 映射通过。首轮失败批次主动中止、测试文件重名及恢复、各组捕获范围与原日志见 `project/evidence/P1-07/acceptance-data-development-review.md`。物理 custody 和接受依据／镜像仍为明确受控夹具，没有真实物理排空、准确接受服务／完整 READY、Release、T5 或发布；4.1 与 7/13、正式状态／门槛不变。

4.1 本轮增加独立 ACCEPTANCE 服务原请求、Runner v7 容量预留／只读 profile／原 network-create-start 日志及 RELEASE_HELD claim，不构造 PreviewEffect。作业／预览／接受服务同 writer 核算全局容量与跨用途 dataset 独占；UNKNOWN 保留占用，原动作丢 ACK 不重派，准确观察 CAS／实例／端口与历史原子回滚。新服务 claim 在控制面核实 reservation／profile／原接受及审查；旧预览入口明确旧 schema。验证 service-1 12/12、regression-1 15/15、migrations-1 2/2，构建／类型／Lint、140 份源码映射及 5 份历史迁移正文匹配；初轮类型失败、追加 JS 用例的构建输入差异和迁移专项范围见 `project/evidence/P1-07/acceptance-service-development-review.md`。实际 Driver／物理容器与 fence、完整服务组合／READY、安全撤销、T5 和发布未完成，不勾选完整 4.1 或关闭工作包／门槛。

4.2 本轮实现独立 T5／可信材料核验：迁移39保存不可变 Release／提交结论／必要人工覆盖层与专用 promotion 意图，准确 owner／原正文与准备双版本、指针 CAS、Run 终态／事件同事务。storage-01 40/40、t5-03 23/23 通过，覆盖13个写入故障完整回滚与原键重试、人工／自动完成、并发／重启／未知阻塞和真实材料预检；构建／类型／Lint及143份源码映射通过。首轮类型失败、夹具ID修正遗漏导致的失败与主动中止、唯一测试输入差异及38份历史迁移正文绑定见 `project/evidence/P1-07/acceptance-commit-development-review.md`。这里只完成4.2领域代码与明确受控基础设施验证；实际服务Driver／物理fence／完整准备、安全撤销、发布／导出与产品组合继续，4.1／4.3／5.1／5.2、正式P1-07和门槛不据此完成；变更8/13，不归档。

## 5. Composition and evidence

- [ ] 5.1 将准确候选、审查、实际本地数据副本和 HTTP 预览／发布组合验证，逐项记录 D01～D08 与 T5 的实际覆盖，受控后端不代替真实构建／健康或产品验收。
- [ ] 5.2 在固定提交干净 checkout 执行适用回归，保存原日志／SHA／源码指纹、部署与恢复说明，同步 OpenSpec 和父工作包台账，单列企业身份／真实 Linux／容器／迁移验收条件。

4.1 本轮服务组合：4.1 接受服务组合：显式 RunnerAcceptancePreparationBackend／ACCEPTANCE Docker Driver、整库只读与原对象恢复，Runner v8 保存稳定完整 proof；实际 SQLite／模板 HTTP→HELD／控制面 READY→T5 本地链路通过。service-02 16/16、regression-01 15/15、migrations-01 选中4项通过（其余测试未选择，TAP skipped=0），构建／类型／Lint和148份源码映射通过。首轮28项25通过3失败源于两处测试错误，另有未使用导入导致Lint失败，三处修正及原日志／源码指纹全部保留；最后三组输入与最终构建一致、运行期间无变化。物理容器／镜像来源／fence 为明确夹具；真实 Linux／quota／networkIsolation／物理 custody、安全撤销、OWNED／发布及正向保留／替换与完整产品验收继续。4.1不勾选，变更8/13及正式P1-07／门槛不变。 证据见 `project/evidence/P1-07/acceptance-composition-development-review.md`。

4.1 撤销决定屏障：迁移40保存owner的不可变原决定并与T5互斥；ABORTING关闭准备授权／READY／新观察／源闭门，保留原派发state、proof／数据／目标CLOSED及未核实占用。abort-01 17/17；storage-02 59/59；regression-01 48/48，构建／类型／Lint、150份映射及旧迁移保留通过；嵌套事务与历史夹具两次失败／修正及构建后OpenAPI／独立测试变化均如实留证。尚无物理stop／rm、fence解除、源恢复、容量释放或ABORTED；完整4.1仍未完成，8/13与正式状态不变。证据见 `project/evidence/P1-07/acceptance-abort-development-review.md`。

4.1 Runner撤销清理：v9原决定／无预留tombstone和原STOP／容器与网络移除日志，绑定原请求／profile／完整ID，丢ACK只查询；准确容器消失与REMOVED／服务容量／历史同事务，数据和原proof保留。最终20/20、45/45、19/19及实际3项历史迁移通过（TAP额外1个空文件包装单列），构建／类型／Lint、154份映射和旧迁移正文保留通过。首轮inspect版本展示的3项失败及修正字节留证；全部最终测试输入匹配build-02。物理事实为明确夹具，尚无dataset fence解除／源恢复／项目占用释放或ABORTED，默认平台未装配；完整4.1仍不勾选，变更8/13及正式状态／门槛不变。证据见 `project/evidence/P1-07/acceptance-runner-abort-development-review.md`。

4.1 数据撤销：独立原日志／receipt绑定控制决定和Runner原清理，唯一abort／恢复只inspect；无本地fences也查原物理记录，严格后继generation与源release、目标CLOSED／源CONTROL_CLOSED，保留原数据与准备证据。并发／超时及未返回物理调用名额均有界。abort-02 24/24；service-02 34/34；datasets-02 27/27，构建／类型／Lint、157份映射和历史迁移不变通过；首轮符号链接错误码断言的子项／父项失败与修正链、build-03之后独立MJS测试顺序变化均留证。实际物理Authority／默认装配、源门／未知写／源服务核实、项目占用解除和ABORTED仍待实现，完整4.1不勾选，8/13及正式状态／门槛不变。证据见 `project/evidence/P1-07/acceptance-data-abort-development-review.md`。

4.1 控制撤销完成增量：迁移41、共享恢复协议、原后端原子完成及显式Runner组合器；准确原清理／数据撤权、原fences、旧Release／镜像／源门、原写结局与新鲜可写归属核实后才ABORTED、重开适用源门及解除本准备占用，原派发／proof／数据保留。183项测试、构建／类型／Lint及160份映射通过；两轮失败及修正和构建后独立MJS测试新增如实留证。真实物理源恢复／可写发布适配器、保留迁移／替换正式正向流程及物理产品验收继续实施，完整4.1不勾选，8/13及正式状态／门槛不变。见 `project/evidence/P1-07/acceptance-abort-completion-development-review.md`。

4.3 发布控制增量：迁移42、原后端writer与显式ReleasePublisher，T5原子登记独立PENDING；一次派发固定源／目标门及前代路由，未知仅查原操作。稳定proof、新鲜原服务／路由／后继fence核实后，证明／观察、路由代际、数据状态、目标开门及历史／事件同事务，源门保持关闭。publication-05 69/69；transaction-05 74/74；acceptance-05 68/68，共211项及构建／类型／Lint、164份映射通过；失败／修正／未选中过滤完整留证。物理Runner可写发布／guard／Release访问与导出、平台装配、正式后继T5及完整组合继续，4.3／5.1／5.2不勾选，8/13及正式状态／门槛不变。见 `project/evidence/P1-07/release-publication-development-review.md`。

4.3 Runner退役增量：v10原交接／阶段日志、可信退役组件，原控制T5／basis／Runner稳定proof及准确只读服务绑定；先永久物理撤权后停止／移除，容量／消失观察／REMOVED／历史同事务。dataset交接不随容量释放，abort互斥，丢ACK只查询已派发步骤且不发后续未派发阶段。runner-03 105/106（1项条件跳过）；acceptance-03 224/224，共329通过、1条件跳过，构建／类型／Lint、168份映射与历史SQL不变。物理事实为显式夹具；独立可写服务、guard／fence／路由／入口／导出、继续协调协议和实际组合继续，完整4.3不勾选，8/13及正式状态／门槛不变。见 `project/evidence/P1-07/release-retirement-development-review.md`。

4.3 独立可写发布服务增量：Runner v11独立容量／profile／阶段日志与显式发布组件，严格后继fence／全写guard契约、旧只读与源退役、新RELEASE实例及稳定proof，丢ACK只查原阶段；源消失／REMOVED／容量／历史同事务。模板运行锁独立、启动保留准备DB字节。service-06 15/15；acceptance-06 84/84；runner-06 105/106（1项条件跳过）；模板26/26，共230通过、1条件跳过，构建／类型／Lint、173份映射和历史SQL不变；失败／夹具修正／超时及中止留证。物理事实为受控夹具，继续协调／Release入口与导出、默认组合、正式后继T5及物理验收继续，完整4.3不勾选，8/13及正式状态／门槛不变。见 `project/evidence/P1-07/release-service-development-review.md`。

4.3 Release访问增量：独立RELEASE请求／票据／会话、原Runner实际健康与准确实例／路由、显式TLS网关／平台入口，GET不签票、一次HTTP与未知写共用屏障、即时成员复核。access 7/7；http 7/7；browser 1/1；upgrade 1/1；regression 90/90；acceptance 157/157；contract-tests 18/18，共281通过；构建／类型／Lint／契约及182份映射、历史SQL保留通过。实际Edge加载React并写入原业务库；物理provider和身份为夹具，默认组合／导出／继续协调、后继T5和门换代恢复继续；完整4.3不勾选，8/13及正式状态／门槛不变。见 `project/evidence/P1-07/release-access-development-review.md`。

4.3 原发布继续增量：显式resume、当前原请求／接受指针／闭门／未定写核验，退役／可写逐阶段唯一许可和原结果查询；Runner v12配额动作及旧profile只查询。continuation 27/27；runner 120/121（跳过1）；acceptance 157/157；regression 90/90；access 7/7；http 7/7；browser 1/1；upgrade 1/1；contract-tests 18/18，共428通过、1跳过；构建／类型／Lint／契约及183份映射、历史SQL保留。失败与修正原样留证，见 `project/evidence/P1-07/release-continuation-development-review.md`。物理provider／默认组合／独立导出、正式后继T5和门换代源恢复继续；完整4.3不勾选，8/13及正式状态／门槛不变。

4.3 2026-11-13：4.3独立交付导出增量，迁移44冻结原版本/实际配置与提示词/用户输入/协作记录及材料引用，准确受控Git源码与确定性ZIP32、claim/原作业重试和当前成员下载；不调用开发/迁移/发布或改验收。export 8/8、regression 114/114在最终源码通过；acceptance 157/157、workspace 18/18复用本轮未变调用路径，共297通过。构建/类型/Lint/契约、139条映射、1～43迁移前缀保留；复用范围、原编译源码及各次失败真实留证见release-export-development-review.md。默认调度/UI、完整正式后继T5及换代源恢复和真实物理验收继续，8/13及正式状态/门槛不变。 证据：`project/evidence/P1-07/release-export-development-review.md`。

2026-11-13：4.3导出宿主消费，显式releaseExports配置／默认原Git读取器、当前成员私有分页、最多两并发、过期原代际CAS恢复和先取消排空后关闭存储。scheduler 9/9，回归39通过／Windows SIGTERM跳过1；构建／类型／Lint／契约及153源码映射通过。首轮夹具缺原计划正文导致启动被完整性拦截，诊断后仅CAS补齐原字节，失败／源码差异及复核范围见release-export-host-development-review.md。产品UI、完整后继T5／换代源恢复及真实物理验收继续，8/13及正式状态／门槛不变。 证据：`project/evidence/P1-07/release-export-host-development-review.md`。

2026-11-13：4.3 React交付入口，原Release链接、受保护本地脚本／nonce CSP、固定版本与20条游标、活跃GET核实、sessionStorage原键找回、原创建者canRetry与下载。接口2/2、实际Edge3/3、宿主9/9、回归69通过／Windows SIGTERM跳过1，共83通过；构建／类型／Lint／契约与199条源码映射（含浏览器第三方）通过。首轮契约导出遗漏、测试created_at及Playwright下载不携带注入认证头的失败已定位；浏览器使用显式可信身份夹具，生产鉴权未放宽。原请求找回只一任务、实际下载hash、失败重试／分页／撤权及桌面／390px布局已验证，输入差异与复核边界见release-export-entry-development-review.md。完整工作台／默认组合、后继T5／换代源恢复及真实物理验收继续，8/13及正式P1-07／门槛不变。 证据：`project/evidence/P1-07/release-export-entry-development-review.md`。

2026-11-13：5.1 人工审查HTTP／React入口：原候选准确SHA、逐项实际操作／观察和PASS／FAIL，退回原范围／新增范围、纠正及有理由撤回，历史20条游标；当前owner／成员及服务端撤回能力、If-Match／前条CAS、sessionStorage原正文／键／ETag找回、损坏待核实记录阻止新提交，撤权清空。最终接口3/3、Edge4/4、原交付页Edge3/3、领域／入口／契约回归39/39，共49通过、0跳过；构建／类型／Lint／契约和248条映射（含TSX／第三方）通过，迁移1～44及Runner不变。两次IIFE配置失败、404映射错误及浏览器提前等待断言已修正并保留；所有最终组输入相同且运行无修改。真实Worker／HTTP／React／Edge，上游源／Runner／报告与浏览器身份为明确夹具，不改质量／Work／接受事实。完整5.1／工作台／默认组合、后继T5及物理验收继续，OpenSpec8/13、正式P1-07及门槛不变。 证据：`project/evidence/P1-07/review-entry-development-review.md`。

2026-11-13：5.1 接受HTTP入口：准确依据／策略快照与20条原准备游标，原准备意图、独立替换确认、未派发关闭／已派发撤销，AcceptCandidate更新完整两阶段正文并接真实ReleaseAcceptor材料预检；成员／owner、原UUID／正文／If-Match、内部proof／路径投影隔离，宿主显式acceptancePolicies默认关闭新动作。最终接口5/5、准备／T5／撤销51/51、输入／审查／契约22/22、Edge4/4，共82通过、0跳过；构建／类型／Lint／契约及252条映射通过，迁移1～44／Runner不变。首轮类型品牌ID两处错误修正后所有最终组同源码重跑；类型失败及三份原字节快照留存。实际Worker／HTTP／材料字节预检和T5，提交后注入丢ACK可在关闭新配置后原键恢复一份Release／发布Outbox；上游源码／Runner／围栏／健康与人工观察仍为明确夹具。完整工作台／默认后端推进、正向后继保留／替换与物理验收继续，OpenSpec8/13及正式P1-07／门槛不变。 证据：`project/evidence/P1-07/acceptance-entry-development-review.md`。

2026-11-13：5.1 接受React页面：准确view／成员保护脚本接入审查链接；固定INITIAL／保留迁移／替换方案及来源、原准备20项游标，独立替换／准备／关闭／有理由撤销／最终接受确认，刷新清除旧勾选。每Run标签页先保存原正文／UUID／If-Match，丢HTTP应答后显式恢复，重开Worker只一份Release／Outbox；UNKNOWN／损坏存储关闭新提交，ABORTING只显示清理待核实，撤权清空保护内容，原回执和当前发布分开。最终入口6/6、输入／审查／契约22/22、接受领域54项、Edge8/8，共90通过、0跳过；构建／类型／Lint／契约及300条源码映射、旧迁移1～44／Runner不变。类型与首轮浏览器等待失败／修正及原字节快照留存，最终生产源码／产物与完整构建一致；之后仅v37迁移测试改为历史SQL夹具并独立3/3复测，原扩展组52通过2失败保留，仅选用其51个通过的原接受用例；其余原组复用有精确SHA与未导入该独立测试的范围评估，最终Lint／Edge重跑，无运行中漂移；早期输入评估及81秒性能剖析保留历史。实际React／Edge／HTTP／Worker／材料预检／T5；上游Runner／围栏／健康及人工观察为明确夹具，REPLACE／PRESERVE展示另为响应夹具，不代替正式后继业务链。完整工作台／可信后端消费、正向业务／物理验收继续，OpenSpec8/13及正式P1-07／门槛不变。 证据：`project/evidence/P1-07/acceptance-page-development-review.md`。

2026-11-13：4.1／5.1可信接受准备后台消费：AcceptancePreparationConsumer＋startPlatform显式工厂，匹配acceptancePolicies启动快照及DB原project／policy／主体／backendRef／Runner；默认不扫描。未决工作页排除失败／撤销／接受历史，有限范围／页预算、轮转、跨项目最多2并发与每项目串行、tick合并；原一次派发、SENT／UNKNOWN只查原对象，独立周期健康不改proof且GET不刷新。停机立即关闭新授权，preflight后复核，真实排空后端调用再关闭存储，不自动T5／发布／清理。新消费者13/13、宿主／导出19通过1项Windows跳过、接受／T5／撤销／契约45/45，共77通过1跳过；完整构建／类型／Lint／契约通过，301条源码映射及旧迁移1～44／Runner／依赖不变，最终全部输入无漂移。实际文件Worker／CAS／平台启停／31秒健康时效／原HTTP接受回归；物理后端和上游事实为明确夹具。无默认真实Runner／OIDC、物理迁移／清理、正向后继保留替换、完整工作台或产品验收；后端无强制取消、由适配器保证有界I/O。正式P1-07及OpenSpec8/13和门槛保持原状态。 证据：`project/evidence/P1-07/acceptance-consumer-development-review.md`。

2026-11-13：4.3／5.1已接受发布后台消费：ReleasePublicationConsumer＋startPlatform显式releasePublication工厂，固定原project／policy／主体／backendRef／Runner并核实DB策略，后续宿主组合成功才启动。无需Input API或新接受入口仍开启，默认无物理发布器。私有工作页只取当前已接受未决发布，保留完整历史；原一次publish、SENT／UNKNOWN先inspect并按原授权resume续接Runner阶段，不重建Release／T5或重做迁移。范围轮转、最多2并发、项目串行和tick合并；停机关闭publish／resume最终授权、真实排空后关闭Worker。consumer 16通过，lifecycle 32通过／1跳过，domain 112通过，共160通过1跳过；完整构建／类型／Lint／契约通过，302条源码映射及旧SQL1～44／Runner／依赖不变，所有最终输入无漂移。真实文件Worker／T5／发布事务／宿主启停；物理后端和上游事实为明确夹具，后继历史仅显式元数据投影。未执行完整pnpm check／固定提交干净checkout；真实身份／Linux／容器／物理迁移与正式后继业务链继续验收，正式P1-07／OpenSpec8/13／阶段门槛保持原状态。 证据：`project/evidence/P1-07/publication-consumer-development-review.md`。

2026-11-13：4.1／5.1原撤销后台协调：AcceptanceAbortConsumer＋startPlatform显式acceptanceAbort工厂，按DB原策略／项目／主体／backendRef／Runner核实，只消费已有决定无completion的原准备；不依赖新接受入口或原owner仍为成员。RunnerAcceptanceAbortCoordinator串联原服务清理与数据／源恢复finalizer；有界轮转／最多2项目并发／tick合并。停机关闭原阶段／driver／数据最终授权并排空调用；数据Worker超时退出后保留未结束authority RPC和名额，返回后只查原结果。consumer 10通过，lifecycle 48通过／1跳过，domain 94通过，共152通过1跳过；完整构建／类型／Lint／契约通过，367条源码映射、旧控制SQL1～44／Runner存储格式／依赖未改，所有最终输入无漂移。首轮类型2处／Lint1条失败及3份源码原字节保留，修正后重新完整构建；两条旧超时测试按新排空契约提前调整后再验证。真实控制／Runner／数据文件Worker和宿主启停；物理Driver／永久撤权／fence／健康仍为明确夹具。完整后继链／真实身份及Linux／容器／全量干净checkout验收继续；正式P1-07／OpenSpec8/13／阶段门槛保持原状态。 证据：`project/evidence/P1-07/abort-consumer-development-review.md`。

2026-11-13：4.1／5.1验收数据准备RPC排空：LocalSqliteAcceptanceDatasetBackend保留父进程未结束的preflight／authorize／migration／acquire／inspect／verify；Worker超时关闭迟到授权并终止线程，真实排空后才结束调用和释放名额。原不完整日志只查不重做，完整原回执字节保持；实际消费者停止／重开验证同一准备、无新服务或Release。drain 10通过，lifecycle 15通过，domain 75通过，共100通过、0跳过；完整构建／类型／Lint／契约通过，367条源码映射、控制SQL1～44／Runner持久格式／依赖未改，最终所有输入无漂移。首轮Lint多余spread告警及原测试字节保留，修正后完整重建再测试。真实文件／控制／Runner Worker；物理custody／容器／OCI为明确夹具。外部调用无法强制取消，未返回则继续占位；真实身份／Linux与完整后继链／干净checkout验收继续，正式P1-07／OpenSpec8/13／门槛保持原状态。 证据：`project/evidence/P1-07/acceptance-data-drain-development-review.md`。

2026-11-13：2.3／5.1原预览可信后台消费：PreviewLifecycleConsumer＋startPlatform显式previewLifecycle工厂，核实DB原项目／策略／主体／backendRef／Runner；全部后续启动成功后才扫描，默认无后端。复用原生命周期页，原一次许可、SENT／UNKNOWN只查、周期健康／确定键到期与Release归属保护；有限轮转／页预算、最多2项目并发、每项目串行和tick合并。预检后／派发前复核停止，最终授权立即关闭，实际排空后关闭存储。consumer 13通过，lifecycle 16通过／1跳过，domain 81通过，共110通过、1跳过；完整构建／类型／Lint／契约、368条源码映射及旧SQL1～44／Runner／依赖未改通过，最终所有输入无漂移。前两轮各有1项测试断言失败：首轮改写夹具execute内部仍调用的this.preflight，修正为独立公开facade；第二轮按并发返回的Map插入顺序比较计数，修正为按原项目ID核对。两轮日志、原源码SHA／字节及原因保留于initial-failure和second-failure；产品代码未因这些失败改动。修正后重新完整构建并在相同最终输入重跑全部分组。真实控制／Runner／业务文件Worker和宿主、30秒健康及真实TTL定时；物理容器／网络／OCI及上游事实为明确夹具，归属测试投影不冒充T5。无自动dataset／owner决定／接受，真实Linux／完整后继链／工作台与干净checkout验收继续；正式P1-07／OpenSpec8/13／阶段门槛不变。 证据：`project/evidence/P1-07/preview-consumer-development-review.md`。
