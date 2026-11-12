# P1-06 3.2 开发验证与同 Agent 复核

2026-11-12，Codex 实施并复核。这里记录开发检查，P1-06 正式工作包及阶段验收保持未完成。

迁移 25 固定修复操作、计划正文与沿用结果；实现负责人私有规划、内容 ACK、显式计划发布及确认。每轮只追加 fix → reverify，固定原独立失败、原需求／配置／模板和已批准写入范围；最多两轮、总 Work 不超过 30 项。调度与源码组合使用同一沿用解析器，历史证明不升级。发布不确认、不派发、不重置原 Work；确认同时检查沿用摘要、缺陷版本及未知副作用，再原子关联缺陷。

- `development/repairs-v1-failed`：生产代码的 typecheck／lint／构建通过；测试夹具缺少 If-Match，且使用了不存在的 GC 方法，修正测试后重跑。
- `development/repairs-v2`：6 个修复用例及关联的缺陷、Work、调度、质量存储、候选依据检查通过。
- `development/repairs-v3-failed`：新增完整第二轮、准确复验关闭及未知副作用用例，7/8 通过；未知副作用夹具使用非法 pipeline 枚举，改为真实 OUTCOME_UNKNOWN，未放宽生产检查。
- `development/repairs-v4`：14 项检查全部通过，包含 TypeScript、lint、依赖构建、OpenAPI 一致性和 132 个测试。覆盖 contracts 18、storage 28、input 20、preparation 10、repair 8、finding 10、Work 11、scheduler 10、quality journal 10、candidate basis 7。
- `development/repairs-v5`：在 v4 后增加确认阶段的迟到未知副作用保护。TypeScript、lint、当前依赖构建通过，repair 9、finding 10、Work 11、scheduler 10、quality journal 10、candidate basis 7，合计 57 个测试通过。所有失败日志及失败源码指纹均保留。

逐项复核：原键恢复仍检查当前成员权限；内容与发布故障回滚；FK 阻止材料 GC；沿用哈希和不可变记录防篡改；发布后出现未知作业会使 review 不可确认，并在确认事务再次拒绝，不能部分关联缺陷。第二轮确认后可沿已证实的 findings 祖先关系关联原缺陷；准确新 SHA 的实际 Work／质量证明才能关闭原失败。原失败与后续复验历史同时保留。

测试实际使用迁移后的 SQLite、LocalContentStore、独立报告计算、WorkVerifier、计划／调度／候选依据事务；Git、Runner、Runtime 候选及准入事实在这些定向用例中明确种入。没有把它们报告为真实 Git／Runtime 全链路、真实模型或 Linux/runsc 验收。固定提交干净 checkout 验证和候选冻结仍属于任务 4／5，本次不替代。
