# README 本机快速开始核验

日期：2026-11-17。执行与复核：Codex（同一 Agent）。环境：Windows，Node v24.13.1，使用当前 checkout 的既有依赖和构建产物。

## 文档步骤

| 检查 | 实际结果 |
| --- | --- |
| PowerShell 配置生成 | 从 README 提取原样 here-string，在临时 Git 仓库中通过 Windows PowerShell 管道交给 Node 执行成功 |
| 路径和模板提交 | 生成值与实际 cwd / `git rev-parse HEAD` 一致，JSON 可解析 |
| 已有配置保护 | 第二次生成返回 EEXIST，原配置内容未变 |
| Bash / Zsh 示例 | JS 主体与已执行 PowerShell 示例逐字一致；未在 Linux / macOS shell 执行 |
| Git 忽略 | `git check-ignore` 确认配置和三个运行数据路径均被忽略 |
| 存储初始化 | 原 `scripts/storage.mjs init --config ...`，返回 PASSED |
| 工作台 HTTP | 用预览入口相同的 `startPlatform` 和本机受信身份启动，工作台返回 HTTP 200 |
| 正常关闭与存储复查 | `platform.stop()` 完成后执行原 storage verify，返回 PASSED |
| 本地 Markdown 链接 | README / 部署指南的 25 个本地文件链接目标均存在 |

验证使用临时 Git 模板仓库和独立存储，结束后清理。HTTP 使用临时端口；原预览 CLI 固定关闭端口 3212 已被本机已有进程占用，端口预检返回 EADDRINUSE，因此未重复启动该 CLI，也未停止已有进程。改以相同宿主 / 身份验证配置和页面。未重新执行依赖下载、构建或声称新机器干净安装通过。

## 仓库一致性

核验命令：

```text
node project/manage.mjs render
node project/manage.mjs check
node project/openspec.mjs validate --all --strict --no-interactive
node design/生成完整方案.mjs --check
git diff --check
```

P4-03 仅关联本次文档准备增量，正式状态保持 NOT_STARTED；G0～G4 维持原状态。

实际结果：台账检查通过（36 个工作包、5 个门槛）；OpenSpec 全量严格校验 35 项通过、0 失败；技术设计整合一致；`git diff --check` 通过。复核 README 操作顺序、部署指南配置文件名和父工作包关联一致，本次文档任务 3/3 完成。
