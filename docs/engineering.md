# 工程使用与验证

当前交付 Node HTTP／Express 5、Cordis 生命周期、[核心契约](../packages/contracts/README.md)、[SQLite Worker](../packages/storage-sqlite/README.md)、[本地内容／会话](../packages/blob-store/README.md) 和 [内部 A2A／Registry](../packages/a2a-adapter/README.md)。可选持久存储及 A2A 已组合进 HTTP 宿主，readiness 等待完整性核实、监听后 Card 自检与注册投影；各项模型、MCP、Runner 和产品验收状态以台账及实际证据为准。

各工作包实际结果和同提交两平台报告见 [P0-01 工程](../project/evidence/P0-01/验收记录.md)、[P0-02 契约](../project/evidence/P0-02/验收记录.md)、[P0-03 存储](../project/evidence/P0-03/验收记录.md)。

## 版本和目录

| 项目 | 固定值 |
| --- | --- |
| Node | 24.13.1；`.node-version`／`.nvmrc`；engines 沿用设计 `>=24.9.0 <25`，本次实际验证仅 24.13.1 |
| pnpm | 11.28.5；packageManager 与本地 devDependency 同时固定，避免嵌套脚本误用全局 11.22.0 |
| TypeScript／tsdown／tsx | 6.0.3／0.22.2／4.23.13 |
| Oxlint | 1.81.0；真实应用、脚本、管理工具和测试均在 lint 范围 |
| Express／类型 | 5.2.1／@types/express 5.0.6；@types/node 24.13.1 |
| 共享契约 | Zod 4.4.3；schema 推导 TypeScript 类型并生成 OpenAPI 3.1.0 |
| 框架闭包 | 五个 Cordis 受控源码包，详见 [来源说明](../vendor/README.md) |

`apps/server` 是组合根；`packages/platform-core` 管理配置、HTTP 插件和启动／释放；`vendor/` 为显式受控源码 workspace；`tests/foundation.test.mjs` 验证实际构建产物；`tools/openspec` 保持独立 npm 工具包，未加入应用 workspace。

## 安装、构建与启动

使用精确 Node 版本，在仓库根目录执行：

```powershell
corepack pnpm@11.28.5 install --frozen-lockfile
npm ci --prefix tools/openspec --ignore-scripts --no-audit --no-fund
corepack pnpm@11.28.5 build
corepack pnpm@11.28.5 typecheck
corepack pnpm@11.28.5 lint
corepack pnpm@11.28.5 test:smoke
corepack pnpm@11.28.5 test:contracts
corepack pnpm@11.28.5 test:storage
corepack pnpm@11.28.5 test:content
corepack pnpm@11.28.5 test:a2a
corepack pnpm@11.28.5 contracts:check
corepack pnpm@11.28.5 start
```

Corepack 只负责本次选定版本的启动，不需要修改全局 pnpm。安装后根 node_modules 中有精确 pnpm，应用脚本调用它。更换机器时从 Git 和锁文件重新安装，不复制其他 checkout 的 node_modules 或 vendor/lib。

首次 `build` 完成后可运行 `corepack pnpm@11.28.5 dev` 使用 tsx；这是当前单个服务的启动入口。库包变化后重新 build，后续开发期多包 watch 可另行增加。

默认地址 `http://127.0.0.1:3210`：`GET /healthz` 返回 HTTP 插件存活，`GET /readyz` 在已配置插件成功加载后返回 ready。启用 storage 时先核实文件／DB，失败不开 readiness；其他路径 404。这些响应不包含尚未实现能力的可用承诺。

## 配置和停止

```powershell
node apps/server/dist/main.mjs --config config/server.example.json
```

配置优先级：明确 `--config` 路径优先于 `DEVMESH_CONFIG`；具体字段以环境变量覆盖 JSON 文件，最后使用默认值。可用环境变量为 `DEVMESH_HOST`、`DEVMESH_PORT`、`DEVMESH_SHUTDOWN_TIMEOUT_MS`。示例见 [JSON](../config/server.example.json) 和 [.env.example](../.env.example)；服务直接读 process.env，不自动加载 `.env`。

host 当前仅允许 `127.0.0.1`／`::1`；port 为 0～65535，0 用于临时测试端口；shutdownTimeoutMs 为 100～30000，默认 5000。未知 JSON 字段、无效数值、无法读取文件、端口占用均导致非零退出，不输出 ready。可选 storage 字段及环境变量见内容存储说明，示例为 `config/server.storage.example.json`；首次先运行 storage:init，常规启动不新建空库。

交互终端使用 Ctrl+C；POSIX 支持 SIGTERM。服务通过 Cordis fiber disposer 关闭监听器和连接，期限到达会关闭残留连接；只有资源释放完成才输出 stopped。Node 子进程支持 IPC `{ "type": "shutdown" }`，用于 Windows 自动验证；父进程断连也触发收尾。Windows 的强制进程终止不能当作执行了 graceful shutdown。

持久 storage 可显式启用 [独立交付导出消费者](../packages/result-verifier/EXPORTS.md)，配置例见 [server.release-exports.example.json](../config/server.release-exports.example.json)。`releaseExports.enabled` 默认关闭；打开后按原创建者消费本地排队和租约过期任务，不依赖模型或 Runner，也不启用平台身份。普通 FAILED 只在用户显式 retry 后消费。停止时先关闭 Input API，再取消并等待导出，最后关闭 SQLite；90秒为打包协作取消期限，原两分钟租约用于硬退出后的恢复，不能把它当作外部调用已终止的证据。

## 同一提交的独立验证

### 显式启用计划调度

输入 API 启用后，可读取 `GET /api/v1/runs/:runId/plans`，通过 `?revision=N` 查询历史。确认使用 `POST /api/v1/runs/:runId/plans/:planRevision:confirm`，请求携带 `If-Match`、`Idempotency-Key`、当前 `requirementRevision` 和 `reviewHash`。必要问题、未处理输入、无效图、旧依据均阻止确认；暂停期间可保存确认但不派发。

程序化宿主可向 `startPlatform(config, options)` 传入 `scheduler: { callerId, planResources }`；要求同时启用 Runtime 和已配置的内部 A2A 服务身份。`planResources(candidate, signal)` 是受信任的只读配置查询：返回冻结角色、资源引用、Runner ID／并发容量／CPU／内存／超时上限、总预算和模板／检查版本；返回 `null` 时保留排队。CLI 默认不注入这个分配器，不会因保存计划而开始虚构的 Runner 执行。回调不得占用外部资源，具体资源登记由实际 Runner／Git 服务实施。

调度器持久保存项目轮询顺序，短事务内复核图、当前确认、容量、输入及前序验证；网络发送在事务外通过官方 A2A SDK 完成。发送前保存原身份，回复未知则核实原 Inbox／Task，保持原 Attempt 和槽位。A2A completed 仅进入 `VERIFYING`；后续验证服务提供真实证据后才允许依赖工作准入。内部 `recordVerifiedWork` 是验证服务边界，未暴露为用户绕过检查的 HTTP 接口。目标 Runner 和真实模型的产品闭环仍需对应环境验收。

### 执行固定提交回归

```powershell
corepack pnpm@11.28.5 verify:foundation --commit <完整40位提交SHA>
```

该命令要求当前 Git checkout 干净且 HEAD 与参数一致；也可在通过 `git archive <SHA>` 创建的独立源快照中使用。验证记录实际 OS／arch／Node、提交、应用锁文件哈希、源码指纹、每项退出码和原始输出；失败返回非零。默认产物为 `.artifacts/foundation/report.json` 及各项 txt 日志。

检查包括工具版本、vendor 来源、构建、类型、lint、真实 HTTP／CLI／关闭、契约反例、SQLite 迁移／约束／崩溃恢复、OpenAPI 一致性、台账、OpenSpec 和设计整合。Windows 跳过 POSIX SIGTERM，仍执行跨平台 IPC 停止和资源释放；Linux 另验 SIGTERM。契约变更先 build，再运行 `contracts:generate` 并提交生成文件。

CI 配置在 [.github/workflows/foundation.yml](../.github/workflows/foundation.yml)，使用 Windows／Linux matrix 和固定 Action commit，保留报告。它是待托管平台执行的流水线配置，本地 Linux WSL 验证和 GitHub Actions 实际运行分别记录。

## 兼容、回退和后续边界

P0-01 没有业务数据库或文件布局迁移；撤回工程提交使用 Git revert，保留设计和证据。示例配置不读取用户凭据，不创建正式数据根目录。

本轮验证环境为 Windows x64 和 Ubuntu 22.04／WSL2 x64；原生 optional peer 的其他目标平台未验证。构建工具链自身也包含目标平台预构建组件，锁文件固定具体版本。WSL 验证不能替代后续 Docker／gVisor 隔离、真实模型与 A2A/MCP 的 G0 证据。
