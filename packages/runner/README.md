# Durable Runner（离线实现，执行默认关闭）

`@devmesh/runner` 是独立 Node.js/TypeScript 服务，作业登记使用自己的 SQLite Worker；不共享控制面数据库文件。`openRunnerStorage` 明确检查 Runner／控制面／备份目录互不重叠、布局标记、实例 ID、单写者锁及显式初始化。已有未知目录、缺失数据库、链接路径不会被自动收编或重建。

```text
runner/
  runner-layout.json
  registry/runner.sqlite[ -wal / -shm ]
  workspaces/<attemptId>/
  invocations/<invocationAttemptId>/
  job-outputs/<jobId>/<sha256>-container.log | <sha256>-output-<index>
  datasets/
```

`RunnerPolicy` 只接受固定 digest、固定命令类型、配置绑定的工作区和 `none` 网络策略。配置递归冻结。模型不能传 shell 字符串、任意 argv、挂载路径或镜像标签。工作区路径／宿主／资源许可均需匹配；真实生产准入还必须由调用方提供 `RunnerAuthority.verify`，回查已提交且仍有效的 grant、代际、控制状态与服务调用者。**把请求 JSON 中的 permit 和自己比较不能代替这次权威回查。** 当前控制面尚未组合远程 authority，Invocation 授权后续实现时单独接入。

作业先写入队列，再由事务原子占用容量，最后才调用容器 Provider。上限为全局 4 个、单 Run 2 个、单 Invocation 1 个，同一可写工作区只允许一个活跃 job；CPU／内存也进行总量准入。未知作业继续占用容量。同一 controller＋operationId＋原请求返回原 job；请求变化拒绝。重启不重放 create/start，只核实原容器。

许可最长 15 秒。运行中的 lease 与总超时用单调时钟执行，续租要求当前授权、原宿主与递增序号；重复续租不延长同一租约。停止先持久化意图，只有 Provider 查询到原容器 exited、PID 为 0 且有实际 exitCode，才登记 EXITED。未知／缺失／created 均不伪造退出或释放容量。退出前收集有界日志和输出，按内容哈希保留；本版本没有自动容器删除、输出删除或垃圾回收。材料失败会明确写 `RUNNER_MATERIALS_UNAVAILABLE`，不能宣称已归档。

HTTP 仅绑定明确的 loopback；异机部署由运维反向代理提供 TLS。除最小 health 外，所有接口必须通过服务 Bearer，凭据来自 credentialRef 解析器。它是内部服务身份，不是企业 OIDC。作业、查询和材料均按 controller 隔离：

| 方法 | 路径（前缀 `/runner/v1`） | 行为 |
| --- | --- | --- |
| POST | `/jobs` | 登记，202；失败或丢响应后按原操作查询 |
| GET | `/jobs/by-operation/:operationId` | 查询原操作 |
| GET | `/jobs/:jobId` | 查询持久状态 |
| POST | `/jobs/:jobId:stop` | 持久停止意图，202 不代表已退出 |
| POST | `/jobs/:jobId:renew` | 当前许可与序号续租 |
| GET | `/jobs/:jobId/logs?offset=0&limit=65536` | 已收集日志按字节续读，不重新执行 |
| GET | `/jobs/:jobId/outputs/:index` | 有权限的材料下载，返回 SHA-256 |
| POST | `/workspace-fences` | 持久取得工作区屏障；等待／活动／未知 Job 均拒绝 |
| GET | `/workspace-fences/by-operation/:operationId` | 查询原屏障，丢回复不重发 |
| GET | `/workspace-fences/active/:workspaceRef` | 查询本 controller 的活动屏障 |
| GET | `/workspace-fences/:fenceId` | 查询原持有者、路径、请求哈希与状态 |
| POST | `/workspace-fences/:fenceId:release` | 准确 holder token／请求哈希释放；不按超时释放 |

`RunnerClient` 使用有时限、有体积上限、禁止重定向的真实 HTTP；不会自动重试写请求。传输失败返回 unknown，调用方必须保留原 operationId 查询，不能换键重做。返回 Job 经过完整 schema 校验。

屏障要求显式 `verifyWorkspace` 回查当前 Host／Grant。原文件操作暂停后核实时，可选 `purpose=cleanup` 必须使用单独 `verifyWorkspaceCleanup`，核实原操作、owner、资源及当前成员；缺少则 503。该路径可检查过期原许可对应的材料，但不能通过正常 Job 准入、续租或新编辑。默认 purpose 按写准入处理，历史请求不补默认值、不改原哈希。v1→v2 升级保留历史 Job 并校验迁移指纹；不改写已发布 SQL。

`DockerBackend` 使用参数数组执行显式 Docker 二进制，只连接配置的本地 Unix socket；没有控制主机 shell 执行回退。create 与 start 分开，首次发送前与创建后再次核实许可。容器固定 runsc、非 root、只读根文件系统、无网络、全部 capability 移除，并限制 CPU／内存／PID／tmpfs／日志。工作区可写绑定需要调用方提供**真实硬配额** `WorkspaceQuota.enforce`；仅限制 `/tmp` 不能限制工作区磁盘。未配置 Linux、enabled、配额或 runsc 时执行拒绝。create/start 丢响应后按原容器名、runner/job/request 标签和容器 ID 核实；不自动删除容器。停止使用 SIGTERM 与 10 秒等待，然后 inspect，CLI 回包成功本身不算退出证明。行为依据 [Docker create](https://docs.docker.com/reference/cli/docker/container/create/)、[Docker stop](https://docs.docker.com/reference/cli/docker/container/stop/) 和 [gVisor Docker 配置](https://gvisor.dev/docs/user_guide/quick_start/docker/)。

命令行入口 `pnpm runner:start --config <本地配置> [--initialize]` 使用 `config/runner.example.json` 的结构，目前仅提供**执行关闭的管理服务**。生产启用须通过库组合真实 authority、工作区硬配额、受控命令与 DockerBackend；暂无目标资源时不提供“跳过检查即可启用”的开关。`image/Dockerfile` 是待构建描述，要求调用者传入已核实的 Node 24.13.1 基础镜像 digest，再把最终产物按实际 digest 加入 allowlist。仓库未填虚构 digest；离线依赖／浏览器缓存需在模板镜像构建时准备。

离线测试使用真实 HTTP、真实 SQLite Worker、真实管理子进程 SIGKILL 和明确标识的可控容器后端。它们验证协议与恢复逻辑，**不代表 runsc、后代进程、磁盘配额、密钥隔离或实际 E2E 通过**。这些专项保留在 OpenSpec 任务 3.2，资源具备后执行。当前日志在确认退出后收集，未收集时明确返回 409；运行期间分块持久化、跨节点归档 ACK、材料失败补采与清理互斥在 P2-07 接续实现。目录和文件材料暂时保留。
