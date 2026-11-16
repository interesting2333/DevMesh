## 1. Documents and issues

- [x] 1.1 实现固定附件版本 docs.search/read，使用真实内容存储与官方 MCP HTTP 验证来源、offset、越权和漂移拒绝。
- [x] 1.2 增加 issues 领域迁移、修订历史、创建／关联修复／验证及原键查询，以 SQLite 和 HTTP 验证去重、旧修订、越权、重启不丢历史。
- [x] 1.3 补齐当前已认领 Host 的五秒续租和 Runtime 生命周期管理；验证固定十五秒窗口、旧 claim／暂停／过期拒绝，Git 在提交副作用前复核当前许可，未知操作不重放。

## 2. Repository and pipeline

- [x] 2.1 实现受控 Git repo 写动作和原操作记录；用真实临时 Git 仓库验证写范围、baseCommit、去重、冲突和恢复。
- [x] 2.2 增加独立流水线及阶段持久记录，冻结配置并接 RunnerClient；验证顺序、失败／未知阻断、原 Job 查询及重启，并完成原 Job 序号续租和十五秒子许可检查。
- [x] 2.3 补齐真实工作区读取、文件写入／删除、diff／snapshot 工具及原操作日志，接当前授权、旧内容 CAS、实际目录 fencing 和落盘证明；以官方 MCP HTTP 验证编辑后 Git 提交、越界／旧 SHA／链接拒绝、丢回复与重启只查询原事实。

## 3. Composition and recovery

- [x] 3.1 组合五类独立 MCP 身份、连接及 schema 快照，接当前 Host／Grant／ACL／角色授权；验证真实调用、暂停写拒绝、原作业查询／停止和释放。
- [x] 3.2 扩展 bridge 原操作恢复映射，验证丢失写回复只查询原事实，不重发写动作。

## 4. Evidence

- [x] 4.1 完成固定提交全量回归、部署文档及父工作包台账，记录五类实际动作和仍待真实模型／Linux Runner 的验收项。

2026-11-16：完成4.1，变更9/9。固定提交`bde6f61`取得适用全量回归证据：首次`pnpm check`在`9c6fce0`为613通过／1失败（触发器顺序假设，已修正并19/19复验）；`bde6f61`复跑在runner组遇到RunnerClient 10秒传输超时（负载型，文件单独13/13通过），其余套件由同源码提交覆盖。补充`test:mcp` 35/35、`test:verification` 187/187、`contracts:check`与台账检查通过。部署文档见`packages/mcp-tools/README.md`“显式部署与生命周期”，五类repo／docs／tests／issues／pipeline已记录。真实模型、Linux Runner、T04/T05未执行，正式P1-04／G0不变。证据：`project/evidence/P1-04/full-regression-bde6f61.md`。
