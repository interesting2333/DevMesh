# Preview Runner integration

当前实现私有持久容量预留、统一准入、原容器动作及清理日志、Runner 独立到期 watchdog 和 Release 归属保护，以及显式 `RunnerPreviewBackend`／`DockerPreviewDriver` 代码。Docker Driver 需要真实 Linux、可信硬配额和宿主网络隔离适配器，缺任一项保持关闭；这些适配器、真实容器联调及平台默认装配仍待实施，此文不是可运行容器服务的部署说明。HTTP 健康探针见 `preview-health.ts`，控制面生命周期恢复见 `@devmesh/platform-core` 的 `PreviewLifecycleManager`。

## Capacity and private store calls

Runner SQLite v6 在原 v2 workspace fence、v3 容量预留、v4 容器日志、v5 归属之后前向迁移，逐一核实 v2～v6 的原迁移 SHA，不修改旧迁移正文或原数据。v6 在事务外关闭 foreign_keys，事务内新建扩展 REMOVED CHECK 的预留表、复制原行、删除旧表、重命名新表并恢复索引／触发器，核实 foreign_key_check 后提交，最后恢复 foreign_keys。升级失败回滚本次 DDL 和版本，核实失败原因后用相同新程序重试。旧程序不支持 v6，不能用旧二进制直接打开升级后的 store；回退时关闭新准入，保留并核实原对象，不手动降级数据库。旧预览没有明确归属时保持 UNENROLLED，仅查询，不能自动收养或停止。

可信装配通过同一个 `RunnerStore` 调用；这些方法没有公共 HTTP／MCP 路由。`capacityConfigure({maximumJobs,cpu,memoryMiB})` 的数值必须来自 Runner 部署预算，已经扣除系统预留。`RunnerManager.start()` 固定同一预算；`claim` 与 `previewReserve` 都校验相同预算。同一 Worker 的预算不允许变动，需关闭／重开 Worker 后显式配置；降低预算不释放现存对象，只阻止超额新准入。

- `previewReserve({controllerId, request, requestHash, resourceLimits, capacity})` 绑定完整 `previewStartRequest`，校验 canonical SHA、原 runnerId 与固定 CPU／内存／PID／临时盘声明。相同 controller／operation 返回原预留；请求或资源变化拒绝。同一 Runner 上所有 controller 不能并占同一 preview／可写 dataset。
- `previewReservationDispatch` 持久地授予一次 Runner 内派发位。调用者只有明确收到 `dispatch=true` 才能继续；丢回执不等于允许重发。该派发位不替代控制面的原派发许可或最后授权检查。
- `previewReservationRecord` 使用 revision CAS 与准确观察时间记录可信后端事实。核实后的实例和首次 loopback 端口固定。UNKNOWN 保留已知身份和容量；普通观察只有准确原实例 EXITED 才释放已派发预留，直接传入 REMOVED 被拒绝。REMOVED 必须走下述独立清理证明。
- `previewReservationCancel` 只取消从未派发的 RESERVED；不能以停止意图、超时、过期、查不到对象或失联作为已退出证据。取消幂等，不删除 dataset 或原预留。
- `previewReservationGet`、`previewReservationByOperation` 与 `previewReservationPage` 限定原 controller；分页只扫描未释放对象，每个恢复周期从 0 开始。`capacityUsage` 用于私有诊断，统计所有 controller 的未退出作业与未释放预览。

预留、派发与每次观察的不可变快照同事务保存。SQLite 串行 writer 在同一准入事务累计 slot／CPU／内存：作业 QUEUED 不占计算资源，其他非 EXITED 状态继续占用；预览 RESERVED／DISPATCHED／ACTIVE／UNKNOWN 均占用。停止阶段未证明原退出就仍占用。CPU／内存之外的 PID／临时盘字段仅固定为后续实际容器策略输入，本实现不冒充 cgroup 或磁盘配额。

## Durable original actions

`previewContainerPrepare` 固定原预留的镜像 repository、可信解析 dataset 目录、配额、原资源和确定性 network／container 名称。相同原 profile 幂等读取，变更拒绝；重启查询使用已保存 profile，不用新配置替换原对象。`previewContainerGet` 限定原 controller／requestHash。

`previewContainerActionBegin` 在任何外部副作用前事务持久化 `NETWORK_CREATE`／`CREATE`／`START`／`STOP` 的原完整请求、hash、operation、profile 和 `SENT`。每个动作只有一次 `dispatch=true`；ACK 丢失后不能补发。CREATE 需要已核实原 network，START／STOP 需要已核实原 container；STOP 绑定原启动 operation／hash／准确实例。`previewContainerActionObserve` 只追加一次准确对象事实，网络／容器首次绑定与动作观察同事务提交，不可替换或删除。

`RunnerPreviewBackend` 显式组合实际 dataset 后端、Runner store、路径解析及容器 Driver。控制面与 Runner 两级派发位都要求明确许可；每个外部变更还在异步检查结束后立即复核当前授权。重启或 UNKNOWN 只查询确定性原名称和固定 labels／profile／对象 ID，补记已存在的原事实；不继续尚未派发的下一动作。真实固定 loopback HTTP 探针通过才形成 HEALTHY；停止只核实原实例，EXITED 后释放容量并保留 dataset。CREATED 且从未启动不是 EXITED，停止仍返回未核实，只有下述独立移除证明才能释放。

## Runner custody and independent expiry

`previewLifecycleEnroll` 只登记尚未派发且没有容器动作的新 RESERVED，固定原期限；重复读取原记录。归属为 PREVIEW／STOPPING／RELEASE_HELD／RELEASE_OWNED，附 revision 与不可变历史。STOP 唯一派发位与 PREVIEW→STOPPING 在同一 writer 事务提交；开始停止后不能再持有同一实例，HELD／OWNED 也不能授予 STOP。NETWORK_CREATE／CREATE／START 在最后外部执行前还核实 Runner 当前归属、期限和原 SENT 动作，平台许可不能覆盖 Runner 的到期拒绝。

私有 `previewReleaseHold` 绑定完整 canonical claimHash、原启动 operation／requestHash、准确 candidate／manifest／preview／dataset／image／instance、新鲜原 HEALTHY 及接受 requestHash／releaseId；重复原 claim 幂等，任何替换拒绝。`previewReleaseCommit` 只把原 HELD 确认为 OWNED。这是未来 T5 必须接入的可信后台握手，尚未实现跨控制面的 T5：必须先持有，再提交接受，最后按原键确认归属；未知接受结果先查原提交，不能依靠预览 TTL 自动释放 HELD。当前没有自动撤销接口，撤销需要后续实现明确的未提交证明；不能把私有确认调用当作已保存 Release 的证据。

显式构造 `new RunnerPreviewWatchdog(backend, {enabled:true, pollIntervalMs:1000, pageSize:20})`，调用 `start()`，退出前 `await close()`。默认关闭；不得提供普通用户／模型可替换的 backend 或 store。循环只依赖 Runner 原记录和 Driver，不依赖平台数据库／连接／15 秒作业租约。每轮从 sequence 0 分页，单对象失败隔离、同周期不重入；close 等待当前周期且最后执行许可检查阻止新的副作用。错误通知回调失败不会中断后续扫描。

Runner 使用单调经过时间、持久墙钟高水位及到期锁存；观察到回拨立即到期，Worker 内即使外层事务回滚也记住该观察，持久锁存提交后跨重启保留。完全未观察到的宿主重启期间时钟变化仍依赖可信宿主时间，不能宣称解决任意时钟篡改。到期只取消从未派发的预留；已派发对象先查准确原事实，再为核实原实例保存确定性 EXPIRED STOP，并通过原日志派发一次。丢许可／执行 ACK 或未知停止只查询，不重发、不换实例；CREATED 从未启动仍不冒充 EXITED。HELD／OWNED 永远受保护，dataset 不删除。

## Original removal and separate absence proof

`cleanupReservation` 只处理 STOPPING、有准确原 STOP／container／network 绑定的对象；运行中／未知实例、HELD／OWNED 和未登记旧对象保持保护。`previewCleanupActionBegin` 分别保存 CONTAINER_REMOVE／NETWORK_REMOVE 的原启动 hash、STOP hash、profile hash 和完整对象 ID，每个动作唯一 SENT／dispatch；原记录不可替换或删除。已存在 SENT 只查原 ID，不再派发，包含许可、执行或观察提交丢 ACK 后的恢复。

Driver 再核实准确原 CREATED／EXITED 容器及最后授权，按完整 ID 调用不带 force／volumes 的 container rm。随后成功的 container ls --all --no-trunc 原 ID 过滤查询为空才构成消失证明；非零、超时、inspect-null、短 ID 或不符输出均不足以证明。`previewCleanupActionObserve` 在同一事务提交 OBSERVED、尚未释放预留的 REMOVED／releasedAt 和容量历史；失败全部回滚，恢复查询原 ID，不重复删除。原 EXITED 已释放时保留原状态／容量历史，清理日志另记移除。创建结果尚未知且无已核实 ID 的对象不能借空查询释放。

控制面用 REMOVED runtime 与 PREVIEW_REMOVED／removalVerified 回执区别于 EXITED／PREVIEW_STOPPED／exitVerified；回执须匹配原实例及同次观察。历史已有 REMOVED 后不能用后续 UNKNOWN 再复活 HEALTHY。dataset／元数据和业务文件全部保留。

容器消失后才按完整原 network ID 核实独占空网络并调用 network rm。watchdog 另扫清理未完成原记录，包含已经 EXITED／REMOVED 释放容量的对象；网络移除 ACK 丢失不会因活动预留扫描排除而遗失。成功的 network ls --no-trunc 原 ID 查询为空才记 OBSERVED。原请求处于未知时继续保留日志，不能通过重发或清理其他对象推进。

迁移流程依据 [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)，移除语义见 [Docker container rm](https://docs.docker.com/reference/cli/docker/container/rm/)／[network rm](https://docs.docker.com/reference/cli/docker/network/rm/)。实际目标 Docker／gVisor 路径仍须 Linux 验证。

## Docker profile and required adapters

Driver 使用绝对 Docker 程序路径、Unix socket、固定 argv／有限环境、无 shell、有界输出与超时；不向容器传平台凭据。镜像检查区分 manifest digest 与 config ID，并逐项核实 repository／digest、OS／架构、原 config、层 diffID 顺序及源码／构建 labels。每次容器观察重新检查原 profile、镜像 config、资源、挂载、labels、网络与 loopback 端口，不收养或停止身份不符对象。

每份预览独占 internal bridge，关闭同网互通及 IPv6，单个端口只发布到 `127.0.0.1`；`PreviewNetworkIsolation.enforce/verify` 还必须实施并核实禁止访问宿主、控制面及其他网络，只保留宿主发起的发布端口流量。仅有 `--internal` 不算完成该隔离适配器。创建但尚未启动的容器允许原网络名称下未分配的 endpoint ID，HostConfig 仍必须绑定完整原 network ID；运行时必须核实真实 endpoint ID。

容器参数固定 runsc、UID/GID 10001、只读根、cap-drop ALL、no-new-privileges、私有 cgroup／IPC、CPU／内存／禁 swap／PID／文件句柄／临时盘限制、有界日志及无自动重启。可写挂载只针对原 dataset；同目录的 `operation.json`／`receipt.json`／`dataset.json` 另外覆盖只读文件挂载，保留准备原证据。`PreviewDatasetQuota.prepare/verify` 必须落实硬目录配额和专属 UID/GID 权限，不能用文件大小轮询替代硬配额。模板仅在显式 `APP_HOST=0.0.0.0` 时提供容器内监听，本地默认 loopback。

网络语义参考 [Docker bridge](https://docs.docker.com/engine/network/drivers/bridge/)／[端口发布](https://docs.docker.com/engine/network/port-publishing/)，资源参数参考 [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)；未启动 endpoint 的配置与运行分离参考 [Moby updateContainerNetworkSettings](https://github.com/moby/moby/blob/master/daemon/container_operations.go)。这些资料用于代码复核，不能替代目标版本的实际 Docker／gVisor 验证。

## Separate acceptance preparation

`RunnerAcceptancePreparationBackend` is an explicit trusted composition of `LocalSqliteAcceptanceDatasetBackend`, the original Runner service journal and an `AcceptanceServiceDriver`. It does not synthesize preview requests. `DockerAcceptanceServiceDriver` mounts the entire original `/data` read-only with `APP_READ_ONLY=true`; OCI, sandbox, resources, network and loopback checks share the pure Docker verification layer. Linux, hard quota, network isolation and a physical custody authority are required; missing adapters keep the backend closed.

After actual file verification and an HTTP health check of the original endpoint, the Runner records HELD and one immutable full proof in v8. The proof's preparation timestamp and custody revision stay fixed; current health and custody observations continue separately. Recovery queries the exact original request/profile/objects and stable proof. It never reacquires fences, initializes another database or dispatches an unsent successor from `inspect`. A missing successor remains unknown until a separately verified recovery/abort protocol is available. v8 upgrades preserve the original v2–v7 migration bodies and active service/action history.

This composition does not install itself at platform startup. Safe abort, accepted service ownership, publication and physical Linux/gVisor validation remain separate work. Actual local Worker/data/template HTTP tests explicitly identify controlled Docker and physical fence facts.

## Acceptance service abort

`RunnerAcceptanceAbortBackend` explicitly reads the exact immutable control decision under the original backend identity. A caller cannot supply a cleanup decision to it. Runner v9 preserves prior SQL bodies/hashes and active rows, extends the service state with REMOVED and retains a permanent preparation abort record even when no service has been reserved. That record blocks late reservation, execution grants, new health/HELD and new proof; already stored proofs and old action observations remain recoverable history.

STOP, CONTAINER_REMOVE and NETWORK_REMOVE each have a fixed decision/profile/service hash and original IDs with one durable dispatch. The Driver rechecks full original ACCEPTANCE identity, stops the original process, removes only a CREATED/EXITED original container without force/volumes, and removes only its empty network. Successful full-ID list queries prove absence; failed inspect, failed commands and timeouts do not. A lost grant or response is only queried, never redispatched. If CREATE may still be in flight and no exact ID is known, capacity remains held. CREATED is preserved as such, without inventing EXITED.

An actual unsent service may cancel. An observed container removal, REMOVED, capacity release and event commit atomically; the later network step remains recoverable after service capacity is released. An isolated original network can be removed without inventing a container. Dataset files, physical data fences, claim and proof stay intact. The control preparation remains ABORTING: data-fence release, old source restoration, project occupancy release and ABORTED still need separate verified handshakes. Linux, runsc, hard quota and network-isolation requirements remain closed by default and require physical validation.

## Local verification boundary

测试实际运行控制面／Runner SQLite Worker、并发事务、原动作 ACK 丢失、观察提交回滚、历史升级失败回滚、Worker 终止重开、真实 dataset 和 loopback HTTP；`ControlledContainerDriver` 显式提供 network／container 事实，不执行 Docker，健康服务也属于测试夹具。Docker 参数与观察核验针对明确输入验证，Windows 不执行 Linux CLI 路径；模板另执行实际 HTTP／SQLite／浏览器检查。不能把受控事实当成物理退出、真实镜像健康、cgroup 或宿主防火墙证据。

后续仍需真实 quota／network-isolation 适配器、可信平台装配、T5 必需归属握手，以及实际 Linux／gVisor 启动／退出／移除联调。不能复用短时作业 15 秒租约代替预览生命周期。普通用户／模型没有私有预留、容器注册或可信回执接口。完整开发子项 2.3 保持未勾选。
