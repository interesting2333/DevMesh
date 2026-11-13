# P1-08 工作台页面开发复核

2026-11-14：P1-08工作台页面增量完成1.3／2.1，implement-workbench-first-path累计4/13，正式状态仍等待前置／G0。新增受保护HTML／React脚本、严格准确上下文、nonce CSP及无副作用GET；新项目／消息先本机事务保存原UUID／正文／条件才POST，丢ACK重进不自动发送，lookup404只允许明确同原信封恢复。X-DevMesh-Principal只约束已有可信身份，账号变化在JSON解析及副作用前403；旧客户端可省略，重复头400。三栏／五页签、原消息事实、双项目草稿／页签恢复、快速切换旧读取取消／代际隔离；手动刷新保留basis／焦点／选择，新basis明确切换，旧正文有界参考且不改未知原提交。存储失败保留内存输入并阻止导航／POST，可重试或明确放弃未保存修改。历史／viewer不挂载命令输入或本机命令连接；撤权／账号变化清除保护UI并使迟到列表失效。真实Edge157／生产页面CSP／原生IndexedDB、实际HTTP／文件Worker及存储模块回归最终HTTP14＋浏览器15＝29项通过，0跳过；IME／重复键、Ctrl+Enter、页签方向键与390px截图已核实，事件期间交互仍待WS。根应用／独立模块构建、类型／Lint／契约通过，OpenAPI60路径，539映射与711输入／产物绑定，最终JS／map前后SHA一致。初次12通过／1失败为只读成员夹具缺created_at，另修复测试未使用变量；原日志／源码保留，未削弱断言。SQL1～45、Runner实现／格式及依赖不变。历史接受事实与IdentityResolver为明确夹具；理解／问题／计划详情、附件／新任务、准确候选交付导航、WS／完整D01／T08、真实OIDC／模型／Linux和正式验收继续。

## 实际验证与结果

- Protected HTML/script identity defaults, strict scope/query validation, asynchronous membership recheck, nonce CSP/no-store and GET without input facts.
- Expected-principal mismatch before malformed JSON and all effects, duplicate-header refusal, no identity from that header and existing clients without it.
- Actual project POST observes committed IndexedDB journal first; committed ACK loss reload does not post; explicit lookup restores one project/input and retains original envelope.
- Message lookup miss retains original; explicit retry uses exact original UUID, body and If-Match, creates one input.
- Two-project drafts/tabs, explicit basis change and bounded old-basis references; manual refresh preserves text, focus and selection.
- Real IndexedDB abort retains in-memory input, blocks navigation and zero POST until successful local retry.
- Account change refuses old subject before operations, clears protected UI and isolates reentry; history/viewer do not mount a composer or local command connection.
- Rapid switch rejects an old workspace response; membership loss clears old messages and a delayed old project list cannot refill protected UI.
- Actual native local-module CAS/races, journal replay, corruption and schema-upgrade regressions; IME/repeated-key exclusion, shortcut submission, tab keyboard and 390px screenshot.

最终HTTP14项、浏览器15项，共29项通过，0失败／跳过。完整根构建、独立模块构建、类型／Lint／契约通过；539份源码映射、711输入／产物、准确浏览器JS／map前后SHA一致。OpenAPI60路径。旧控制SQL1～45、Runner／依赖保持。构建缓存位于本机D:/yms/AI/DevMesh/packages/input-api/dist/web/workbench及.cache/workbench-local-build，只是本机制品位置；准确hash与可重建命令保存在证据中。

## 失败、开发复核与边界

首轮浏览器12通过／1失败，只读成员夹具漏填created_at，失败发生于插入fixture而非执行产品断言；首次Lint还有一个未使用测试变量。准确源码、输入SHA和原日志保留，修复fixture与变量，没有删减断言。随后补入快速切换、历史只读，并复核撤权后的并发列表：统一关闭保护状态时递增请求代际／取消读取，真实延迟响应验证不能重填内容。中间通过记录只作诊断，最终只计最后一组带产物前后SHA的HTTP14＋浏览器15。

同一Codex Agent开发复核，非独立人员／产品签认。历史测试以明确已接受Release事实允许真实新任务API创建后继Run，不能视作实际接受流程；浏览器使用明确测试IdentityResolver。基础页签提供当前已保存事实，详细理解／计划、附件／新任务、准确候选交付链和WS继续。快捷键／390px／手动刷新已测，事件期间焦点和完整T08／D01仍待验。真实企业身份、模型和Linux未配置，正式工作包和门槛状态不变。

入口：`/api/v1/workbench/view`，可用projectId与runId选择准确上下文。默认无身份配置仍拒绝；主体头只约束已认证请求，不建立登录。

证据：[evidence.json](./development/workbench-entry/evidence.json)、[final-binding.json](./development/workbench-entry/final-binding.json)、[failure-history.json](./development/workbench-entry/failure-history.json)、[390px截图](./development/workbench-entry/screenshots/workbench-390.png)、[manifest.json](./development/workbench-entry/manifest.json)。
