## Why

父工作包 P0-08。Runtime 已有工具事务与原操作查询边界，Runner 已有独立作业登记，但尚没有真正经过官方 MCP Client／Server 的调用。需要补齐协议和首批实际后端，防止把直接函数调用标成 MCP，或因断线重放写操作。

## What Changes

- 新增官方 TypeScript SDK 的 Streamable HTTP Client／Server、独立服务身份、协商与工具 schema 快照。
- 新增授权快照的 repo 只读工具，以及经 RunnerClient 的 tests.start/get/stop/by-operation；只读工具不执行仓库脚本。
- 将工具连接映射为 RuntimeTool，冻结 allowlist、schema、服务端点；未知写操作只查询原 operation/job。
- 用户明确暂无模型、认证和 Docker/gVisor；完成可独立验证的协议／存储代码，实际容器测试保持未执行。

## Capabilities

### New Capabilities

- `durable-mcp-tools`: 真实 MCP 协议、主体／宿主校验、只读快照和长任务操作查询，不自动重放未知副作用。

### Modified Capabilities

无。

## Impact

新增 `packages/mcp-tools`、连接配置及测试；采用实际安装后固定的官方 SDK，与 Node 24／Zod 4 联调。依据 design/02 §6、design/04 §1–2／§4、P0-08 与 T04/T05。配置默认不启用；无目标 Runner 时不伪造测试通过。保持 P0-08 正式 NOT_STARTED，待前置验收完成后再评审整个工作包。
