# DevMesh

DevMesh 是一个以 A2A 协作、MCP 工具调用和独立 Runner 为基础的多 Agent 研发平台，提供需求录入、理解与计划、协作和交付的工作台。

**想先在本机运行：按下面 1～4 步操作，再打开工作台。** 当前是本机单用户开发预览版；工作台可在不配置模型时启动，模型参与理解与计划需另行配置。计划确认后的自动实现尚未在预览入口接通，完整进度见 [任务台账](./project/任务台账.md)。

## 1. 准备环境、拉取代码

| 工具 | 版本 / 要求 |
| --- | --- |
| Node.js | 推荐 **24.13.1**，支持范围 `>=24.9.0 <25`，见 [.node-version](./.node-version) |
| pnpm | **11.28.5**，下文通过 Corepack 调用固定版本 |
| Git | 必需；启动时会读取 Git 中的模板基线，因此请用 `git clone`，保留 `.git` |

```powershell
git clone https://github.com/interesting2333/DevMesh.git
cd DevMesh
node --version
corepack --version
```

如果提示找不到 `corepack`，先执行 `npm install --global corepack`。下文直接调用 `corepack pnpm@11.28.5`，无需切换全局 pnpm 版本。

**后续命令都在仓库根目录执行。** 启动本机工作台暂不需要 Python、Docker / gVisor 或企业认证；首次安装需要联网下载依赖。

## 2. 安装依赖、构建

```powershell
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
```

等两条命令成功后再继续。构建会生成各包的 `dist/`，预览入口依赖这些产物。

## 3. 生成本机配置、初始化存储（仅首次）

以下命令自动填写仓库绝对路径和当前 Git 提交，生成 `config/preview.local`。**已有配置时跳过生成步骤**；脚本不会覆盖已有文件。

### Windows：PowerShell

整段复制到 PowerShell 执行（包括开头 `@'` 和结尾 `'@ | node`）：

```powershell
@'
const { mkdirSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const config = {
  host: '127.0.0.1',
  port: 3210,
  shutdownTimeoutMs: 5000,
  storage: {
    dataRoot: '../.devmesh-data/control',
    runnerDataRoot: '../.devmesh-runner',
    backupRoot: '../.devmesh-backups',
    mode: 'local',
    initialize: false,
    minimumFreeBytes: 67108864
  },
  inputApi: {
    enabled: true,
    repositoryRoot: process.cwd(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    templatePath: 'templates/web-crud-v1'
  }
};
mkdirSync('config', { recursive: true });
writeFileSync('config/preview.local', JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
'@ | node

node scripts/storage.mjs init --config config/preview.local
```

<details>
<summary>Linux / macOS：Bash / Zsh 等价命令</summary>

```bash
node <<'NODE'
const { mkdirSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const config = {
  host: '127.0.0.1',
  port: 3210,
  shutdownTimeoutMs: 5000,
  storage: {
    dataRoot: '../.devmesh-data/control',
    runnerDataRoot: '../.devmesh-runner',
    backupRoot: '../.devmesh-backups',
    mode: 'local',
    initialize: false,
    minimumFreeBytes: 67108864
  },
  inputApi: {
    enabled: true,
    repositoryRoot: process.cwd(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    templatePath: 'templates/web-crud-v1'
  }
};
mkdirSync('config', { recursive: true });
writeFileSync('config/preview.local', JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
NODE

node scripts/storage.mjs init --config config/preview.local
```

</details>

初始化输出包含 `"status": "PASSED"` 后即可启动。**初始化只对新的数据目录执行一次，日常启动和重启不需要重复执行。**

配置文件内容是 JSON，使用 `.local` 后缀以匹配仓库已有的 Git 忽略规则。存储相对路径以配置文件所在目录解析，上面的配置会将数据放在仓库根目录下的以下位置：

| 路径 | 用途 |
| --- | --- |
| `config/preview.local` | 本机启动配置 |
| `.devmesh-data/control/` | SQLite、正文、附件、会话及模型设置 |
| `.devmesh-runner/` | Runner 数据目录预留 |
| `.devmesh-backups/` | 备份目录 |

这些路径均已被 Git 忽略。需要把数据放到其他磁盘时，在初始化前修改配置中的三个存储路径，保持目录彼此独立；目录要求见 [内容存储说明](./packages/blob-store/README.md)。

## 4. 启动并打开工作台

```powershell
node scripts/dev-preview.mjs --config config/preview.local
```

保持终端运行，看到 `preview-ready` 日志后，在浏览器打开：

**[http://127.0.0.1:3210/api/v1/workbench/view](http://127.0.0.1:3210/api/v1/workbench/view)**

首次可以从左侧“新建项目”录入需求。没有模型配置时，可以使用工作台和保存需求；要生成模型理解与计划，请继续下一节。

本地工作台需要使用上面的 `dev-preview.mjs` 入口，它会注入本机受信身份。`pnpm start` / `pnpm dev` 用于基础服务开发，没有配置工作台身份，直接访问工作台会返回 `IDENTITY_NOT_CONFIGURED`。

## 配置模型（需要模型参与时）

1. 打开左下角 **更多 → 设置**。
2. 填写 Provider、Endpoint 和 API Key。Endpoint 使用 HTTPS，或本机回环 HTTP。
3. 点击“获取模型列表”，从“模型”下拉框选择；也可选择“手动输入模型 ID”。已有接入打开设置时会自动获取列表，支持刷新；获取失败仍可手动填写。
4. 保存设置，点击“测试连接”（测试已保存的接入信息）。
5. 按下一节停止并重新启动服务；看到 `model-runtime-attached` 日志后，模型运行时已接入。

API Key 保存在本机 `.devmesh-data/control/settings/model-secret.json`，不会写入 Git 或回显到页面。模型服务需要单独准备；没有 Key 也可以先完成安装和工作台启动。

## 日常启动、停止与更新

**以后每次启动只需：**

```powershell
cd DevMesh
node scripts/dev-preview.mjs --config config/preview.local
```

**停止：** 在启动终端按 `Ctrl+C`。也可以在另一个 PowerShell 终端执行：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3212/shutdown
```

Linux / macOS 对应命令为 `curl -X POST http://127.0.0.1:3212/shutdown`。等待进程退出后再重启，确保存储写锁正常释放。

**更新代码：** 先停止服务并备份数据目录，再执行：

```powershell
git pull
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
git rev-parse HEAD
```

将新的提交 SHA 更新到 `config/preview.local` 的 `inputApi.commit`，然后按日常启动命令运行。保留已有配置和数据，不需要重新初始化存储。更多备份、恢复与迁移细节见 [本机部署指南](./deploy/README.md)。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| Node 版本不符合要求 | 切换到 24.13.1；不要使用 Node 20 / 22 / 25 |
| 找不到 `corepack` | 执行 `npm install --global corepack`，再重试 |
| 找不到 `dist/*.mjs` | 先完成依赖安装和 `corepack pnpm@11.28.5 build` |
| 生成配置时提示 `EEXIST` | 已有 `config/preview.local`；保留它，跳过生成步骤 |
| `IDENTITY_NOT_CONFIGURED` | 改用本文的 `scripts/dev-preview.mjs` 启动入口 |
| 根路径显示 `NOT_FOUND` | 打开完整路径 `/api/v1/workbench/view` |
| `REQUEST_HOST_INVALID` / `REQUEST_ORIGIN_INVALID` | 使用 `127.0.0.1`，按启动日志中的地址访问 |
| `COOKIE_AUTH_NOT_CONFIGURED` | 另开终端执行 `node scripts/dev-preview-proxy.mjs`，访问 `http://127.0.0.1:3211/` |
| `EADDRINUSE` | 3210 或预览关闭端口 3212 已被占用，先检查是否有上次启动的服务 |
| `STORAGE_LOCKED` | 检查旧进程是否仍在运行；确认已退出后按日志中的恢复令牌处理，详见部署指南 |
| 模型设置保存后没有生效 | 测试连接后重启服务，确认出现 `model-runtime-attached` 日志 |

## 开发与项目管理

只运行工作台时，上面的步骤已经足够。参与开发时，可按需执行：

```powershell
corepack pnpm@11.28.5 typecheck
corepack pnpm@11.28.5 lint
corepack pnpm@11.28.5 test:smoke
```

OpenSpec 是独立的管理工具，不参与应用依赖安装。需要查看工作包、维护变更或执行文档检查时，再安装管理工具：

```powershell
npm ci --prefix tools/openspec
node project/manage.mjs status
node project/manage.mjs next
node project/openspec.mjs list
```

管理记录提交前检查：

```powershell
node project/manage.mjs check
node project/openspec.mjs validate --all --strict --no-interactive
node design/生成完整方案.mjs --check
```

工作包状态以 `project/tasks.json` 为准，OpenSpec `tasks.md` 保存变更内部步骤；具体流程见 [项目管理说明](./project/README.md)。构建、配置、测试与 CI 详见 [工程说明](./docs/engineering.md)。

## 文档导航

| 目的 | 入口 |
| --- | --- |
| 部署、升级、数据备份与当前限制 | [本机部署指南](./deploy/README.md) |
| 查看进度、依赖和下一项工作 | [项目任务台账](./project/任务台账.md) |
| 产品目标和验收范围 | [PRD V10.0](./DevMesh_PRD_V10.0.md)、[验收场景 V10.0](./DevMesh_产品验收场景_V10.0.md) |
| 技术方案、选型与实施步骤 | [技术设计 V1.1](./DevMesh_技术设计方案_V1.1.md)、[实施文档 V1.0](./DevMesh_实施文档_V1.0.md) |
| 核心 schema、OpenAPI 和接口契约 | [contracts](./packages/contracts/README.md) |
| 数据库、正文、附件和会话存储 | [SQLite](./packages/storage-sqlite/README.md)、[内容存储](./packages/blob-store/README.md) |
| Agent 注册与 A2A 发现 | [内部 A2A](./packages/a2a-adapter/README.md)、[公共协议原型](./packages/a2a-adapter/PUBLIC-PROTOTYPE.md) |
| 模型、工具与执行环境 | [Runtime](./packages/agent-runtime/README.md)、[MCP](./packages/mcp-tools/README.md)、[Runner](./packages/runner/README.md) |
| 模板与交付导出 | [CRUD 模板](./templates/web-crud-v1/README.md)、[交付包](./packages/result-verifier/EXPORTS.md) |
| 全部文档与原型索引 | [交付说明](./交付说明.md) |
