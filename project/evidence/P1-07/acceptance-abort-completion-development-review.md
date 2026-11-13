# 接受准备撤销完成：本地开发复核

已实施前向控制迁移41、共享数据撤销协议、私有原后端恢复读取／完成事务和显式RunnerAcceptanceAbortFinalizer。原owner只请求撤销，原配置后端才能提交完整结论；私有读取直接校验原准备／策略／决定，不因当前候选资格或owner变动阻止原后端恢复。

完成证明绑定原决定、controller／原Runner清理摘要、数据abort请求及原journal字节SHA、永久撤权、准确原prepared fences和严格递增的后继generation。已有prepared proof还要求原reservation／profile／instance。源存在时校验旧接受指针、冻结manifest及镜像、准确恢复fence、独立RELEASE_OWNED／READ_WRITE服务和30秒内健康。原DISPATCHED／UNKNOWN写必须按原请求核实，不能据数据回执清除未知。

acceptance_abort_completions、源门CAS及历史、Run资源版本与完成事件同一writer事务。只重开本准备准确关闭的源门，fence／revision各加一；原OPEN门不虚构关开。原SENT／UNKNOWN、错误、revision、proof、决定和数据保留，另投影ABORTED并解除本准备占用。准确重放返回原结果，换证明失败；原T5／迟到观察／目标开门仍被永久禁止，没有新Release或接受指针切换。

最终completion-03 34/34；transaction-03 40/40；runner-03 42/42；acceptance-03 66/66；finalizer-03 1/1，合计183项通过，无失败／跳过。六包构建、根类型检查、Lint、契约生成检查通过，160/160源码映射一致。控制库原1～40迁移正文及manifest条目逐字节与父提交一致，仅新增41；Runner v2～v9的8份迁移SQL正文不变。40→41实际SQLite测试保留原UNKNOWN准备、撤销决定、关闭源门和未知写，DDL及历史写失败恢复旧结构与外键。源码／产物／原输出SHA见[绑定](./development/acceptance-abort-completion/final-binding.json)。

测试实际执行控制SQLite/file Worker、独占原数据日志、Runner SQLite清理和原请求观察；检查精确重复／并发、换决定／数据请求／目标／generation／清理摘要、源指针／镜像／fence／门、过期或只读HELD服务、无关关闭操作及未知原写。完成／门／门历史／Run／事件故障逐点回滚。UNKNOWN原写仅在原请求FINISHED观察后解除阻碍。INITIAL完成后可新准备，旧prepared proof继续不可用。

实际组合包含：原数据文件＋无service reservation的完成；以及经实际AcceptancePreparer取得READY／RELEASE_HELD的服务，原控制撤销决定驱动Runner原容器／网络清理，再由数据Worker保存原恢复回执。控制完成事件故障使事务回滚，原数据receipt保留；再次运行只查询原结果，不重复物理abort，重启后准确重放，原业务文件字节与Runner proof保留。容器／OCI／物理围栏事实均为明确夹具。源门正向／拒绝测试的原准备及Release为明确元数据夹具，不是一次正式接受迭代或真实可写源服务验证。

失败与修正完整保留：completion-01为8/32通过、24失败，缺少新事件契约导致事务回滚、最小源夹具误走当前候选复核及组合测试用了错误backendRef。其最初仅断言reject的负例也已改为准确错误码，不能把初轮拒绝当作该边界通过。completion-02为30/32，剩余同一个目标门错误码断言及父分组失败；新增门守卫抢先返回通用错误码，迁移41恢复原ACCEPTANCE_ABORT_REQUESTED语义并保留所有拦截。两轮原输入源码各22份逐SHA保存。

构建绑定：build-01／02／03均完成且各自运行期间输入不变。build-02结束后、第二轮探索测试前补充源冻结manifest哈希核验，第二轮使用的源码比产物多该一处，已有159/160的中间映射结果如实保留；不将该轮作为最终验证。build-03包含该核验、SQL错误码修正及原写结局／无关关闭用例，前四组最终测试输入和产物完全对应。之后仅增加独立MJS测试acceptance-abort-finalizer.test.mjs，验证非空HELD服务路径及控制失败恢复，无生产源码／产物变化；该独立测试在最终输入上通过，不声称前四组读取过这个后来新增文件。

设计六专题、生成完整设计、实施文档、验收场景、OpenSpec增量规格及台账基线已同步。post-1的diff检查发现八份文档末尾多余空行，修正后post-2记录最终台账render/check、OpenSpec、设计生成、契约、Lint及两项diff检查。此修正仅文档格式，测试源码和产物未变。本轮是修改中checkout的本地开发复核；未执行完整根pnpm check、固定提交干净checkout、独立／产品验收。真实物理撤权、源服务恢复及可写发布适配器仍未提供，默认不装配；保留迁移／替换完整正式流程及Linux／gVisor／身份实测另行执行。4.1不勾选，OpenSpec保持8/13、不归档，正式P1-07保持NOT_STARTED／未认领并等待P1-06／G0。

全部原始输出、指纹、失败源码和运行脚本见[清单](./development/acceptance-abort-completion/manifest.json)。
