# Tasks

- [x] 1.1 生成预览 manifest：为 product／architect 增加 prepare 技能，提升 endpoint／manifest revision 并重算 cardHash。
- [x] 1.2 配置 Runtime preparation 与 Provider 超时上限；启动日志出现 `model-runtime-attached`。
- [x] 1.3 端到端验证：真实输入产生 requirement revision 与 plan revision，并确认计划校验仍阻止不完整计划。
- [x] 1.4 保存证据，同步设计与实施文档、基线、OpenSpec 与 P1-02／P0-06 台账。
- [x] 1.5 调优 architect Prompt 并增加 `completeArchitectDraft` 结构补全；验证 `issues=[]`、`canConfirm=true`、计划确认 202。

## 备注

计划质量（缺 tester／集成输出）与三组真实模型样本不在本次增量内。

2026-11-17：完成1.1～1.5。Prompt 硬规则 + completeArchitectDraft 结构补全后，真实运行 issues=[]、canConfirm=true，计划确认 202 SUCCEEDED。证据：`project/evidence/P1-02/preparation-wiring.md`、`plan-confirmed.json`。正式 P1-02 仍 NOT_STARTED，P0-06 仍 IN_PROGRESS。