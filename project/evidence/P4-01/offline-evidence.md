# P4-01 离线验收证据包（2026-11-16）

- 父工作包：P4-01 全量产品与技术验收
- 状态：正式 P4-01 仍 `NOT_STARTED`
- 结论：**不是产品验收**；仅为当前候选构建的离线回归证据，用于说明哪些自动化套件通过、哪些仍需真实资源与人工评审。

## 本轮执行

| 套件 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| 验收相关自动化 | `corepack pnpm@11.28.5 test:acceptance` | **321/321 通过**（约 17.9 分钟） | [acceptance.tap](./acceptance.tap) |
| 验证／质量相关自动化 | `corepack pnpm@11.28.5 test:verification` | **187/187 通过**（约 5.1 分钟） | [verification.tap](./verification.tap) |
| MCP | `corepack pnpm@11.28.5 test:mcp` | **35/35 通过**（约 1.9 分钟） | [mcp.tap](./mcp.tap) |
| 输入 API | `corepack pnpm@11.28.5 test:input` | **37/37 通过**（约 1.5 分钟） | [input.tap](./input.tap) |
| 工作台事件 | `corepack pnpm@11.28.5 test:events` | **13/13 通过**（约 37 秒） | [events.tap](./events.tap) |

## 未完成的尝试

`corepack pnpm@11.28.5 test:runner` 在本 Windows 主机启动后超过 35 分钟未产出汇总，已终止；[runner.tap](./runner.tap) 只是部分日志，**不计为通过**。此前 P0-07 的 WSL2 Linux 定向 runner 证据仍以对应记录为准，不能替代本套件。

之前的汇总回归见 [2026-11-16-offline-consolidation.md](../2026-11-16-offline-consolidation.md)：后端 63/63、workbench-live 8/8、OpenSpec 32/32。

## 未执行

- 真实 DeepSeek 模型与真实 Agent 调用。
- 企业 OIDC／真实身份。
- Linux Runner、Docker／gVisor／runsc 目标环境。
- 五条完整产品路径、89 个验收场景的人工签署。
- G0～G4 任一阶段门槛评审。

## 结论

以上自动化通过只能证明对应套件在当前离线环境通过，不能替代 P4-01 的产品验收，也不能据此把任何门槛标为通过。正式记录以 `project/tasks.json` 与评审记录为准。