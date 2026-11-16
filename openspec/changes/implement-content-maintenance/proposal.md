## Why

父工作包 P2-07。内容对象已有 READY 状态与引用，但没有存储 pin、GC 计划／提交或归档 ACK 互斥；直接实现删除风险过高。G1 未通过，本变更先落地可离线验证的 pin 与诊断基础，GC／归档保持审计与缺口记录。

## What Changes

- 新增 `content_pins`：按内容 hash 记录活跃 pin、原因、释放时间；活跃 pin 阻止未来的 GC 候选。
- `pinContent`／`releaseContentPin`／`listContentPins`：幂等、可释放、不删除内容。
- `getStorageDiagnostics`：内容对象与活跃 pin 计数，不伪造磁盘容量。
- 明确不做删除：任何 GC／归档 ACK 路径在缺少完整引用分析前不实现，避免“ACK 丢失即删文件”。

## Capabilities

### New Capabilities

- `content-maintenance`: 内容 pin 与存储诊断基础。

### Modified Capabilities

不改现有内容对象状态机或引用表；只为后续 GC 提供互斥输入。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P2-07、G0～G4 不变。
