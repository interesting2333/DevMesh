## Why

父工作包 P2-01。控制契约（PauseRun／ResumeRun／CancelRun、ControlProgress 事件）已存在，存储也只有 `setControlIntent` 的 pause／cancel 状态切换；真正的 resume、逐目标收尾、材料保存重试和 30 秒核实提示尚未成体系实现。G1 未通过，因此本变更只作为**提前的开发增量**：正式 P2-01 仍保持 `NOT_STARTED`，不伪造门槛。

## What Changes

- 完整控制状态机：pause／resume／cancel 三类显式命令，绑定控制 revision 与 run epoch；resume 必须提供恢复审查 hash，不能只靠一次确认。
- 复用现有两级 epoch（run／work）：暂停、取消与恢复推进 run epoch；新 attempt 只能在当前 gate／grant／epoch 下准入。
- 逐目标收尾记录：attempt、preparation、preview、Runner job 等目标分别记录 PENDING／STOPPING／SAVED／RELEASED／UNKNOWN；未知目标不允许把 run 标成 PAUSED／CANCELLED。
- 材料保存失败只重试对应目标；停止证据齐全后才释放相关资源占用。
- 30 秒核实提示：超过 30 秒仍未完成时通过 ControlProgress 事件给出“核对中、未解决项、最近检查时间”，不自动成功。
- API 与 UI 事件：受保护的 pause／resume／cancel 命令、控制状态查询和事件投影。
- 明确边界：物理 Runner／容器停止仍是真实后端能力；没有配置后端时保留 UNKNOWN，不用协议夹具冒充真实退出。

## Capabilities

### New Capabilities

- `run-control-lifecycle`: 暂停、恢复、取消的控制状态机、逐目标收尾、材料保存重试、核实提示与 API／UI 事件。

### Modified Capabilities

复用既有 Run 控制字段、outbox 与 ControlProgress 事件，不改变 A2A、接受、发布和工具准入语义。

## Impact

主要影响 `packages/storage-sqlite`（迁移与领域命令）、可能的 `packages/contracts` 控制投影、`packages/input-api`／`packages/platform-core` 的命令入口与收尾协调器，以及测试。正式 P2-01、G0～G4 和真实模型／OIDC／Linux 验收不因本变更自动通过。
