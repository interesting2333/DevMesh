## Context

依据 D4 §1～2、§9～10 与 D5 §7。控制面在 Windows 可运行，Runner 管理服务部署 Linux；用户明确暂无 Docker/gVisor，先完成实现与离线验证。P0-06 的真实模型验收仍待资源，本工作包的提前代码不代表前置验收或 G0 已通过。

## Goals / Non-Goals

提供与控制进程隔离的作业 API、本地权威登记和严格执行 Provider。当前不凭空填写镜像 digest、不暴露未认证公网端口、不以宿主 Shell 或协议夹具代替 gVisor 实测。

## Decisions

1. 独立 TypeScript/Node 包与启动入口，SQLite 单 Worker 管理 Runner 本地状态；不复用控制数据库的 Run/Attempt 外键，以受验证的判别联合宿主标识登记。数据根按 D5 使用 `registry/runner.sqlite`、`workspaces/<attemptId>`、`invocations/<invocationAttemptId>`、`job-outputs/<jobId>`。
2. 受认证 HTTP API 支持 start/get/by-operation/stop/renew/logs；主体来自认证层，不能由请求 JSON 自报。服务凭据只存引用，默认 loopback；共享拓扑必须配置 TLS 和服务身份。控制端客户端限定 URL、超时、正文大小和不跟随重定向；超时返回未知，只查询原 operation。
3. 工作区和命令由管理配置登记。请求只提供 workspaceRef 与受控 commandSpec，镜像必须匹配允许的 digest。工作区解析使用 Runner 根下规范路径及链接检查；工作流／Invocation 的 permit 只能获取对应资源。控制授权接口或显式注入 authority 必须复查真实 grant，不能只相信调用方 permit JSON。
4. 作业规范请求哈希与 owner+operation 的唯一约束先提交，再对 Docker 发出创建／启动。按资源余额和全局上限 4 准入，每宿主上限与控制许可同时约束；持久状态区分 QUEUED、STARTING、RUNNING、STOPPING、EXITED、OUTCOME_UNKNOWN。网络、Docker、文件 I/O 不进入 DB 事务。
5. Docker Provider 只允许 Linux + `runsc`，通过参数数组调用 Docker CLI，不拼接 Shell、不使用自动 `--rm`。标签包含 runnerId/jobId/operationId，可查询同一容器；非 root、read-only、drop capabilities、no-new-privileges、PID／CPU／内存限制、专属 tmpfs、默认无网络，禁止挂 Docker socket 和控制数据根。软件源代理策略由显式批准配置定义，不能由模型提供。
6. 控制方每 5 秒续租，Runner 以单调时钟检查 15 秒续租窗口；续租不能扩展原宿主资源或绕过当前 grant／epoch。超时或停止请求先登记 STOPPING，TERM 宽限 10 秒，再 KILL，随后 inspect 核实实际退出；通信失败保留未知。管理重启按原标签查询，不重新执行 create/start。
7. 日志与输出保留在 job-outputs，查询使用 offset 和有界正文；只有实际退出记录 exitCode。首版不自动清理，后续 P2-07 提供归档 ACK 和 GC 联动。固定镜像构建描述不等于镜像已构建，digest 与真实隔离／子进程停止证据在实际环境验收后登记。

## Risks / Trade-offs

- Docker 创建后响应丢失 → 原名称与标签查询，禁止换 operation 自动重启。
- 授权端不可达或续租失联 → 停止新准入，终止原作业并核实，不宣称即时消除副作用。
- 容器丢失、日志截断或磁盘不足 → 保留未知／材料不完整，不假报保存或停止成功。
- 暂无目标 runtime → 默认禁用 Provider，协议与状态机使用明确标注的夹具，真实隔离和停止专项单列待验收。

## Migration Plan

新增独立数据布局和 schema 版本，显式初始化且不接管未知已有数据库。部署先验证路径分离、身份、受控镜像与 runsc，再开放接收；升级先关闭准入并保存登记与材料备份。回退保留原数据库与容器，不允许旧版本跳过未知 schema 或自动重放遗留作业。
