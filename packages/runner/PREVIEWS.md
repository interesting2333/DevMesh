# Preview Runner integration

当前实现私有持久容量预留、统一准入、原容器动作日志，以及显式 `RunnerPreviewBackend`／`DockerPreviewDriver` 代码。Docker Driver 需要真实 Linux、可信硬配额和宿主网络隔离适配器，缺任一项保持关闭；这些适配器和真实容器联调尚未完成。独立预览到期 watchdog、容器清理及平台默认装配仍待实施，此文不是可运行容器服务的部署说明。HTTP 健康探针见 `preview-health.ts`，控制面生命周期恢复见 `@devmesh/platform-core` 的 `PreviewLifecycleManager`。

## Capacity and private store calls

Runner SQLite v4 在原 v2 workspace fence、v3 容量预留之后前向迁移，分别核实 v2／v3／v4 的原迁移 SHA，不重写旧作业／fence／预留／历史。升级失败回滚 DDL 和版本，核实失败原因后用相同新程序重试。旧程序不支持 v4，不能用旧二进制直接打开升级后的 store；回退时关闭新准入，保留并核实原对象，不手动降级数据库。

可信装配通过同一个 `RunnerStore` 调用；这些方法没有公共 HTTP／MCP 路由。`capacityConfigure({maximumJobs,cpu,memoryMiB})` 的数值必须来自 Runner 部署预算，已经扣除系统预留。`RunnerManager.start()` 固定同一预算；`claim` 与 `previewReserve` 都校验相同预算。同一 Worker 的预算不允许变动，需关闭／重开 Worker 后显式配置；降低预算不释放现存对象，只阻止超额新准入。

- `previewReserve({controllerId, request, requestHash, resourceLimits, capacity})` 绑定完整 `previewStartRequest`，校验 canonical SHA、原 runnerId 与固定 CPU／内存／PID／临时盘声明。相同 controller／operation 返回原预留；请求或资源变化拒绝。同一 Runner 上所有 controller 不能并占同一 preview／可写 dataset。
- `previewReservationDispatch` 持久地授予一次 Runner 内派发位。调用者只有明确收到 `dispatch=true` 才能继续；丢回执不等于允许重发。该派发位不替代控制面的原派发许可或最后授权检查。
- `previewReservationRecord` 使用 revision CAS 与准确观察时间记录可信后端事实。核实后的实例和首次 loopback 端口固定。UNKNOWN 保留已知身份和容量；只有准确原实例 EXITED 才释放已派发预留。
- `previewReservationCancel` 只取消从未派发的 RESERVED；不能以停止意图、超时、过期、查不到对象或失联作为已退出证据。取消幂等，不删除 dataset 或原预留。
- `previewReservationGet`、`previewReservationByOperation` 与 `previewReservationPage` 限定原 controller；分页只扫描未释放对象，每个恢复周期从 0 开始。`capacityUsage` 用于私有诊断，统计所有 controller 的未退出作业与未释放预览。

预留、派发与每次观察的不可变快照同事务保存。SQLite 串行 writer 在同一准入事务累计 slot／CPU／内存：作业 QUEUED 不占计算资源，其他非 EXITED 状态继续占用；预览 RESERVED／DISPATCHED／ACTIVE／UNKNOWN 均占用。停止阶段未证明原退出就仍占用。CPU／内存之外的 PID／临时盘字段仅固定为后续实际容器策略输入，本实现不冒充 cgroup 或磁盘配额。

## Durable original actions

`previewContainerPrepare` 固定原预留的镜像 repository、可信解析 dataset 目录、配额、原资源和确定性 network／container 名称。相同原 profile 幂等读取，变更拒绝；重启查询使用已保存 profile，不用新配置替换原对象。`previewContainerGet` 限定原 controller／requestHash。

`previewContainerActionBegin` 在任何外部副作用前事务持久化 `NETWORK_CREATE`／`CREATE`／`START`／`STOP` 的原完整请求、hash、operation、profile 和 `SENT`。每个动作只有一次 `dispatch=true`；ACK 丢失后不能补发。CREATE 需要已核实原 network，START／STOP 需要已核实原 container；STOP 绑定原启动 operation／hash／准确实例。`previewContainerActionObserve` 只追加一次准确对象事实，网络／容器首次绑定与动作观察同事务提交，不可替换或删除。

`RunnerPreviewBackend` 显式组合实际 dataset 后端、Runner store、路径解析及容器 Driver。控制面与 Runner 两级派发位都要求明确许可；每个外部变更还在异步检查结束后立即复核当前授权。重启或 UNKNOWN 只查询确定性原名称和固定 labels／profile／对象 ID，补记已存在的原事实；不继续尚未派发的下一动作。真实固定 loopback HTTP 探针通过才形成 HEALTHY；停止只核实原实例，EXITED 后释放容量并保留 dataset。CREATED 且从未启动不是 EXITED：当前停止仍返回未核实，继续占用，等待后续显式清理协议。

## Docker profile and required adapters

Driver 使用绝对 Docker 程序路径、Unix socket、固定 argv／有限环境、无 shell、有界输出与超时；不向容器传平台凭据。镜像检查区分 manifest digest 与 config ID，并逐项核实 repository／digest、OS／架构、原 config、层 diffID 顺序及源码／构建 labels。每次容器观察重新检查原 profile、镜像 config、资源、挂载、labels、网络与 loopback 端口，不收养或停止身份不符对象。

每份预览独占 internal bridge，关闭同网互通及 IPv6，单个端口只发布到 `127.0.0.1`；`PreviewNetworkIsolation.enforce/verify` 还必须实施并核实禁止访问宿主、控制面及其他网络，只保留宿主发起的发布端口流量。仅有 `--internal` 不算完成该隔离适配器。创建但尚未启动的容器允许原网络名称下未分配的 endpoint ID，HostConfig 仍必须绑定完整原 network ID；运行时必须核实真实 endpoint ID。

容器参数固定 runsc、UID/GID 10001、只读根、cap-drop ALL、no-new-privileges、私有 cgroup／IPC、CPU／内存／禁 swap／PID／文件句柄／临时盘限制、有界日志及无自动重启。可写挂载只针对原 dataset；同目录的 `operation.json`／`receipt.json`／`dataset.json` 另外覆盖只读文件挂载，保留准备原证据。`PreviewDatasetQuota.prepare/verify` 必须落实硬目录配额和专属 UID/GID 权限，不能用文件大小轮询替代硬配额。模板仅在显式 `APP_HOST=0.0.0.0` 时提供容器内监听，本地默认 loopback。

网络语义参考 [Docker bridge](https://docs.docker.com/engine/network/drivers/bridge/)／[端口发布](https://docs.docker.com/engine/network/port-publishing/)，资源参数参考 [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)；未启动 endpoint 的配置与运行分离参考 [Moby updateContainerNetworkSettings](https://github.com/moby/moby/blob/master/daemon/container_operations.go)。这些资料用于代码复核，不能替代目标版本的实际 Docker／gVisor 验证。

## Recovery and remaining integration

测试实际运行控制面／Runner SQLite Worker、并发事务、原动作 ACK 丢失、观察提交回滚、历史升级失败回滚、Worker 终止重开、真实 dataset 和 loopback HTTP；`ControlledContainerDriver` 显式提供 network／container 事实，不执行 Docker，健康服务也属于测试夹具。Docker 参数与观察核验针对明确输入验证，Windows 不执行 Linux CLI 路径；模板另执行实际 HTTP／SQLite／浏览器检查。不能把受控事实当成物理退出、真实镜像健康、cgroup 或宿主防火墙证据。

后续仍需独立 Runner 到期 watchdog（平台断连后也生效并保护已接受 Release）、原对象的显式清理／移除、真实 quota／network-isolation 适配器，以及可信平台装配与实际 Linux／gVisor 联调。不能复用短时作业 15 秒租约代替预览生命周期。普通用户／模型没有私有预留、容器注册或可信回执接口。完整开发子项 2.3 保持未勾选。
