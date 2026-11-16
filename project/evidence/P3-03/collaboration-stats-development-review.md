# P3-03 协作统计与配置导出（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-collaboration-stats`（父工作包 P3-03）
- 任务：1.1 统计／导出命令；1.2 受保护 API
- 结论：项目级只读统计与无密钥配置导出已实现并通过测试；正式 P3-03 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| `getProjectStats` | 成员数、Run 总数／活动／终态、消息数、工件数、Release 数；只读 |
| `getProjectConfigExport` | 项目名、成员角色、Registry generation／manifest revision／角色绑定；不含 credentialRef／address／cardHash |
| API | `GET /projects/{projectId}/stats`、`GET /projects/{projectId}/config-export`；成员读权限 |
| OpenAPI | 新增两个路径（总数 85） |

## 测试

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/collaboration-stats.test.mjs tests/input-stats-http.test.mjs
```

结果：3/3 通过；日志见 [collaboration-stats.txt](./collaboration-stats.txt)。

覆盖：未知项目 404、计数准确、成员角色、空 Registry、导出 JSON 不含敏感字段。

## 未完成与边界

- 导入、时间序列、活动区间、重做分开统计、UI 与 R14～R19 产品验收未实现。
- 正式 P3-03／G1～G4 不变。
