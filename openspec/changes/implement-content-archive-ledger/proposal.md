## Why

父工作包 P2-07 的 GC／归档缺口。直接实现删除风险过高；先落地归档 ACK 账本：记录请求与 ACK，ACK 丢失时内容保持，且**没有任何删除路径**。G1 未通过，本变更作提前开发增量。

## What Changes

- 新增 `content_archive_requests`：内容 hash、项目、状态（REQUESTED／ACKED／CANCELED）、请求／ACK 主体与时间、操作。
- `requestContentArchive`：操作幂等；内容对象必须存在；只登记请求，不删除。
- `ackContentArchive`：仅 REQUESTED 可 ACK；记录 ACK 主体与时间；不删除内容；重复 ACK 返回原记录。
- `getContentArchive`／`listContentArchives`。
- 明确没有删除命令；GC 计划／提交仍缺失。

## Capabilities

### New Capabilities

- `content-archive-ledger`: 归档请求与 ACK 账本。

### Modified Capabilities

复用内容对象与操作幂等；不改变内容状态机。

## Impact

影响 `packages/storage-sqlite`（迁移与领域）、后续 API 与测试。正式 P2-07、G0～G4 不变。