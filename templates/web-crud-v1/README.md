# web-crud-v1

可独立复制的任务看板：React 18.3.1／TypeScript 6.0.3／Vite 6.4.3，Express 5.2.1／Node 24 SQLite Worker。独立 pnpm 锁文件，无平台 workspace 依赖。版本方向参考 deepseek-harness 的 Web 应用；精确版本和实际安装结果保存在本目录。

## 构建和运行

需要 Node 24.13.1、pnpm 11.28.5。PowerShell 示例：

```powershell
corepack pnpm@11.28.5 install --frozen-lockfile
corepack pnpm@11.28.5 run typecheck
corepack pnpm@11.28.5 run build
$env:APP_DATA_ROOT = 'D:\devmesh-app-data\board-demo'
node dist/server/main.js init
node dist/server/main.js serve
```

`init` 仅对不存在或空的数据目录执行一次。后续直接 `serve`；缺失数据库、未知目录、不同模板标记、文件链接、第二写者和身份不一致均拒绝启动。默认 `127.0.0.1:4317`，`APP_PORT` 为 1–65535；`APP_READ_ONLY=true` 禁止业务写入。没有隐式开发数据库、平台凭据、通配 CORS 或公网监听。只允许 loopback Host 和同源 Origin，未来接入预览网关时须另行落实入口授权和代理边界。

Linux 收到 SIGTERM／SIGINT 后停止受理、排空 HTTP、关闭 Worker 并释放 dataset 锁；HTTP 最多等待 10 秒。Windows 本地 Ctrl+C 走 SIGINT；可信 Node 父进程也可通过 IPC 发送 `{ "type": "shutdown" }`。Windows `kill('SIGTERM')` 的强制终止不等同于优雅退出。真实 Runner 仍负责整组进程／容器的后代停止与事实确认。

## 数据结构和恢复

```text
APP_DATA_ROOT/
  dataset.json        # kind / template / layoutVersion / datasetId
  app.sqlite          # schema v1: dataset_identity / tasks / receipts
  app.sqlite-wal      # SQLite 按需创建
  app.sqlite-shm
  writer.lock         # pid / 随机所有者 token；正常关闭按 token 释放
```

业务数据与控制面、Runner 元数据和备份根目录分离。配置为专属 dataset 路径，并由 Runner 配额限制其占用；不挂载控制数据库。SQLite WAL／FULL、单 Worker 串行事务，写请求和幂等回执同事务提交。标题按 Unicode 码点最多 120，说明最多 4000，任务上限 1000，幂等回执上限 10000；到达上限明确拒绝，不能静默删除回执后重试。

异常退出遗留锁时停止自动启动，先确认原进程和所有引用该 dataset 的应用均已终止，再离线备份整个目录、核对 writer.lock 的 PID／token 和 datasetId 后由运维显式恢复。当前没有自动抢锁、迁移旧数据、归档或 GC。数据库缺失不自动重建。

API：`GET /api/tasks`、`POST /api/tasks`、`PUT /api/tasks/:id`、`DELETE /api/tasks/:id`。每次写入携带 `Idempotency-Key`（16–128 个字母／数字／下划线／连字符）；修改、删除还需 `If-Match: "revision"`。同键异请求、旧版本返回 409；输入未知字段拒绝。UI 通过 sessionStorage 保存尚未确认的写意图，响应丢失后手动重用原键核对，不自动以新键重复创建。该存储命名空间属于模板应用，与 DevMesh 工作台分离。

## 验证契约

```powershell
corepack pnpm@11.28.5 run test
corepack pnpm@11.28.5 exec playwright install chromium
corepack pnpm@11.28.5 run test:e2e
```

Vitest 使用真实临时 SQLite／Worker／HTTP、DOM 交互和实际 CLI 进程，另用明确标记的丢包／错误注入检查异常路径。覆盖分母固定为全部 `src/**/*.{ts,tsx}`，行／语句／函数至少 80%，分支至少 70%；包含入口和 Worker，不能为达到阈值移除未覆盖源码。Playwright 使用真实 Chromium、构建产物和独立临时 dataset，验证 CRUD、刷新、文本呈现、错误与恢复，输出 JSON 和桌面／移动截图。浏览器程序不随源码复制，目标环境需预置离线缓存。

若使用已安装的 Chrome／Edge，可设置 `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` 或 `msedge`；结果须记录实际浏览器版本，不记为随 Playwright 下载的固定浏览器。根工程 `pnpm run template:verify` 会执行独立锁文件安装、类型／前后端构建、覆盖和浏览器检查，校验覆盖文件分母与检查前后源码哈希，并输出原始日志和 JSON 报告。

`template.json` 定义固定 argv 和能力。`imageDigest=null`、`PENDING_TARGET_VALIDATION` 明确表示还没有实际镜像，不能直接作为 Runner 批准配置。模板独立安装／构建／测试可以先验证；目标 Linux/runsc 的实际镜像、离线依赖安装、配额、构建、完整进程停止和数据挂载仍需单独证据。第一方模板本地测试不授权在控制宿主机执行任意生成应用。
