# P1-08 本地输入基础开发复核

2026-11-14：P1-08开发增量1.1／1.2，新增implement-workbench-first-path变更，正式工作包等待前置／G0。原生IndexedDB草稿按主体／项目／Run／表单／依据隔离，本地revision事务CAS；严格原UUID／正文／条件先持久，稀疏唯一pendingForm跨basis阻止绕过未知提交。双页入队只有一条原命令；成功输入回执、清空准确草稿／生成新clientDraftId和释放锁同事务，原信封／历史保留；404／非成功观察不解锁。既有POST包装与lookup核心回执分别严格校验，包装resource／links一致才转核心观察，错operation／上下文／损坏草稿或命令路径关闭准入。真实Edge157／IndexedDB、实际Input API／文件Worker创建项目／消息与原键重放，丢ACK重开、真实事务abort、多页冲突、未来schema升级被外部连接阻塞时旧连接关闭／原数据保留／旧代码拒绝新schema，最终5项通过、0跳过。完整根构建、独立浏览器模块构建、类型／Lint／契约通过；487份源码映射与703输入／产物绑定，最终浏览器JS／map前后SHA一致。初次记录3通过／2失败的回执形状问题、原源码和日志保留；修正严格解析及对齐核心／外层断言，未放宽原身份或事务规则。控制SQL1～45、Runner实现／格式、依赖和旧API保持。模块只提供本地存储，不自行HTTP；当前测试是明确浏览器夹具页面，React工作台入口、三栏／页签、导航／IME、WS及完整T08／首次产品路径继续，浏览器身份为夹具，真实模型／OIDC／Linux仍未配置。

## 实际验证

- Reload and exact principal/project/run/basis isolation, two-page stale-save CAS and unique original enqueue.
- Actual project POST ACK loss, exact lookup and original replay retain one project/input; successful observation preserves original envelope and atomically clears only its draft and lock.
- Message unknown locks across changed Run basis; lookup miss and non-success observation retain the original lock. Actual message POST and exact successful observation release it without changing the envelope.
- Actual IndexedDB transaction abort rolls back both command insertion and draft pointer. Corrupt draft revision and mismatched message command path fail closed.
- Real blocked future native schema upgrade closes both old module connections, retains original rows and makes old code refuse the newer version.

最终5项通过、0失败／跳过。完整根应用和独立生产浏览器模块构建、类型／Lint／契约通过，487份源码映射、703输入／产物与浏览器前后SHA一致；旧SQL1～45、Runner／依赖保持。独立浏览器构建位于本机D:/yms/AI/DevMesh/.cache/workbench-local-build，hash见evidence.json；此本地缓存不是跨机器制品地址，可按已保存构建命令重建核对。

## 失败与范围

记录的首次复现3通过／2失败：POST包装回执和lookup核心形状不同，初始模块只接受后者；测试也错误比较外层完全相等。修复为沿用两份既有严格契约、核实resource／links一致后采纳核心；测试核对核心、外层及错包装拒绝，保留原身份／事务断言。失败原日志、输入SHA与两份准确源码保留；后续正向预检及增加损坏命令断言的运行仅为诊断，最终只计最后一次带编译产物前后SHA的5项。更早的空值类型检查及未记录首跑只在会话输出，不伪造原始日志。

当前schema是首版；未来原生升级在明确外部连接阻塞下测试了旧模块versionchange关闭与新版本拒绝，不宣称已实现未来正式迁移或升级UI。模块不会自行发请求；浏览器以明确测试页面加载生产模块，实际API身份仍为夹具。工作台入口／三栏／导航／IME／WS／完整首次路径、真实环境和正式工作包验收继续。

原始记录：[evidence.json](./development/local-input/evidence.json)、[final-binding.json](./development/local-input/final-binding.json)、[failure-history.json](./development/local-input/failure-history.json)、[manifest.json](./development/local-input/manifest.json)。
