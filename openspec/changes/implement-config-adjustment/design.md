## Context

P2-05 要求配置调整暂停／分析／确认、完整 Registry 同步与停用／回退规则。Registry 部分已实现并有测试；配置调整部分缺失。G1 未通过，因此先实现可离线验证的配置调整核心。

## Goals / Non-Goals

**Goals**
- 配置调整有持久记录与代际 CAS。
- 只有 PAUSED 的 Run 可以提出调整；应用后仍暂停。
- 旧代际确认、重复确认与活动 Run 上的调整被拒绝。
- 同幂等键返回原结果。

**Non-Goals**
- 不重写 Registry manifest／projection 同步（已存在）。
- 不实现配置回退到旧清单（明确拒绝，不伪造回退）。
- 不接入真实模型或外部身份。

## Decisions

1. **配置代际**：新增单例 `config_control.generation`；每次成功确认递增。
2. **暂停前置**：`proposeConfigAdjustment` 要求 Run `control_gate='PAUSED'`；活动 Run 返回 `CONFIG_REQUIRES_PAUSED`。
3. **代际 CAS**：调整记录 `base_generation`；确认时要求等于当前 generation，否则 `CONFIG_BASIS_SUPERSEDED`。
4. **应用后仍暂停**：确认只推进配置代际与记录状态，不改 `control_gate`；重启后 Run 仍为 PAUSED。
5. **回退拒绝**：没有旧清单应用路径；试图用旧代际确认直接被 CAS 拒绝，不提供静默回切。
6. **幂等**：提案与确认均为 operation；同键同请求返回原回执。

## Risks / Trade-offs

- 配置正文未与 Registry 端点逐字段绑定 → 本增量只记录配置快照与代际，端点同步仍用现有 manifest 流程。
- 没有真实配置后端 → 只验证持久状态与 CAS，不宣称运行中的服务已应用配置。

## Migration Plan

新增向前迁移 `config_control` 与 `config_adjustments`；旧库升级保留数据，失败回滚。

## Open Questions

- 配置正文与 Registry 清单的逐字段映射待后续 P2-05 任务确定。
