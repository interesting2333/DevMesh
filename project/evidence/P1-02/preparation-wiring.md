# P1-02 Preparation 接线验证（2026-11-17）

- 目标：工作台输入真正触发模型理解与计划生成
- 结论：**已触发并落库**：requirement revision 1、plan revision 1；计划校验正确阻止不完整计划确认
- 正式 P1-02／P0-06 状态不变

## 配置

| 项 | 值 |
| --- | --- |
| Endpoint | `https://token.yyrd.com/v1` |
| 模型 | `deepseek-v4-pro`（响应模型名一致，约 20s） |
| Runtime | `preparation`：caller `orchestrator`，product／architect 同一 Provider |
| Manifest | product／architect 增加 `devmesh.prepare.*`，revision 升到 2，manifestRevision `builtin.v2`，cardHash 重算 |
| 超时 | connect 120s、request 300s（企业代理缓冲完整响应） |

## 端到端结果

本次运行：`project=prj_55fa8822f43747fc8298f227702b787a`、`run=run_03f6dd4bf3f14e6cbe4f5a299f3c85f1`。

时间线：

- t=15s：`currentRequirementRevision=1`，eventSeq=2；
- t=33s：`currentPlanRevision=1`，phase 进入 `PLANNING`，eventSeq=3。

理解内容（[understanding.json](./understanding.json)）：

- 3 条需求：`requirement_add_todo`、`requirement_complete_todo`、`requirement_delete_todo`，均带验收条目与来源引用；
- 2 条假设；1 个非阻塞问题（是否优先设计美观）。

计划内容（[plan.json](./plan.json)）：

- `planRevision=1`、`requirementRevision=1`、`reviewHash=b37d82e9…`、`baseCommit=240e6cc…`；
- 多个 developer 工作与依赖图。

## 计划确认现状

工作台“任务”页显示计划 1、需求依据 1，但确认按钮不可用，校验项：

- `REQUIRED_TEST_MISSING · works`（3 处）
- `INTEGRATION_OUTPUT_MISSING · works`

这是既有计划校验的正确行为：模型没有生成 tester／集成输出，因此不能确认。没有放宽校验，也没有伪造通过。

## 未完成

- 计划质量（tester 工作、集成输出）需继续调 Prompt／schema 或重试生成。
- 未执行确认后的实现／验证／接受链路。
- 三组真实模型样本、G0～G4 未执行。
- 正式 P1-02 仍 `NOT_STARTED`，P0-06 仍 `IN_PROGRESS`。

## 证据文件

- [preparation-runtime.log](./preparation-runtime.log)：Runtime 接入与 readiness
- [preparation-plan-ui.png](./preparation-plan-ui.png)：工作台计划页截图
- [understanding.json](./understanding.json)、[plan.json](./plan.json)：真实模型产出