# P1-02 准备迁移与只读 bootstrap 验证（1.2／2.1）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-understanding-and-readonly-planning`（父工作包 P1-02）
- 任务：1.2 准备宿主／步骤／Task／共享容量及问题／答案／解释作业 migration；2.1 固定来源／可信 Git SHA 的有界只读 bootstrap 和准备请求持久化
- 结论：两项的既有实现已由仓库实际迁移与准备测试覆盖，本轮定向执行 **16 项全部通过、0 失败**；据此勾选，正式 P1-02／G0 状态不变
- 边界：受控 Provider、身份与模型输出为夹具；真实模型、OIDC、Linux 未执行；3.3 保持未执行

## 环境

| 项目 | 值 |
| --- | --- |
| 操作系统 | Windows（本机） |
| Node | v24.13.1 |
| 源码 | 当前 HEAD `f29178f`，未改生产代码 |
| 承载 | 真实 SQLite 文件 Worker、真实临时 Git 仓库、官方 A2A 准备链路、受控 Provider |

## 命令与结果

```powershell
node --test --test-reporter=spec tests/preparation.test.mjs tests/storage-migrations.test.mjs
```

- 结果：tests 16、pass 16、fail 0、skipped 0、cancelled 0，duration 62 667 ms。
- 迁移用例耗时 60 161 ms，因为逐个版本真实落盘升级并校验备份；其余准备用例为秒级。

## 覆盖对照

### 1.2 迁移与容量

| 要求 | 实际证据 |
| --- | --- |
| 准备宿主／步骤／Task | `packages/storage-sqlite/migrations/0008-preparation.sql` 建立 `preparation_jobs`、`preparation_attempts`、`preparation_steps`、`preparation_a2a_tasks`、`preparation_inbox`、`preparation_task_events`、`preparation_bootstrap_sources` |
| 共享容量 | `preparation_slots` 与 `role_slots` 双向触发器限制每 Run 同角色互斥、总数不超过 2；准备测试断言实现角色占用后准备角色得到 `ROLE_CAPACITY_EXHAUSTED` |
| 问题／答案／解释作业 | `understanding_revisions`、`clarification_questions`、`clarification_current`、`clarification_answers`、`interpretation_answers` 及不可变触发器 |
| 旧 v7 保留 | `storage-migrations` 的“formal empty installation supports each previous version…”逐个历史版本升级并校验数据保留 |
| 真实 FK | `applyMigrations` 在每个迁移提交前执行 `PRAGMA foreign_key_check`，失败即回滚 |
| 不可变版本 | 准备测试断言 `ANSWER_IMMUTABLE`；迁移同时定义 understanding／question／answer 不可改／不可删触发器 |
| 迁移回滚 | “a failed migration atomically rolls back DDL, row changes and version marker” |

### 2.1 只读 bootstrap

| 要求 | 实际证据 |
| --- | --- |
| 固定来源／可信 Git SHA | `readPreparationGitSource(repo, baseCommit, path, limit)` 只接受准确提交；测试断言 `HEAD` 被拒绝，读取字节与 `git show <sha>:<path>` 完全一致 |
| 拒绝路径越界 | `../README.md` 被拒绝 |
| 有界正文 | 小于内容的 `5` 字节上限被拒绝 |
| 缺 Provider 仍等待 | 未配置 Provider 时 `dispatch` 返回 `null`，`preparation_attempts` 保持 0 |
| 无工具写权限 | 准备请求固定 `tools: []`（`z.tuple([])`），响应要求 `toolCallCount===0`；准备角色不持有工具 |
| 准备请求持久化 | `preparation_jobs`／`attempts`／`steps` 与 bootstrap source 注册在实际 Worker 中提交 |

## 未执行与后续

- 3.3 U05～U08／I04～I06 的真实模型与企业环境验收：资源缺失，保持 `NOT_CONFIGURED`／`NOT_EXECUTED`，阶段门槛单独评审。
- P1-02 在 `project/tasks.json` 中仍为 `NOT_STARTED`；本记录只覆盖上述两项的实际验证。
