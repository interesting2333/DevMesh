# Tasks

- [x] 1.1 实现 `createBackup`：路径校验、VACUUM INTO、quick_check／foreign_key_check、SHA-256 与字节数；用真实存储验证。
- [x] 1.2 备份 API 决策：不暴露 HTTP 备份路径，仅保留存储命令供运维调用；在证据中记录原因。
- [x] 1.3 保存日志与边界，同步文档与 P3-06 台账；正式 P3-06 仍保持 NOT_STARTED。

## 备注

恢复、根目录迁移、加密、远程上传与目标环境演练不在本次增量内。

2026-11-16：完成1.1／1.2／1.3，变更3/3。createBackup一致性快照、完整性校验与摘要落地；不提供HTTP备份API；文档/基线同步，manage/openspec通过。正式P3-06仍NOT_STARTED，G0～G4未变。证据：`project/evidence/P3-06/backup-snapshot-development-review.md`。