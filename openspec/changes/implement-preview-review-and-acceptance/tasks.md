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
