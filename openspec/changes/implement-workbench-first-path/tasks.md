## 1. Durable input foundation

- [x] 1.1 实现按主体／准确上下文隔离的IndexedDB草稿、严格schema和本地revision CAS；实际浏览器验证刷新、多页陈旧写、事务失败、升级blocked及准确保存完成时点。
- [x] 1.2 实现先持久后发送的严格原命令日记与未决指针；实际IndexedDB验证多页原子竞争、原信封不改、失效／损坏记录关闭准入及回执观察保留。
- [x] 1.3 提供受保护工作台页面／脚本与真实新项目／消息入口；实际HTTP／React验证持久事务前零POST、原提交丢ACK重进不自动POST、lookup未找到不生成新键、明确原信封恢复。

## 2. Workspace navigation and first-path views

- [x] 2.1 实现三栏／五页签、准确上下文、旧请求取消与迟到隔离、导航前保存和只读依赖；实际双项目／历史／撤权及存储失败浏览器验证。
- [x] 2.2 接入真实理解／问题／计划与DAG／来源内部导航；以原API事实和条件冲突验证，缺资源不得生成假计划或默认确认。
- [ ] 2.3 接入附件、问题回答与新任务的严格原信封及草稿依据；实际API／浏览器验证原附件状态、旧版本拒绝和刷新恢复。
- [ ] 2.4 从准确候选／Run进入既有审查、预览管理、接受和导出；验证导航GET无副作用及返回保留阅读／选择上下文。

## 3. Event continuity and interaction

- [ ] 3.1 在宿主挂接同源重新鉴权WebSocket，先有界缓冲再历史补发并支持慢客户端resync；实际连接测试快照订阅缺口、撤权、背压与停止排空。
- [ ] 3.2 实现连续seq合并、缺口补取、断线重快照与独立临时增量；浏览器验证重复／乱序／重连不重复应用、不覆盖草稿／页签／焦点。
- [ ] 3.3 完成IME／重复键保护、Ctrl／Cmd+Enter、页签方向键和窄屏导航／详情；真实Edge键盘、390px布局和事件期间焦点／选择验证并保存截图。

## 4. Integration and review

- [ ] 4.1 在实际文件Worker／HTTP／浏览器贯通可独立于外部资源的空项目输入及已有交付页面链，执行适用回归／构建／类型／Lint／契约，保存真实日志与夹具边界。
- [ ] 4.2 同步设计专题、验收、实施文档、基线、OpenSpec和P1-08台账，完成同一Agent开发复核；核对生成文档、严格变更校验和证据。
- [ ] 4.3 具备真实模型／企业身份／Linux后执行完整产品路径一及T08，按前置和门槛记录正式P1-08复核；缺资源保持未执行，不用本地夹具代签。

2026-11-14：P1-08开发增量1.1／1.2，新增implement-workbench-first-path变更，正式工作包等待前置／G0。原生IndexedDB草稿按主体／项目／Run／表单／依据隔离，本地revision事务CAS；严格原UUID／正文／条件先持久，稀疏唯一pendingForm跨basis阻止绕过未知提交。双页入队只有一条原命令；成功输入回执、清空准确草稿／生成新clientDraftId和释放锁同事务，原信封／历史保留；404／非成功观察不解锁。既有POST包装与lookup核心回执分别严格校验，包装resource／links一致才转核心观察，错operation／上下文／损坏草稿或命令路径关闭准入。真实Edge157／IndexedDB、实际Input API／文件Worker创建项目／消息与原键重放，丢ACK重开、真实事务abort、多页冲突、未来schema升级被外部连接阻塞时旧连接关闭／原数据保留／旧代码拒绝新schema，最终5项通过、0跳过。完整根构建、独立浏览器模块构建、类型／Lint／契约通过；487份源码映射与703输入／产物绑定，最终浏览器JS／map前后SHA一致。初次记录3通过／2失败的回执形状问题、原源码和日志保留；修正严格解析及对齐核心／外层断言，未放宽原身份或事务规则。控制SQL1～45、Runner实现／格式、依赖和旧API保持。模块只提供本地存储，不自行HTTP；当前测试是明确浏览器夹具页面，React工作台入口、三栏／页签、导航／IME、WS及完整T08／首次产品路径继续，浏览器身份为夹具，真实模型／OIDC／Linux仍未配置。 证据：`project/evidence/P1-08/local-input-development-review.md`。

2026-11-14：P1-08工作台页面增量完成1.3／2.1，implement-workbench-first-path累计4/13，正式状态仍等待前置／G0。新增受保护HTML／React脚本、严格准确上下文、nonce CSP及无副作用GET；新项目／消息先本机事务保存原UUID／正文／条件才POST，丢ACK重进不自动发送，lookup404只允许明确同原信封恢复。X-DevMesh-Principal只约束已有可信身份，账号变化在JSON解析及副作用前403；旧客户端可省略，重复头400。三栏／五页签、原消息事实、双项目草稿／页签恢复、快速切换旧读取取消／代际隔离；手动刷新保留basis／焦点／选择，新basis明确切换，旧正文有界参考且不改未知原提交。存储失败保留内存输入并阻止导航／POST，可重试或明确放弃未保存修改。历史／viewer不挂载命令输入或本机命令连接；撤权／账号变化清除保护UI并使迟到列表失效。真实Edge157／生产页面CSP／原生IndexedDB、实际HTTP／文件Worker及存储模块回归最终HTTP14＋浏览器15＝29项通过，0跳过；IME／重复键、Ctrl+Enter、页签方向键与390px截图已核实，事件期间交互仍待WS。根应用／独立模块构建、类型／Lint／契约通过，OpenAPI60路径，539映射与711输入／产物绑定，最终JS／map前后SHA一致。初次12通过／1失败为只读成员夹具缺created_at，另修复测试未使用变量；原日志／源码保留，未削弱断言。SQL1～45、Runner实现／格式及依赖不变。历史接受事实与IdentityResolver为明确夹具；理解／问题／计划详情、附件／新任务、准确候选交付导航、WS／完整D01／T08、真实OIDC／模型／Linux和正式验收继续。 证据：`project/evidence/P1-08/workbench-entry-development-review.md`。

2026-11-14：P1-08计划与来源开发增量完成2.2，implement-workbench-first-path累计5/13；正式工作包仍等待前置／G0。任务页接入真实理解／问题／计划审阅和DAG／工作／准确来源内部返回栈，保持输入草稿；来源GET限定同Run消息、已保存依据中的准确artifact ID／SHA或准确需求版本，2MiB／严格UTF-8、hash及异步权限复核，纯文本转义、无磁盘路径。读取仅产生已释放READ租约，无业务事实；新增公共CONTENT_CORRUPT／CONTENT_TOO_LARGE错误码。独立plan-confirm原命令先本机事务后POST，绑定Run版本／计划／需求／review／carry hash，刷新无自动确认，丢ACK原键核实；412／lookup404保留原UUID与锁，真实事务abort零POST，恢复后须重新勾选。必要问题无默认回答，viewer无确认或本机命令连接。实际官方A2A准备／PreparationRuntime、HTTP／文件Worker和Edge157／原生IndexedDB最终HTTP18＋浏览器21＝39通过，0跳过；根／独立构建、类型／Lint／契约通过，OpenAPI61路径，541映射／716输入产物及最终浏览器JS／map前后SHA绑定。首轮HTTP14/4、浏览器16/5为跨作业bootstrap引用夹具；第二轮HTTP15/3揭示错误码与READ租约断言，原日志／源码保留。SQL1～45／Runner／依赖不变，模型输出／身份／边界来源为明确夹具；附件／回答／新任务、交付导航、WS和完整T08／D01及真实环境继续。 证据：`project/evidence/P1-08/planning-development-review.md`。

2026-11-15：P1-08问题回答子链开发增量，implement-workbench-first-path仍5/13，2.3附件／新任务未结束不勾选；正式状态仍等待前置／G0。新增questions-answer独立草稿／严格原信封，绑定主体／项目／Run／Run版本／需求／问题版本及选项，不采用默认答案。原生事务CAS保存，内部返回／页签／项目切换和刷新先排空，失败保留内存答案并阻止离开；双页冲突须明确勾选放弃本页未保存内容才重新读取，不清除未决原提交；先本机日记后POST，原lookup／原信封明确恢复。即使服务端已ANSWERED或新回答入口关闭，仍可核实原提交；旧Run条件／问题依据拒绝及lookup404不换UUID／版本或解锁。成功核实interpretationOperationId，只表示答案已保存；viewer／历史不挂载回答命令。旧草稿可读、项目／消息键不变，其他依据仅明确复制匹配当前问题版本项。实际A2A准备／PreparationRuntime、HTTP／文件Worker、Edge／原生IndexedDB最终http28＋browser29＝57通过、0跳过；初步根构建及最终Input API／独立构建、类型／Lint／契约通过，OpenAPI61路径，542映射／718输入产物和最终浏览器JS／map前后SHA绑定。模型／身份为明确夹具，真实资源、附件／新任务、交付导航、WS及完整T08／首次路径继续；SQL1～45／Runner／依赖不变。 证据：`project/evidence/P1-08/answers-development-review.md`。

2026-11-15：P1-08过期Run原提交关闭开发增量，implement-workbench-first-path仍5/13，2.3附件／新任务及缺计划时恢复入口继续；正式状态等待前置／G0。消息／回答／计划确认每次明确勾选后，先准确授权更高Run版本、后原主体／scope／UUID查询，只有includeAbsence=true的受保护200准确返回主体／scope／key及operation:null允许独立STALE_BASIS关闭；已有成功走原回执，未知／网络／权限／同版本404不关闭。原生事务完整观察CAS、准确pending指针／草稿版本，释放锁但保留原信封／旧内容／clientDraftId；closedKey拒绝旧依据原地新提交，不自动复制／换键／POST。实际双页仅一方关闭，事务abort不丢原锁，成功／未知观察不被覆盖；迟到旧POST仍412且无业务输入。实际HTTP29＋浏览器33＝62通过、0跳过；初步根构建保留，修正后最终根／独立模块构建、类型／Lint／契约及测试输入字节一致，543映射／719输入产物与最终浏览器JS／map前后SHA匹配。首轮类型TS18047及准确失败源码保留；修正显式null返回并补充关闭落盘后刷新失败提示。OpenAPI61路径，SQL1～45／Runner／依赖不变；真实资源、WS、完整首次路径和正式验收未执行。 证据：`project/evidence/P1-08/original-closure-development-review.md`。

2026-11-16：P1-08原提交独立恢复入口开发增量，implement-workbench-first-path仍5/13、2.3附件／新任务继续，正式状态等待前置／G0。消息新准入关闭、计划history／不可读、问题依据不可读时，当前非viewer准确Run挂载独立恢复区域，与正常表单互斥；只读pendingForm scope查询核对原信封与草稿pendingKey／revision，不创建新草稿／UUID／命令，不改schema1。仅明确原键核实／同信封重试／顺序证明关闭；成功仅说明原请求，不确认新计划或实施。实际计划不可读／终态消息的两个修复前按钮缺失失败保留原始输出与六份准确输入，字节对应基线d79aae4；首轮组合18通过／1原生夹具项目ID错误，原存储断言尚未执行；仅修正ID后重跑完整受影响恢复文件。最终HTTP3＋浏览器5＝8通过、0跳过，应用源码与产物一致；构建／类型后仅修正独立.mjs测试的请求计数与原生项目ID，最终Lint／契约／测试绑定修改后输入，544源码映射／721输入产物与最终浏览器摘要匹配。实际新需求使旧计划history，原确认仍可关闭且迟到旧POST拒绝；回答丢ACK后问题不可读仍恢复唯一原回执；终态SQL仅状态夹具，不代签CancelRun／物理停止。OpenAPI61路径／控制SQL1～45／Runner／依赖不变；真实资源、WS、完整首次路径和正式验收未执行。 证据：`project/evidence/P1-08/original-recovery-development-review.md`。
