## Why

父工作包 **P0-03**，前置 P0-02 已 DONE。现有 SQL 只验证设计约束，尚无正式迁移、统一 Worker 或可查询的持久事务，后续会话与 A2A 无法安全恢复。

依据实施文档 §4.1/5.1/5.3、D5 §1/2/4/6/7.1、D1 不变量，落实 T07 的数据库基础。

## What Changes

- 新建 storage-sqlite 包，使用 Node 24.13.1 内置 SQLite 和单个 Worker，提供有界、类型化领域 RPC。
- 建立不可变迁移清单、store/layout 身份、核心 24 表及必要的内容元数据、输入、计划确认和许可前置表。
- 实现创建 Project/Run、发布／确认计划、保留 Attempt、状态转换、operations 与 Outbox 的原子存储事务和分页查询。
- 提供迁移 CLI、一致性升级备份、单写实例锁、失败／崩溃与跨平台证据，更新台账。

## Capabilities

### New Capabilities

- `sqlite-storage`：正式迁移、数据库 Worker、持久领域事务与恢复查询。

### Modified Capabilities

无；复用已有 core-contracts。

## Impact

新增 Node 专用包与 db:migrate/test:storage 命令，无新增原生 npm 依赖。此为首次正式数据库版本；不导入设计样例库、不自动接管陌生数据库。内容文件发布／会话为 P0-04，真实注册与 A2A 为 P0-05，完整调度与产品 API 为 P1。存储事务不执行模型、网络、Git 或 Runner；不以本次测试宣称完整 T07 或 G0 通过。
