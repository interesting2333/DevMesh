# P3-02 截止快照历史导出（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-history-export`（父工作包 P3-02）
- 任务：1.1 导出命令；1.2 受保护 API
- 结论：按截止时间的只读历史导出与不完整提示已实现；**未实现导入、回放 UI、Git／会话正文打包**；正式 P3-02 仍 `NOT_STARTED`

## 实现

| 项 | 内容 |
| --- | --- |
| `exportProjectHistory` | 按 `cutoffAt`（默认当前）过滤 Run／消息／工件／Release；只读 |
| 完整性 | 截止前无 Run → `NO_RUNS_BEFORE_CUTOFF`；存在未终态 Run → `ACTIVE_RUNS_AT_CUTOFF`；`complete=false` |
| API | `GET /projects/{projectId}/history-export?cutoffAt=`；成员读权限；非法时间 422 |
| OpenAPI | 新增路径（总数 86） |

## 测试

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/history-export.test.mjs tests/input-history-export-http.test.mjs
```

结果：2/2 通过；日志见 [history-export.txt](./history-export.txt)。

覆盖：活动 Run 标记不完整、过去 cutoff 空历史、终态 Run 完整、未知项目 404、非法时间 422。

## 未完成与边界

- 导入校验、恶意包拒绝、回放播放器、Git／会话正文打包与 T13／D09／D10／R18 未实现。
- 不是跨节点一致快照；强一致使用 P3-06 备份。
- 正式 P3-02／G1～G4 不变。