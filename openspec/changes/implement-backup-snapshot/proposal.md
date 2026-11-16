## Why

父工作包 P3-06 的完整备份／恢复与根目录迁移。先实现可离线验证的一致性备份快照：不依赖外部资源、不声称恢复已完成。G1 未通过，本变更作提前开发增量。

## What Changes

- `createBackup`：在显式目录生成 SQLite 一致性快照（VACUUM INTO），校验 quick_check，返回路径、SHA-256 与字节数。
- 目标目录必须是已存在的绝对路径，且不能位于数据库目录内。
- 不做恢复、根目录迁移或自动清理；真实目标环境演练留给后续任务。

## Capabilities

### New Capabilities

- `backup-snapshot`: 一致性备份快照与校验。

### Modified Capabilities

不改变存储 schema 或现有迁移。

## Impact

影响 `packages/storage-sqlite`（命令与文件 IO）、测试与文档。正式 P3-06、G0～G4 不变。