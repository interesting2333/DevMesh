# P3-06 一致性备份快照（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-backup-snapshot`（父工作包 P3-06）
- 任务：1.1 备份命令；1.2 备份 API 决策
- 结论：一致性 SQLite 快照与完整性校验已实现；**未实现恢复／根目录迁移／加密／远程上传**；正式 P3-06 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| `createBackup` | 目标目录必须绝对、存在、非数据库目录；`VACUUM INTO` 生成快照 |
| 校验 | 打开副本执行 `quick_check` 与 `foreign_key_check`；失败删除副本并报错 |
| 摘要 | 返回路径、SHA-256、字节数与创建时间；不返回内容 |
| API | **不提供 HTTP API**：备份路径属于本地运维信息，避免经 Web 层泄漏；由存储命令／运维调用 |

## 测试

```powershell
node --test --test-reporter=spec tests/backup-snapshot.test.mjs
```

结果：1/1 通过；日志见 [backup-snapshot.txt](./backup-snapshot.txt)。

覆盖：快照存在且非空、SHA-256 与文件一致、副本 `quick_check`、项目数据可读、重叠目录拒绝、不存在／相对路径拒绝。

## 未完成与边界

- 恢复、根目录迁移、加密、远程上传、旧实例隔离与 T14／T24 演练均未实现。
- 没有在真实 Linux／容器环境执行备份恢复演练。
- 正式 P3-06／G1～G4 不变。