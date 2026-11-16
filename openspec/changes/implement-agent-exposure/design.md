## Context

P3-04 要求 Exposure 草稿／校验／发布／排空、默认 Card、目录查询与服务 grant。当前只有 Registry 端点生命周期，没有面向外部 Agent 的发布状态机。先实现离线可验证的 Exposure 生命周期。

## Goals / Non-Goals

**Goals**
- Exposure 持久化与显式状态机。
- Card 校验与 hash 可复核。
- 目录只暴露已发布与排空中条目。

**Non-Goals**
- 不实现默认 Card 自动生成、服务 grant、真实外部 Agent 握手或 T8。
- 不写 Registry 清单，不影响 A2A 路由。

## Decisions

1. **状态机**：DRAFT→VALIDATED→PUBLISHED→DRAINING→RETIRED；其他转换拒绝。
2. **Card**：`{name,description,version,skills[]}`；skills 非空且唯一；hash 为 canonical JSON 的 sha256。
3. **校验**：validate 重新计算 hash 并与存储比对，防止草稿被绕过修改。
4. **发布**：publish 需要 VALIDATED，记录 published_at 并递增 revision。
5. **目录**：只返回 PUBLISHED／DRAINING；RETIRED 不出现。
6. **唯一性**：同一项目 agentKey 唯一，避免重复发布。

## Risks / Trade-offs

- 没有真实端点验证 → 只保证 Card 与状态自洽，不宣称可被外部调用。
- 没有 grant → 目录可见不等于已授权调用。

## Migration Plan

新增向前迁移 `agent_exposures`；旧库升级保留数据，失败回滚。