# P0-01 工程使用与验证

当前交付最小 Node HTTP／Express 5 服务和 Cordis 插件生命周期。后续领域契约、数据库、A2A/MCP、模型、Runner 和 UI 按对应工作包实现；本工程的就绪接口只描述基础 HTTP 插件。

本次实际结果和相同提交的两平台报告见 [P0-01 验证记录](../project/evidence/P0-01/验收记录.md)。

## 版本和目录

| 项目 | 固定值 |
| --- | --- |
| Node | 24.13.1；`.node-version`／`.nvmrc`；engines 沿用设计 `>=24.9.0 <25`，本次实际验证仅 24.13.1 |
| pnpm | 11.28.5；packageManager 与本地 devDependency 同时固定，避免嵌套脚本误用全局 11.22.0 |
| TypeScript／tsdown／tsx | 6.0.3／0.22.2／4.23.13 |
| Oxlint | 1.81.0；真实应用、脚本、管理工具和测试均在 lint 范围 |
| Express／类型 | 5.2.1／@types/express 5.0.6；@types/node 24.13.1 |
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
corepack pnpm@11.28.5 start
```

Corepack 只负责本次选定版本的启动，不需要修改全局 pnpm。安装后根 node_modules 中有精确 pnpm，应用脚本调用它。更换机器时从 Git 和锁文件重新安装，不复制其他 checkout 的 node_modules 或 vendor/lib。

首次 `build` 完成后可运行 `corepack pnpm@11.28.5 dev` 使用 tsx；这是当前单个服务的启动入口。库包变化后重新 build，后续开发期多包 watch 可另行增加。

默认地址 `http://127.0.0.1:3210`：`GET /healthz` 返回 HTTP 插件存活，`GET /readyz` 在插件成功加载后返回 ready。其他路径 404。这些响应不包含尚未实现能力的可用承诺。

## 配置和停止

```powershell
node apps/server/dist/main.mjs --config config/server.example.json
```

配置优先级：明确 `--config` 路径优先于 `DEVMESH_CONFIG`；具体字段以环境变量覆盖 JSON 文件，最后使用默认值。可用环境变量为 `DEVMESH_HOST`、`DEVMESH_PORT`、`DEVMESH_SHUTDOWN_TIMEOUT_MS`。示例见 [JSON](../config/server.example.json) 和 [.env.example](../.env.example)；服务直接读 process.env，不自动加载 `.env`。

host 当前仅允许 `127.0.0.1`／`::1`；port 为 0～65535，0 用于临时测试端口；shutdownTimeoutMs 为 100～30000，默认 5000。未知 JSON 字段、无效数值、无法读取文件、端口占用均导致非零退出，不输出 ready。

交互终端使用 Ctrl+C；POSIX 支持 SIGTERM。服务通过 Cordis fiber disposer 关闭监听器和连接，期限到达会关闭残留连接；只有资源释放完成才输出 stopped。Node 子进程支持 IPC `{ "type": "shutdown" }`，用于 Windows 自动验证；父进程断连也触发收尾。Windows 的强制进程终止不能当作执行了 graceful shutdown。

## 同一提交的独立验证

```powershell
corepack pnpm@11.28.5 verify:foundation --commit <完整40位提交SHA>
```

该命令要求当前 Git checkout 干净且 HEAD 与参数一致；也可在通过 `git archive <SHA>` 创建的独立源快照中使用。验证记录实际 OS／arch／Node、提交、应用锁文件哈希、源码指纹、每项退出码和原始输出；失败返回非零。默认产物为 `.artifacts/foundation/report.json` 及各项 txt 日志。

检查包括工具版本、vendor 来源、源码构建、类型、lint、真实 HTTP／CLI／关闭测试、项目台账、OpenSpec 严格校验和设计整合一致性。Windows 明确跳过 POSIX SIGTERM 测试，仍执行跨平台 IPC 停止和资源释放；Linux 另行验证 SIGTERM。

CI 配置在 [.github/workflows/foundation.yml](../.github/workflows/foundation.yml)，使用 Windows／Linux matrix 和固定 Action commit，保留报告。它是待托管平台执行的流水线配置，本地 Linux WSL 验证和 GitHub Actions 实际运行分别记录。

## 兼容、回退和后续边界

P0-01 没有业务数据库或文件布局迁移；撤回工程提交使用 Git revert，保留设计和证据。示例配置不读取用户凭据，不创建正式数据根目录。

本轮验证环境为 Windows x64 和 Ubuntu 22.04／WSL2 x64；原生 optional peer 的其他目标平台未验证。构建工具链自身也包含目标平台预构建组件，锁文件固定具体版本。WSL 验证不能替代后续 Docker／gVisor 隔离、真实模型与 A2A/MCP 的 G0 证据。
