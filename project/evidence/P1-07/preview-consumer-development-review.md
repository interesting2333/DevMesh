# P1-07 原预览生命周期后台消费开发复核

2026-11-13：2.3／5.1原预览可信后台消费：PreviewLifecycleConsumer＋startPlatform显式previewLifecycle工厂，核实DB原项目／策略／主体／backendRef／Runner；全部后续启动成功后才扫描，默认无后端。复用原生命周期页，原一次许可、SENT／UNKNOWN只查、周期健康／确定键到期与Release归属保护；有限轮转／页预算、最多2项目并发、每项目串行和tick合并。预检后／派发前复核停止，最终授权立即关闭，实际排空后关闭存储。consumer 13通过，lifecycle 16通过／1跳过，domain 81通过，共110通过、1跳过；完整构建／类型／Lint／契约、368条源码映射及旧SQL1～44／Runner／依赖未改通过，最终所有输入无漂移。前两轮各有1项测试断言失败：首轮改写夹具execute内部仍调用的this.preflight，修正为独立公开facade；第二轮按并发返回的Map插入顺序比较计数，修正为按原项目ID核对。两轮日志、原源码SHA／字节及原因保留于initial-failure和second-failure；产品代码未因这些失败改动。修正后重新完整构建并在相同最终输入重跑全部分组。真实控制／Runner／业务文件Worker和宿主、30秒健康及真实TTL定时；物理容器／网络／OCI及上游事实为明确夹具，归属测试投影不冒充T5。无自动dataset／owner决定／接受，真实Linux／完整后继链／工作台与干净checkout验收继续；正式P1-07／OpenSpec8/13／阶段门槛不变。

## 可信装配与原对象

previewLifecycle是可执行可信宿主工厂，固定原project／policyHash／principal／backendRef／Runner及PreviewExecutionBackend；不是JSON或公共HTTP／MCP注册。仅需持久存储，Input API／身份／网关独立配置。新增私有只读getPreviewLifecycleScope核实原DB策略，所有后续宿主组合成功后才start。无新迁移、表或依赖，Runner源码及持久格式未改。

复用原listPreviewLifecycles，终态且无未决effect的历史保留但不占工作页；每轮每项目只取一页，末页归零，范围轮转。最多32项目、2项目并发且每项目串行，1～20页项／1～32范围预算和1～10秒轮询；tick合并。方法固定而不修改调用者，configured动态核实，错误保留安全码。单范围失败不阻止其他范围。

原PREPARED获取一次许可，SENT／UNKNOWN只查原对象；原成功start receipt不可变，健康由新观察刷新。真实TTL的原确定键停止与Release归属保护仍由原writer／Runner核实。消费不自动创建dataset／owner决定、不接受或发布、不删除业务数据。预算较小或后端繁忙可让健康过期，过期即关闭可用性。

## 停止与实际验证

stopAdmission同步关闭所有manager、新扫描及最终授权。manager在预检返回后／原许可后及再次读取生命周期后检查关闭，到期决定前同样复核；不以已退出线程、Promise竞赛或超时认定外部动作取消。consumer等待实际pass／loop结束后关闭manager，宿主最后关闭存储；外部资源归构造者，适配器需自行限制I/O。

- The private getPreviewLifecycleScope authenticates the registered original service identity. Factory validation rejects foreign project/policy/principal/backendRef/Runner, disabled or duplicate bindings and invalid budgets before backend work.
- Ticks coalesce, terminal history is excluded, active pages rotate, and installed adapter methods remain pinned. Actual dispatch/runtime ACK loss plus control Worker reopen retain one original start and never replay execution.
- Stop during paused preflight leaves PREPARED; stop during execution denies final authorization and waits for the real Promise before completing. The manager checks closed state again after preflight and before new dispatch/expiry.
- Three actual control Workers joined by an explicit local dispatcher demonstrate scope rotation, at most two unfinished project calls and failure isolation. This is not distributed deployment evidence.
- Actual clocks and file-backed Workers wait more than 30 seconds to expire health, then independent periodic consumption restores it. At real original TTL, one preview gets one original expiry stop while another project retains its explicit Release ownership projection beyond its own TTL. The projection is not a T5 acceptance.
- Actual dataset files, Runner store/journal and loopback HTTP health compose with the consumer. A recorded original stop survives owner removal; business database bytes remain identical and no Release is created.
- Actual foundation startup defaults this consumer off, rejects invalid scopes and later MCP-factory failure without backend work, releases storage for restart, closes authorization on stop and drains before SQLite closes. Restart inspects only the original operation without Input API or a model identity.

## 验证边界

consumer 13通过，lifecycle 16通过／1跳过，domain 81通过，共110通过、1跳过。唯一条件跳过是Windows上的原POSIX SIGTERM用例，不计通过。完整构建、类型、Lint和契约通过，368条源码映射及678份输入／产物绑定，全部最终组在相同源码／测试执行，运行中／之后无漂移。旧控制SQL1～44、Runner全部源码／存储格式和依赖保持。前两轮各有1项测试断言失败：首轮改写夹具execute内部仍调用的this.preflight，修正为独立公开facade；第二轮按并发返回的Map插入顺序比较计数，修正为按原项目ID核对。两轮日志、原源码SHA／字节及原因保留于initial-failure和second-failure；产品代码未因这些失败改动。修正后重新完整构建并在相同最终输入重跑全部分组。未跑完整pnpm check或固定提交干净checkout。

实际控制／Runner／业务文件Worker、loopback HTTP、宿主启停、实际30秒健康和真实TTL定时分别有原始日志；物理容器／网络／OCI、源Git／候选上游及归属投影为明确夹具。无真实Linux／gVisor、企业登录、物理迁移或完整后继业务链证据。单Agent开发复核，不是独立人员／人工产品签认。正式P1-07仍等待P1-06／G0；完整2.3／4.1／4.3／5.1／5.2未完成，不改8/13、不归档或通过门槛。

原始记录：[evidence.json](./development/preview-consumer/evidence.json)、[final-binding.json](./development/preview-consumer/final-binding.json)、[manifest.json](./development/preview-consumer/manifest.json)。
