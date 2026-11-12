## 1. Immutable policy and independent report evaluation

- [x] 1.1 建立质量策略、原报告／执行身份、业务源码范围和结构化计算结果契约；验证拒绝降门槛、错误 SHA／配置、超限和路径歧义。
- [x] 1.2 实现有界 Istanbul/V8 与模板测试 JSON 原报告解析；用真实模板报告和错误／跳过／缺失夹具验证，拒绝百分比自报和不可映射来源。
- [x] 1.3 实现全业务文件覆盖与共享源码去重、必要检查和 80/70 整数阈值；验证 79/80、69/70、零分支 N/A、空集合、缺一侧报告及矛盾位置。

## 2. Durable original verification and trusted collection

- [ ] 2.1 增加质量策略、原验证、报告材料与结果的向前迁移和 Worker 命令；验证幂等、冻结依据、成员隔离、内容引用／GC 互斥和历史升级。
- [ ] 2.2 实现只读查询原 Runner／pipeline 的报告采集和持久内容 ACK；真实本地 HTTP 验证输出哈希／日志、失败退出、未知 Job、丢回执及不重跑。
- [ ] 2.3 将正式 Work 完成接到可复核的原验证事实；验证模型 success／旧 IPC／陈旧源码／配置不能绕过，确定 findings 和历史兼容分别保留。

## 3. Findings and bounded forward repairs

- [ ] 3.1 衔接 defect 与原失败、复现、预期和准确证据；验证重复结果去重、失败历史不可覆盖和仅准确修复 SHA 复验可关闭。
- [ ] 3.2 实现新修复／复验 Work 的前向规划与两轮预算；验证 findings 依赖、无回边、30 项上限、计划确认和需求／接口变化审查。

## 4. Release candidate revision freeze

- [ ] 4.1 实现不可变候选修订与准确代码／报告／构建／镜像／数据方案／必要材料检查；验证缺项、未知写和高严重缺陷拒绝，接受指针不变。
- [ ] 4.2 实现当前候选／历史修订和逐项质量状态查询；验证新版本不沿用旧审查、不把待人工项判通过，原冻结回执丢失返回原结果。

## 5. Composition, evidence and review

- [ ] 5.1 接 Runtime、Scheduler、Runner、内容库与候选来源，用真实本地 SQLite／Git／HTTP 联调失败→修复→复验→候选，记录无模型／OIDC／Linux/runsc 的实际范围。
- [ ] 5.2 执行固定提交干净 checkout 冻结安装和适用回归，保存原报告／SHA／源码指纹、部署说明及 T10 复核，同步台账与 OpenSpec，不提前替代产品或阶段验收。
