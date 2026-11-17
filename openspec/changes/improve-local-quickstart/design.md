## Context

本机工作台入口为 `scripts/dev-preview.mjs`，它注入受信本机身份；基础 `start` / `dev` 入口不能替代。配置要求仓库绝对路径和真实 Git 提交，存储初始化仅首次执行。

## Decisions

- README 按实际操作顺序排列，直接给出可复制命令。
- 使用工程已有 Node / pnpm 版本，将应用依赖和独立 OpenSpec 工具安装分开。
- 通过标准输入执行 Node 配置生成片段，自动获取 cwd / HEAD，避免手工填写 Windows 路径和 PowerShell UTF-8 BOM 问题。
- 独占写入配置，防止覆盖；沿用被忽略且相互独立的本机存储目录。
- 部署指南同步到 `config/preview.local`，匹配现有 `*.local` 忽略规则。
- 明确无需模型即可打开工作台，以及模型、调度和 Runner 的实际边界。

## Validation

核对两个 shell 示例中的 JS 内容一致、配置生成与已有文件保护、真实存储初始化及本机预览 HTTP 请求、Markdown 本地链接，以及台账 / OpenSpec / 设计整合检查。运行数据仅放临时目录，不纳入 Git。无应用源码改动，不重复执行整套应用测试。
