## Purpose

为生成代码提供独立执行宿主，并让调用方区分受理、执行、停止请求和已核实退出。保证响应丢失及进程重启后能够查询原作业事实，避免重复执行未知写操作；环境缺失时保留明确的不可执行状态和待验收项。

## ADDED Requirements

### Requirement: Durable owner scoped job admission
Runner SHALL 在执行前持久登记调用主体、operationId、规范请求哈希和 jobId；同主体同键同请求返回同作业，不同请求拒绝。鉴权、宿主 permit、工作区、固定镜像、命令和容量策略 MUST 在准入时检查。

#### Scenario: Lost acceptance response
- **WHEN** 调用方未收到启动响应后查询原 operationId
- **THEN** 返回同主体的原 job 或明确不存在，不重复创建作业，其他主体不能查询该作业

#### Scenario: Invalid or unconfigured execution target
- **WHEN** 镜像／命令／工作区未授权、许可失效或执行 Provider 未配置
- **THEN** 明确拒绝执行，不在控制主机或普通宿主 Shell 运行生成代码

### Requirement: Bounded isolated execution
作业 SHALL 在固定镜像和受控 runtime 下执行，限制 CPU、内存、PID、时间、临时空间及网络；容器 MUST 不获得控制面密钥、Docker socket、项目接受分支和其他宿主的可写数据。

#### Scenario: Requested mount or command escape
- **WHEN** 请求试图提供任意 bind mount、宿主命令或超出 permit 的工作区
- **THEN** Runner 拒绝请求，容器创建数量保持不变

### Requirement: Lease and verified stop
Runner SHALL 校验续租的主体、宿主和控制代际，使用单调时钟管理当前租约，租约失效后请求容器级停止。停止请求本身 MUST 不被标记为已退出；仅在进程／容器事实可核实时登记 EXITED、退出码与停止证据。

#### Scenario: Stale renewal and unreachable runtime
- **WHEN** 旧代际续租到达，或停止后无法取得容器事实
- **THEN** 拒绝旧续租并保留待核实状态，不据此允许重跑未知作业

### Requirement: Recovery and durable materials
Runner SHALL 从本地登记与 runtime 的原容器标识恢复监控，保留日志游标、产物和停止证据；证据缺失时 MUST 保留 OUTCOME_UNKNOWN。必要材料取得持久归档 ACK 前 MUST 不自动清理工作区。

#### Scenario: Death between registration and response
- **WHEN** 管理进程在登记或创建容器后退出并重启
- **THEN** 恢复程序只核实原 job／容器，不使用新键重放启动；容器缺失或材料不完整时明确标记待核实
