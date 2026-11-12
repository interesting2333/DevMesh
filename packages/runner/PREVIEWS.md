# Preview Runner integration

当前仅实现私有持久容量预留与统一准入。没有生产预览容器适配器、独立预览到期 watchdog 或平台默认装配；此文不是可运行容器服务的部署说明。HTTP 健康探针见 `preview-health.ts`，控制面生命周期恢复见 `@devmesh/platform-core` 的 `PreviewLifecycleManager`。

## Capacity and private store calls

Runner SQLite v3 在原 v2 workspace fence 之后前向迁移，核实 v2／v3 的原迁移 SHA，不重写旧作业／fence。升级失败保留原事务与数据库。旧程序不支持 v3，不能用旧二进制直接打开升级后的 store；回退时关闭新准入，保留并核实原对象，不手动降级数据库。

可信装配通过同一个 `RunnerStore` 调用；这些方法没有公共 HTTP／MCP 路由。`capacityConfigure({maximumJobs,cpu,memoryMiB})` 的数值必须来自 Runner 部署预算，已经扣除系统预留。`RunnerManager.start()` 固定同一预算；`claim` 与 `previewReserve` 都校验相同预算。同一 Worker 的预算不允许变动，需关闭／重开 Worker 后显式配置；降低预算不释放现存对象，只阻止超额新准入。

- `previewReserve({controllerId, request, requestHash, resourceLimits, capacity})` 绑定完整 `previewStartRequest`，校验 canonical SHA、原 runnerId 与固定 CPU／内存／PID／临时盘声明。相同 controller／operation 返回原预留；请求或资源变化拒绝。同一 Runner 上所有 controller 不能并占同一 preview／可写 dataset。
- `previewReservationDispatch` 持久地授予一次 Runner 内派发位。调用者只有明确收到 `dispatch=true` 才能继续；丢回执不等于允许重发。该派发位不替代控制面的原派发许可或最后授权检查。
- `previewReservationRecord` 使用 revision CAS 与准确观察时间记录可信后端事实。核实后的实例和首次 loopback 端口固定。UNKNOWN 保留已知身份和容量；只有准确原实例 EXITED 才释放已派发预留。
- `previewReservationCancel` 只取消从未派发的 RESERVED；不能以停止意图、超时、过期、查不到对象或失联作为已退出证据。取消幂等，不删除 dataset 或原预留。
- `previewReservationGet`、`previewReservationByOperation` 与 `previewReservationPage` 限定原 controller；分页只扫描未释放对象，每个恢复周期从 0 开始。`capacityUsage` 用于私有诊断，统计所有 controller 的未退出作业与未释放预览。

预留、派发与每次观察的不可变快照同事务保存。SQLite 串行 writer 在同一准入事务累计 slot／CPU／内存：作业 QUEUED 不占计算资源，其他非 EXITED 状态继续占用；预览 RESERVED／DISPATCHED／ACTIVE／UNKNOWN 均占用。停止阶段未证明原退出就仍占用。CPU／内存之外的 PID／临时盘字段仅固定为后续实际容器策略输入，本实现不冒充 cgroup 或磁盘配额。

## Remaining execution integration

后续可信容器适配器必须：核实控制面原许可／候选／Release 归属；在 create／start／stop 前保存原动作日志；把完整已核实 OCI manifest、config 和层映射到实际镜像；固定原容器 labels、挂载、loopback 端口和内部网络；施加 gVisor、cgroup 与真实 dataset 配额；独立于平台连接运行到期 watchdog，并保护已接受 Release。不能复用现有短时作业 15 秒租约来代替预览生命周期。

当前容量测试实际运行 Node SQLite Worker、并发事务、历史升级、关闭重开、定时到期和失败回滚。镜像／容器健康／退出采用显式测试事实，未执行真实容器或物理退出核实；没有可信实际后端时不得将这些私有回执直接暴露给普通用户或模型。
