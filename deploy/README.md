# DevMesh 本机部署指南（源码模式）

本文说明如何把 DevMesh 部署到另一台机器上，供单人本地使用。

> 当前版本是开发预览版：**只适用于本机单用户**，不要直接暴露到公网。正式工作包与 G0～G4 仍未完成，详见 [项目任务台账](../project/任务台账.md)。

## 1. 适用与不适用

适用：

- 在 Windows 10/11、Linux 或 macOS 上本地运行。
- 单人使用，数据保存在本机。
- 通过浏览器访问 `127.0.0.1`。

不适用：

- 公网或多用户共享部署。当前没有 OIDC、租户隔离和公网入口。
- 跨机器远程访问。Input API 只接受来自本机回环地址的请求。
- 生产环境。计划确认后的工作派发、Runner、MCP 等仍未完整接线。

## 2. 前置条件

| 依赖 | 要求 |
| --- | --- |
| Node.js | `>=24.9.0 <25`，推荐 24.13.1 |
| pnpm | 11.28.5（通过 corepack 固定） |
| Git | 必需；模板基线通过 `git show <commit>:templates/web-crud-v1/template.json` 解析，**克隆必须保留 `.git`** |
| 磁盘 | 至少 2 GB 可用（依赖、构建产物与数据） |
| 网络 | 能访问 npm registry 与模型 Endpoint |

不要用下载 ZIP 的方式部署：没有 `.git` 会导致启动时模板基线解析失败。

## 3. 克隆与安装

### Windows（PowerShell）

```powershell
git clone <仓库地址> DevMesh
cd DevMesh

node --version    # 确认 24.9～24.x
corepack enable
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
```

### Linux / macOS

```bash
git clone <仓库地址> DevMesh
cd DevMesh

node --version
corepack enable
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
```

如果 Node 版本不满足，请先用 nvm / fnm / 官方安装包切到 24.x。

## 4. 生成本机配置

在仓库根目录创建 `config/preview.local.json`（`*.local` 已被 Git 忽略）：

```json
{
  "host": "127.0.0.1",
  "port": 3210,
  "shutdownTimeoutMs": 5000,
  "storage": {
    "dataRoot": "D:/DevMesh-data/control",
    "runnerDataRoot": "D:/DevMesh-data/runner",
    "backupRoot": "D:/DevMesh-data/backups",
    "mode": "local",
    "initialize": false,
    "minimumFreeBytes": 67108864
  },
  "inputApi": {
    "enabled": true,
    "repositoryRoot": "D:/DevMesh",
    "commit": "<当前 HEAD 的 40 位提交>",
    "templatePath": "templates/web-crud-v1"
  }
}
```

获取提交：

```powershell
git rev-parse HEAD
```

Linux/macOS 把 `D:/...` 换成绝对路径，例如：

```json
"dataRoot": "/var/lib/devmesh/control",
"repositoryRoot": "/opt/DevMesh"
```

`commit` 必须是当前仓库真实存在的提交；`repositoryRoot` 必须指向包含 `.git` 的仓库根目录。

## 5. 初始化存储

首次启动前初始化一次（只需要一次）：

```powershell
node scripts/storage.mjs init --config config/preview.local.json
```

看到 `"status": "PASSED"` 即可。不要重复执行；重复初始化会因已有数据而失败。

## 6. 启动

```powershell
node scripts/dev-preview.mjs --config config/preview.local.json
```

启动日志出现：

```json
{"event":"preview-ready","url":"http://127.0.0.1:3210/api/v1/workbench/view"}
```

浏览器打开：

**http://127.0.0.1:3210/api/v1/workbench/view**

> `scripts/dev-preview.mjs` 会注入本机受信身份（`user_1`），并为已配置模型设置接入 Runtime。直接用 `apps/server/dist/main.mjs` 启动时没有身份解析器，工作台会返回 `IDENTITY_NOT_CONFIGURED`。

### 可选：本机 cookie 冲突时使用代理

如果浏览器里其他 `127.0.0.1` 应用留下了 cookie，Input API 会返回 `COOKIE_AUTH_NOT_CONFIGURED`。可以另开一个终端：

```powershell
node scripts/dev-preview-proxy.mjs
```

然后访问 **http://127.0.0.1:3211/**（代理会剥离 cookie 并把根路径重定向到工作台）。

## 7. 首次使用

1. 页面左侧“新建项目”，输入需求并提交。
2. 左下角 **更多 → 设置**，填写模型接入：
   - Provider：如 `deepseek`
   - Endpoint：模型服务地址（必须 https，或本机回环 http）
   - 模型 ID：按服务商允许的模型填写
   - API Key：只保存在本机 `<dataRoot>/settings/model-secret.json`（0600）
3. 点“保存设置”，再点“测试连接”。
4. 保存后需重启服务（见第 8 节），启动日志出现 `model-runtime-attached` 后模型才会参与理解与计划。

模型 Key 不会写入仓库或数据库，也不会回显。每台机器分别填写。

## 8. 重启

优先使用内置关闭入口，让 SQLite 正常释放写锁：

```powershell
curl.exe -X POST http://127.0.0.1:3212/shutdown
```

等待进程退出后，重新执行第 6 节启动命令。

直接强制结束进程可能留下存储锁，下一次启动会报 `STORAGE_LOCKED`；需要按日志中的 `recoveryToken` 在配置里恢复后再启动。

## 9. 升级

1. 关闭服务（第 8 节）。
2. 备份数据目录（至少复制 `dataRoot`）。
3. 拉取新代码并重建：

```powershell
git pull
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 build
```

4. 重新启动。数据库迁移会在启动时自动执行并先做备份。

如果上游修改了模板或提交，更新 `config/preview.local.json` 里的 `commit`。

## 10. 数据与备份

| 内容 | 位置 |
| --- | --- |
| SQLite、内容对象、设置 | `dataRoot`（如 `D:/DevMesh-data/control`） |
| 模型设置 | `<dataRoot>/settings/model.json`、`model-secret.json` |
| Runner 数据 | `runnerDataRoot` |
| 备份目录 | `backupRoot` |

停止服务后复制 `dataRoot` 即可做冷备份。当前备份文件未加密，注意本机访问权限。

## 11. 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| `IDENTITY_NOT_CONFIGURED` | 用了 `apps/server/dist/main.mjs`；改用 `scripts/dev-preview.mjs` |
| `REQUEST_HOST_INVALID` / `REQUEST_ORIGIN_INVALID` | 用了 `localhost` 或其他 Host；改用 `http://127.0.0.1:3210` |
| `COOKIE_AUTH_NOT_CONFIGURED` | 浏览器带入了其他本机应用的 cookie；用 `scripts/dev-preview-proxy.mjs` 从 3211 访问 |
| 根路径 `{"error":"NOT_FOUND"}` | 根路径没有路由；访问 `/api/v1/workbench/view` |
| `STORAGE_LOCKED` | 上一个进程未正常退出；使用日志中的 `recoveryToken` 写入配置后重启 |
| 模型测试失败 | 检查 Endpoint、模型 ID、Key；代理服务可能限制可用模型列表 |
| `MODEL_TIMEOUT` | 代理返回响应头很慢；调大 `connectTimeoutMs`（上限 120000） |
| 计划不可确认 | 校验项或必答问题未处理；看“任务”页的校验列表，不要绕过 |

## 12. 当前限制

- 单机单用户，无 OIDC、无公网身份、无租户隔离。
- Input API 强制回环访问，不能直接把 3210 暴露给其他机器。
- 计划确认后不会自动开始实现：预览尚未接 WorkflowScheduler / Runner。
- 没有应用级 Dockerfile；Docker 部署需要额外处理回环身份、`.git` 基线与 host 网络。
- 这是开发预览版，不能按生产 SLA 使用。

## 13. 一键脚本（尚未提供）

目前没有 `install.ps1` / `install.sh`。等价步骤就是第 3～6 节；后续可补：

1. 检查 Node/pnpm/git 版本。
2. 安装依赖并构建。
3. 自动生成配置与初始化存储。
4. 生成启动脚本 / 开机自启配置。

在这些脚本正式提供前，按本文手动执行即可完成部署。