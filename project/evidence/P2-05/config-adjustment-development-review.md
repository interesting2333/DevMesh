# P2-05 配置调整与 Registry 边界（1.1／1.2／2.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-config-adjustment`（父工作包 P2-05）
- 任务：1.1 配置调整持久化；1.2 API；2.1 Registry 边界核对
- 结论：配置调整的暂停前置、代际 CAS、应用后仍暂停已实现并通过测试；Registry 同步沿用既有实现，不重写；正式 P2-05 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0049 | `config_control` 单例 generation 与 `config_adjustments`（PROPOSED／CONFIRMED／REJECTED，base／applied generation，配置快照） |
| `proposeConfigAdjustment` | 仅 PAUSED Run；If-Match 资源版本；配置快照 ≤20000 字节 |
| `confirmConfigAdjustment` | 仅 PROPOSED；Run 仍 PAUSED；base generation 必须等于当前；成功后 generation+1，Run 保持 PAUSED |
| 读取 | `getConfigAdjustment`／`listConfigAdjustments`／`getConfigGeneration` |
| API | `POST /runs/{runId}/config-adjustments`、`POST /config-adjustments/{id}:confirm`、两个 GET 与 `GET /config/generation`；成员权限、If-Match、幂等键 |

## Registry 边界

既有 `tests/a2a-registry.test.mjs` 已覆盖：清单版本持久与幂等、历史回切拒绝、迟到健康只归档、projection revision CAS、导入回滚、draining 跨重启保持、健康过期阻断派发。本增量**未重写**这些逻辑，只新增配置调整记录与代际。

## 测试

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/config-adjustment.test.mjs tests/input-config-http.test.mjs
```

结果：2/2 通过；日志见 [config-adjustment.txt](./config-adjustment.txt)。

覆盖：活动 Run 拒绝、暂停后提案、两个同代际提案、第一个确认后 generation+1、旧代际确认被拒、Run 保持 PAUSED、重启后仍 PAUSED 且 generation 持久。

## 未完成与边界

- 配置正文与 Registry 端点逐字段映射、真实配置后端、T16／T17 产品验收未执行。
- 正式 P2-05／G1～G4 不变。
