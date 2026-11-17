## Context

PreparationRuntime 已存在，但预览没有配置 preparation，manifest 也没有 prepare 技能，因此输入只停在 UNDERSTANDING。真实模型经企业代理访问，响应头可能很晚才返回。

## Goals / Non-Goals

**Goals**
- 工作台输入触发 product 理解与 architect 计划，结果落库并显示。
- 保留既有计划校验，不用放宽校验来“让计划可确认”。

**Non-Goals**
- 不修复计划质量问题（缺 tester／集成输出）；这属于后续模型与计划 schema 调优。
- 不做多模型路由、真实 OIDC 或 G0～G4 验收。
- 不改变正式工作包状态。

## Decisions

1. **Prepare 技能加在既有角色端点**：manifest 角色唯一，不能新增同角色端点；给 product／architect 增加 `devmesh.prepare.product/architect`，endpoint revision 升到 2、manifest revision 升到 `builtin.v2`，重算 cardHash。
2. **Preparation 配置**：callerId `orchestrator`，product／architect 使用同一个 `deepseek` Provider；maxInputBytes 200000、maxOutputTokens 2048、bootstrapPaths 为空。
3. **超时**：Provider 连接超时上限 120s，requestTimeout 300s；企业代理会缓冲完整响应，30s 上限导致 `MODEL_TIMEOUT`。
4. **模型**：使用 `deepseek-v4-pro`（响应模型名与配置一致，约 21s）；MiniMax/glm 推理型在 2048 输出预算内只产生 reasoning、content 为空。
5. **校验不放宽**：计划确认继续被 REQUIRED_TEST_MISSING／INTEGRATION_OUTPUT_MISSING 阻止，这是正确行为。

## Risks / Trade-offs

- 120s 首字节上限增加了慢响应占用时间 → 仅本地预览，Runtime 仍受 token 预算与请求超时约束。
- 计划需要 tester／集成输出，模型当前未生成 → 计划暂不可确认；不伪造通过。