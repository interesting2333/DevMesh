# Tasks

## 1. Read-only recovery evidence

- [x] 1.1 实现 `getRecoveryState` 只读扫描：控制中的 Run、活动／未知 attempt、Outbox 未决／租用、未结束准备；验证不写库、不自动 OPEN、不改变 UNKNOWN。
- [x] 1.2 新增平台 `RecoveryScan` 显式包装与冻结结果；默认不自动开放新执行。

## 2. Crash matrix

- [x] 2.1 覆盖手动暂停跨重启保持、未知 attempt 跨重启保留、Outbox 过期租约可显式接管、迟到结果按原键核实。
- [x] 2.2 保存真实日志与边界；真实 Runner／容器／工具恢复明确未执行。

## 3. Records

- [x] 3.1 同步设计／验收／实施文档、基线、OpenSpec 与 P2-02 台账；正式 P2-02 仍保持 NOT_STARTED。

2026-11-16：完成1.1／1.2／2.1／2.2，变更4/5。`getRecoveryState`只读扫描与`RecoveryScan`冻结包装落地；矩阵覆盖手动暂停跨重启保持、未知attempt保留、Outbox过期租约转RECONCILE、原键查原事实。recovery-scan测试5/5通过。3.1文档／基线同步待完成；正式P2-02／G1不变。证据：`project/evidence/P2-02/recovery-scan-development-review.md`。

2026-11-16：完成3.1，变更5/5。设计04、产品验收场景、实施文档追加P2-02离线记录；技术设计主文重建且`--check`一致；三份基线SHA-256更新；台账与OpenSpec同步，`manage check`与`openspec validate --all --strict`通过。正式P2-02仍`NOT_STARTED`，G0～G4未变。
