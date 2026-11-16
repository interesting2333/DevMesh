# P2-02 启动恢复扫描与崩溃矩阵（1.1／1.2／2.1／2.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-crash-recovery-scan`（父工作包 P2-02）
- 任务：1.1 只读扫描；1.2 平台 RecoveryScan；2.1 崩溃矩阵；2.2 日志与边界
- 结论：只读恢复扫描、平台冻结包装和四项崩溃矩阵验证完成；正式 P2-02 仍 `NOT_STARTED`，G1 未通过

## 实现

| 项 | 内容 |
| --- | --- |
| `getRecoveryState` | 只读返回 control 中的 Run（PAUSING／PAUSED／CANCELLING）、活动 attempt、未知 attempt、Outbox PENDING／LEASED／RECONCILE、未结束准备 |
| `RecoveryScan` | 平台显式包装，返回冻结结果；不写库、不发事件、不改变 gate／attempt／租约 |
| 租约语义 | 过期 LEASED 由既有 `claimOutbox` 转为 RECONCILE，等待原键核实；不自动重发 |
| 边界 | 扫描不自动 OPEN、不自动终结 UNKNOWN、不重放 create／start／stop／工具／接受动作 |

## 崩溃矩阵

| 场景 | 验证 |
| --- | --- |
| 手动暂停跨重启 | 关闭并重开真实 Worker 后 `controlGate` 仍为 PAUSED，扫描不会改回 OPEN |
| 未知 attempt 跨重启 | OUTCOME_UNKNOWN 保持，扫描计数 1，不自动判终态 |
| Outbox 租约 | LEASED 被报告；过期后显式 claim 转为 RECONCILE，不自动重投 |
| 迟到结果／原键 | 重启后同一幂等键仍返回原 operation，不创建新动作 |

## 测试

```powershell
node --test --test-reporter=spec tests/recovery-scan.test.mjs
```

结果：5/5 通过、0 失败；完整日志见 [recovery-scan.txt](./recovery-scan.txt)。

## 未执行与后续

- 真实 Runner／容器、工具、接受后端的物理恢复与迟到回执未执行。
- 平台 readiness 展示与自动扫描时机尚未接入；当前只有显式 `RecoveryScan`。
- 3.1 文档／基线／台账同步待完成。
- 正式 P2-02／G1～G4 不变。
