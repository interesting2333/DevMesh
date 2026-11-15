# P1-08 小屏恢复反馈开发复核

2026-11-16：P1-08小屏恢复反馈修正。修复前实际Edge复现1项0通过／1失败：原确认回执已持久且桌面刷新后可见，390px切详情隐藏提示，准确源码／原日志／截图保留。将唯一已提交结果节点移到共享顶部区，保留上下文／身份／权限清除及旧回调保护；无可读计划时区分读取中／暂不可读，不再把503显示为尚无计划。最终HTTP3＋完整恢复浏览器5＝8通过、零失败／取消／跳过；实际workspace刷新后核对准确原回执及唯一确认／零实施attempt，再验证390px全部面板可见、无横向溢出、零额外POST。最终根／独立构建、类型、Lint、契约和回归输入零漂移，546源码映射及723输入产物匹配。SQL1～45、Runner／依赖／契约未改。同一Agent开发复核；正式P1-08仍等待前置／G0，变更5/13、2.3未勾选，附件UI／永久移除关闭与新草稿／新任务／WS和真实资源／产品验收继续。

## 实际检查

- 实际503计划读取显示暂不可读，不能出现尚无已保存计划；原信封、显式核实与原键重试保持。
- 真实确认POST后经实际workspace GET闸门等待刷新结束，成功提示、准确原回执／信封仍保留；SQLite仅一次确认／原操作，零实施attempt。
- 390×844切项目／输入／详情，唯一结果提示始终可见，无横向溢出且确认POST仍仅一次；保存修复前后截图。
- 整份恢复文件5项以及受保护页面／脚本／CSP HTTP文件3项完整串行通过；原终态Run、未知／404、历史／viewer与跨主体恢复隔离断言保持。

根构建、独立本机模块构建、类型、Lint与契约全部在最终源码／测试定稿后执行，随后先HTTP再完整恢复浏览器文件；所有输入在运行前后及当前均零漂移，源码映射内容与源码准确字节匹配，实际JS／map前后及当前hash一致。未增加超时、跳过用例或放宽原回执／SQL断言，全部8项一次最终调用通过。先前附件增量的其他浏览器文件没有在本次重跑，不重复计入。

## 复现与修复

修复前的已提交应用aac191b加小屏断言运行1项0通过／1失败；失败位置为390px切详情后的toBeVisible，之前的真实刷新、准确回执和唯一SQL事实已完成。三份准确复现源码及原日志／截图保留，失败不计入绿色总数。原成功反馈位于conversation面板，移动导航隐藏该面板时也隐藏提示；改为共享顶部唯一节点，定向CSS使其单独占行。结果状态、上下文和撤权清除、过期回调保护、命令和存储语义不变。

截图还显示503时使用“尚无计划”占位；改为读取中／暂不可读，并在相同真实503用例增加不存在误导占位的断言。该文案检查在红色复现后增加，最终全部源码／测试重新构建和验证，没有构建后豁免。修复后截图见screenshots/feedback-390.png，可与failed-source/feedback-390.png比较。

## 边界

- Same Codex Agent development review; formal P1-08 remains NOT_STARTED pending prerequisites/G0.
- OpenSpec remains5/13 and task2.3 unchecked; attachment UI, permanent removed-attachment closure/new draft, new-task entry and later steps remain.
- Model outputs, bearer identities and terminal SQL state are explicit fixtures; this is not real model/OIDC/Linux, CancelRun execution, WebSocket or complete product acceptance.
- Only the affected recovery/browser and protected-page HTTP files were rerun for this presentation change; this is not a rerun of all43 browser cases from the prior increment.

SQL1～45逐字节与基准提交一致，Runner／依赖／公共契约未改；同一Agent的开发复核不替代独立人员或正式产品签认。

证据：[evidence.json](./development/global-feedback/evidence.json)、[final-binding.json](./development/global-feedback/final-binding.json)、[manifest.json](./development/global-feedback/manifest.json)。
