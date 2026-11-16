## Context

P3-02 要求历史只读、回放、导入校验与截止快照导出。先实现不依赖外部资源的只读导出与完整性标记。

## Goals / Non-Goals

**Goals**
- 按截止时间导出项目历史摘要。
- 明确标记不完整及原因，不补造记录。
- 只读，不写库。

**Non-Goals**
- 不实现导入、回放播放器、Git 打包或会话正文导出。
- 不保证跨节点一致快照（备份由 P3-06 负责）。

## Decisions

1. **截止时间**：默认当前时间；所有包含记录必须 `created_at <= cutoffAt`。
2. **完整性**：截止前无 Run → `complete=false, missing=['NO_RUNS_BEFORE_CUTOFF']`；存在未终态 Run → `missing=['ACTIVE_RUNS_AT_CUTOFF']`。
3. **只读**：不写事件、不更新时间戳。
4. **权限**：存储层只校验项目存在；成员权限由 API 层执行。

## Risks / Trade-offs

- 摘要是瞬时视图 → 与备份不是同一事务；需要强一致时使用 P3-06 快照。
- 不含正文 → 导入／回放仍需后续能力。

## Migration Plan

无迁移；回退删除命令即可。