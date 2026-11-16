# P2-07 内容 pin 与存储诊断基础（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-content-maintenance`（父工作包 P2-07）
- 任务：1.1 `content_pins` 迁移与 pin／release／list／diagnostics
- 结论：内容 pin 与计数诊断已实现并通过测试；**没有任何删除路径**，GC／归档仍缺失；正式 P2-07 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0051 | `content_pins`：pinId／内容 hash／原因／操作／创建与释放时间；活跃 pin 部分索引 |
| `pinContent` | 内容对象必须存在；同键幂等；同键不同 hash `IDEMPOTENCY_KEY_REUSED` |
| `releaseContentPin` | 只释放 pin，不删除内容；重复释放返回原结果 |
| `listContentPins` | 按 hash、是否只看活跃过滤 |
| `getStorageDiagnostics` | 内容对象数、活跃 pin、已释放 pin；**不返回伪造磁盘容量** |

## 测试

```powershell
node --test --test-reporter=spec tests/content-pins.test.mjs
```

结果：1/1 通过；日志见 [content-pins.txt](./content-pins.txt)。覆盖幂等、同键不同 hash 拒绝、释放不删内容、活跃／已释放计数。

## 未完成与边界

- 受保护 pin／诊断 API（1.2）未完成。
- GC 计划／提交／删除、归档 ACK、分块日志、容量限制（2.x）未实现；本增量明确没有删除路径，不冒充 T22／T23。
- 正式 P2-07／G1～G4 不变。
