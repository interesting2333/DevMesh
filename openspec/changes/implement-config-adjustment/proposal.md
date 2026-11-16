## Why

父工作包 P2-05。Registry 侧已有持久清单版本、projection CAS、停用／退役、迟到健康归档和旧清单回切拒绝（`a2a-registry` 测试覆盖）。缺少的是**配置调整**的暂停／分析／确认流程：目前没有配置调整记录、版本 CAS，也没有“应用后仍暂停”的可验证状态。G1 未通过，本变更只作提前开发增量。

## What Changes

- 新增配置控制代际与配置调整记录（PROPOSED／CONFIRMED／REJECTED）。
- `proposeConfigAdjustment`：只允许 PAUSED 的 Run；记录 base generation 与配置正文。
- `confirmConfigAdjustment`：要求 Run 仍为 PAUSED、base generation 仍为当前值；成功后 generation 递增，**Run 保持 PAUSED**，不会因应用配置自动恢复。
- 旧 generation 的确认、重复确认、活动 Run 上的调整一律拒绝；同键幂等。
- Registry 同步本身沿用现有 manifest／projection 机制，不在本增量重写；停用／回退规则保持既有实现并单独记录。

## Capabilities

### New Capabilities

- `config-adjustment`: 配置调整记录、代际 CAS 与暂停保持。

### Modified Capabilities

复用既有 Run 控制与 Registry 清单，不改变 A2A 路由或接受语义。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API、测试与文档。正式 P2-05、G0～G4 不变。
