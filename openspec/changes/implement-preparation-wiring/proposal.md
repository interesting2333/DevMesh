## Why

工作台输入只进入 `UNDERSTANDING`，不会触发模型：Runtime 缺少 `preparation` 配置，内置 manifest 也没有 `devmesh.prepare.*` 技能。用户要求把 preparation Agent 接上，让输入真正触发模型理解。

## What Changes

- 预览 manifest 为 product／architect 角色端点增加 `devmesh.prepare.<role>`，提升 endpoint revision 与 manifest revision，并重算 cardHash。
- Runtime 配置增加 `preparation`：callerId=orchestrator，product／architect 均指向已配置 Provider。
- Provider 连接超时上限从 30s 提升到 120s（代理会缓冲到完整响应，30s 内拿不到响应头）。
- 端到端验证：真实输入 → requirement revision 1（3 条需求、验收、问题）→ plan revision 1（works／reviewHash）；计划校验正确阻止缺少 tester／集成输出的计划确认。

## Capabilities

### New Capabilities

- `preparation-wiring`: 输入理解与计划生成的 preparation 运行时接线。

### Modified Capabilities

Runtime Provider 超时上限；预览 manifest 生成。

## Impact

影响 `packages/agent-runtime`、预览脚本与文档。正式 P0-06／P1-02、G0～G4 不变。