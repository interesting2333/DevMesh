# P2-07 内容归档请求与 ACK 账本（1.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-content-archive-ledger`（父工作包 P2-07）
- 任务：1.1 `content_archive_requests` 迁移与 request／ack／get／list
- 结论：归档请求／ACK 账本已实现；ACK 不删除内容，丢失 ACK 保持 REQUESTED；**本增量没有删除命令**；正式 P2-07 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| 迁移 0053 | `content_archive_requests`：内容 hash／项目／状态 REQUESTED／ACKED／CANCELED／请求与 ACK 主体和时间 |
| `requestContentArchive` | 项目与内容对象必须存在；同键幂等；只登记请求 |
| `ackContentArchive` | 仅 REQUESTED 可 ACK；记录 ACK 主体与时间；重复 ACK 返回原记录；不删除内容 |
| 查询 | `getContentArchive`、按项目／hash／状态有界 `listContentArchives` |
| 明确缺失 | 没有删除、GC 计划／提交、分块日志或容量限制 |

## 测试

```powershell
node --test --test-reporter=spec tests/content-archive.test.mjs
```

结果：1/1 通过；日志见 [content-archive.txt](./content-archive.txt)。

覆盖：同键幂等、ACK 后内容计数不变、丢失 ACK 保持 REQUESTED、项目过滤列表。

## 未完成与边界

- 受保护归档 API（1.2）与文档同步（1.3）未完成。
- 本增量没有删除路径，不宣称 GC 安全或 T22／T23。
- 正式 P2-07／G1～G4 不变。

## 追加：受保护归档 API（1.2）

- `POST /projects/{projectId}/content-archive`：成员写权限，登记归档请求。
- `GET /projects/{projectId}/content-archive?contentHash=&state=`：成员读权限。
- `GET /content-archives/{archiveId}`、`POST /content-archives/{archiveId}:ack`：按所属项目复核权限；ACK 不删除内容。
- OpenAPI 新增三个路径（总数 83）。
- `tests/input-content-archive-http.test.mjs` 1/1：请求、列表、ACK、内容计数不变。
