## Purpose

以准确源码版本、可信原执行及不可变报告计算研发质量和交付候选，保留失败、缺失与过期事实，确保模型总结、跳过测试或不完整覆盖数据不会变成通过结论，并使缺陷修复和复验可追溯。

## ADDED Requirements

### Requirement: Reports prove their exact execution and source

验证 SHALL 绑定原 Attempt、固定代码 SHA、检查配置哈希、原作业与输出字节哈希，保留命令、退出码、时间、执行环境和日志。原报告缺失、未 READY、源码／配置不符、来源作业未知或非正常结束时 MUST 不发布通过。

#### Scenario: A model claims success with a failed or absent report

- **WHEN** 模型结论为通过，但原作业失败、报告缺失、哈希不符或必要测试跳过
- **THEN** 检查保持 FAIL、MISSING 或 STALE，模型结论不能覆盖原事实

#### Scenario: The same execution receipt is recovered

- **WHEN** 原验证操作的响应丢失
- **THEN** 按原键和固定依据返回原结果，不新建测试 Job、重复导入报告或替换原失败

### Requirement: Coverage uses the complete frozen business source scope

覆盖范围 SHALL 包含准确 SHA 的全部业务源码，按固定 glob 和可审查排除清单确定；必要前后端报告 MUST 齐全，源码映射与清单一致。聚合 SHALL 以 SHA、规范路径和行／分支位置身份去重，并按覆盖数量汇总，不平均百分比或重复计入共享源码。

#### Scenario: Thresholds are evaluated without rounding

- **WHEN** 行覆盖率为 79%／80%，或分支为 69%／70%
- **THEN** 分别返回未达标／达标；显示取整不得把未达标结果提升为通过

#### Scenario: Shared source is observed by both producers

- **WHEN** 前后端报告包含同一源码身份的行或分支
- **THEN** 总分母只计算一次，任一可信原报告实际覆盖可计为已覆盖；位置／源码身份矛盾的报告拒绝

#### Scenario: An unexecuted file or required producer is omitted

- **WHEN** 冻结业务范围中的文件或必要报告缺失
- **THEN** 保持缺失结果，不将剩余文件的覆盖率当作整体通过；空业务源码集合返回 COVERAGE_SCOPE_EMPTY

#### Scenario: No branch is instrumented in a nonempty business scope

- **WHEN** 完整源码映射证明分支总量为零且冻结规则允许
- **THEN** 保存 NOT_APPLICABLE 规则和证据；没有规则或证据时不以 100% 放行

### Requirement: Verification preserves findings and bounds automatic repair

失败 SHALL 保存复现输入、预期、准确源码与报告引用；修复 SHALL 使用新的 Work、显式 completed-with-findings 依赖及新的精确 SHA 复验，不把原失败改为通过。自动修复 MUST 不超过两轮，不产生回边、超过 30 项的 DAG 或未确认的需求／接口决定。

#### Scenario: A failed verification enables a repair

- **WHEN** 原失败具有确定 findings，且当前计划和修复预算允许
- **THEN** 形成开发修复与复验的新前向依赖；原失败只满足 findings 进入条件，不满足交付通过

#### Scenario: Repair budget or plan constraints are exceeded

- **WHEN** 已自动修复两轮、需改变确认需求／接口或会超过 DAG 上限
- **THEN** 保留失败和修复建议，等待明确决定，不自动继续或降低质量门槛

### Requirement: Candidate revisions freeze complete quality and delivery identities

ReleaseCandidate SHALL 固定代码、需求／计划／模板／检查配置版本、必要检查集合、报告、构建产物、预览镜像和数据方案身份。必要检查未通过、材料缺失、存在未解决高严重缺陷或未知写操作时 MUST 不冻结可审查候选。变化 SHALL 创建新修订，不能覆盖已审查版本或直接更新项目接受指针。

#### Scenario: A complete verified revision is frozen

- **WHEN** 当前准确来源的必要自动检查和候选材料齐全，人工审查项已明确
- **THEN** 保存不可变候选修订与逐项质量依据，人工审查和接受继续为独立后续动作

#### Scenario: An old report is reused after code or policy changes

- **WHEN** 代码、配置、需求、计划、必要集合或交付材料身份已变化
- **THEN** 旧报告保留为历史并标过期，不覆盖候选或据此自动接受
