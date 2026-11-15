# P1-08 永久移除原输入处置开发复核

2026-11-16：P1-08永久移除原输入处置开发增量完成本机验证。新增独立REMOVED_ATTACHMENT顺序证明，受保护GET严格200，普通404／非200／未知或权限失败不关闭；完整原观察／草稿CAS关闭，保留信封和完整快照，不伪造成功。项目和同Run版本消息均可明确空白开始，生成新输入身份、保持单调revision且零自动复制／POST；原历史链接在新提交成功和旧依据参考中保留，分页严格下降。原生abort及双页竞争／并发观察、实际multipart移除／T1拒绝／延迟原请求、受保护页面及26条历史（25条明确夹具＋1条实际原请求）验证。最终新增浏览器6＋既有完整浏览器43＋HTTP15＝64通过，零失败／取消／跳过；应用／独立模块构建、类型／Lint／契约及最终输入零漂移，546源码映射／724输入产物匹配。首轮定向2项0通过／2失败原日志／准确源码／实际JS／map保留：事务中止后继续写被归类为坏记录，修正已中止事务的异常处理；长历史夹具误填不合法空项目名，改为有效名，未放宽断言。最初shell筛选实际0业务用例，不计通过。SQL1～45、Runner／依赖／公共契约未改。同一Agent开发复核；正式P1-08／前置／G0和5/13、2.3未变；附件控件／新任务／WS与真实资源／产品验收继续。

## 实际验证

- 真实READY上传／冻结原项目或消息／DELETE移除／T1拒绝首次提交；顺序受保护REMOVED读取后，准确主体／scope／UUID的includeAbsence200才可关闭。延迟原请求仍拒绝且原操作仍不存在。
- 完整原命令及草稿snapshot、pendingForm／revision的原生CAS；双页关闭／显式空白各只有一个胜出。实际事务abort及明确注入标记要求完整回滚、零HTTP／页面异常；草稿单独变化或并发未知观察不能被关闭覆盖。
- 项目和Run版本未变的消息明确空白重开，新clientDraftId／单调revision／空正文和选择；无自动复制／POST。后来真实新输入成功，重开新项目或旧依据参考仍可读准确关闭历史。
- 有界历史每页10，25条明确元数据夹具加1条实际关闭原请求共26条全部可读；跨页rank循环、缺失、跨主体及根错配拒绝，不冒充25次真实上传或项目操作。
- 实际受保护页面核实遇到503／404／非200成功状态／错误附件或主体时保留原日记；明确未知操作转为观察并继续锁定。已绑定附件DELETE409，正常原键成功回执恢复保持，不伪造移除证明。
- 完整新增removed文件6项、原六份浏览器文件43项和既有HTTP15项分别执行，共64项不重复通过；本机事务、恢复／答案／计划／权限／窄屏与来源回归保持。

最终不重复总数64；原生focus和其他探索运行不叠加进总数。全部最终源码／测试与对应构建／测试输入绑定，实际JS／map在测试前后及当前逐字节一致，源码映射内容准确匹配；没有跳过、放宽业务断言或构建后源码豁免。最终构建针对唯一变化的input-api包和独立本机模块；其他包使用已构建且与未改源码一致的产物。详细时序和每份命令见原始记录。

## 首轮失败与修复

focus首次实际2项0通过／2失败，准确源码、实际模块和页面JS／map及原日志均保留。注入commands写后原生事务abort，随后drafts写抛出已中止事务异常；现在guard安全处理中止后的二次abort，并将原生AbortError／InvalidStateError／TransactionInactiveError归类为存储不可用，业务冲突／坏记录仍分别拒绝。新增明确abort触发标记，保留完整回滚、零HTTP与pageerror断言。旧失败尚未执行到回滚断言，不把它记为已验证回滚。

历史元数据夹具给可选项目名写了空字符串，被现有严格契约拒绝；改为合法夹具名并保留全部跨页／循环／主体检查。后续原生2项通过是修复阶段记录，不再重复计算；最终完整6项包含加强后的草稿单独变化CAS及所有原断言。最初shell带引号的name-pattern没有匹配业务用例，仅Node文件包装返回0；明确不计通过，改用结构化参数。类型探索的可空快照错误已修正，最终类型检查独立记录。

## 数据与产品边界

原请求信封、clientDraftId、正文／名称／附件选择及关闭前完整草稿保留；关闭事实与成功回执分离。显式空白开始同时适用于版本未变的消息，解决仅靠切换当前依据无法重开的问题；原证明不依赖伪造Run递增。新链接字段可选，沿用IndexedDB2；旧代码遇到新字段关闭准入，不清库。SQL1～45和Runner／契约／依赖不变。

- Formal P1-08 remains NOT_STARTED pending prerequisites/G0; same-agent development review, not independent/product approval.
- OpenSpec remains5/13 with2.3 unchecked. Attachment picker/upload page controls, new-task entry and later work remain.
- Actual files and pending originals are prepared through an explicit same-origin native fixture until attachment controls are implemented. Long history, unavailable responses and unknown-operation races are explicit fixtures.
- No real model/OIDC/Linux, WebSocket, complete first-use path or formal gate/product acceptance.
- Only input-api application artifacts need rebuilding for this increment; all unchanged workspace maps and migration bytes are also checked against current source/base.

证据：[evidence.json](./development/removed-original/evidence.json)、[final-binding.json](./development/removed-original/final-binding.json)、[manifest.json](./development/removed-original/manifest.json)。
