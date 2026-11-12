## Why

父工作包 P1-06，依据 D2 ResultVerifier、D4 §3/6、实施文档 P1-06 和 T10、R07/R12/R13/R19。当前已有固定源码分配、源码 ACK、角色候选、Runner 原作业及 pipeline 事实，但 `recordVerifiedWork` 仍接受受信任调用方提供的验证结论，没有从原始报告计算质量的独立实现，不能把模型汇总或命令退出码直接当作交付通过。

## What Changes

- 增加绑定精确 SHA、配置哈希、Runner 原操作／输出哈希的检查与报告契约；可信结果采集器归档原报告、日志和执行环境。
- 从原报告校验必要测试零失败／跳过／缺失；固定业务源码范围，按 SHA、源码路径和行／分支身份去重合并覆盖数量，执行 80%／70% 硬门槛及有依据的零分母 N/A。
- 建立持久验证操作、逐项结果及来源引用；Worker 只将可复核的验证事实用于 Work 完成，保留失败与过期报告，不让普通模型工具发布通过结论。
- 失败生成有复现和证据的 defect；通过新的修复／复验 Work 与显式 findings 依赖维护 DAG，最多两轮自动修复，不覆盖原失败。
- 在必要检查齐全、无未知写操作、准确构建／预览／数据方案及材料引用可用时冻结不可变 ReleaseCandidate 修订；质量和人工接受仍分开，人工审查与数据切换由 P1-07 实施。

## Capabilities

### New Capabilities

- `result-verification`: 原始报告来源、固定源码覆盖合并、必要检查、持久验证、缺陷修复复验及候选冻结。

### Modified Capabilities

无。未归档的托管工作区／调度变更通过代码组合衔接，本次不提前改写已归档主规格或尚未完成的人工接受能力。

## Impact

新增独立 TypeScript 验证模块、contracts 契约和向前 SQLite 迁移；衔接 Runner 输出、内容库、issues、Scheduler 和候选来源。沿用 Node 24、固定依赖和 Worker 单写，不执行生成项目的任意宿主命令，不增加模型／OIDC／Docker 环境要求。真实 Linux/runsc、完整模板覆盖工具和真实模型验收仍按实际环境补齐；可先完成真实本地报告解析、SQLite／Git／HTTP 组合。正式前置及 G0 未通过时 P1-06 保持 NOT_STARTED，独立代码和证据按既有连续授权记录。
