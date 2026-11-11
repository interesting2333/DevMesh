## Context

依据 D2 §6 和 P1-04。现有 MCP SDK 1.32.2、repo 快照读取和 tests RunnerClient 已锁定，服务端 ToolAuthority 当前由宿主注入。SQLite 暂无 issues 和 pipeline 领域表；内容存储提供固定引用、哈希验证和读期间 pin。

## Goals / Non-Goals

**Goals:** 五类独立身份及真实动作；可定位的附件原文；有界的缺陷状态变更；受限 Git；独立流水线；每次动作和恢复查询都基于原宿主授权。

**Non-Goals:** 提供生产部署工具；开放模型任意 shell；以受控 Runner 后端替代真实 runsc 验收；在这里声明模型生成质量已通过。

## Decisions

1. docs 以操作员绑定的 documentRef／版本／资源 ID／附件或成果引用为清单，正文通过 LocalContentStore 的授权读取获得并验证冻结 SHA。初版顺序关键词检索而不引入向量数据库；单文档最多 2 MiB、总清单有界，结果返回 UTF-16 offset、段落号和原引用，避免伪造来源。
2. issues 使用 Worker 短事务和向前迁移，保存项目／Run／原 Attempt、缺陷修订、修复 Work、验证依据与不可变历史。create 原 operationId 去重，修改要求 issueRevision，原键查询不受后来的版本冲突影响；验证记录不自动等同候选接受。拒绝仅保存在 MCP 进程内存的实现。
3. repo Git 命令按 argv 调用并禁止 hooks／外部 diff／替换对象／外部清理过滤器；受信任工作区绑定 Git／common directory、写范围、baseCommit 和项目资源。分配器必须提供排斥 Runner／编辑器的工作区及项目租约。私有 index 生成确定 tree／提交，提交包含原操作标识，保存预期 SHA 后写原操作 ref。项目集成先校验受信任业务验收，再以 Git 多 ref 原子事务完成项目 CAS 和原集成操作 ref；分叉记录 CONFLICT。未提供业务验收检查时不注册集成工具，普通角色不获项目仓库写许可。阶段内崩溃仅通过原 ref／SHA 查询，未准备的意图保持未知；不创建第二次提交。Git 事务不代替候选接受，后续分叉合并及串行项目集成与 P1-05 共用边界。
4. pipeline 独立记录 pipelineId、冻结 stage 配置哈希、阶段序号、原 operation、Runner Job 和结果。每阶段单独使用稳定子操作并按前序真实退出推进；安装／检查／构建使用批准命令和 digest，禁止模型修改，默认没有发布阶段。tests 的单作业仍保留原身份，不别名到 pipeline。
5. 组合层为 repo/docs/tests/issues/pipeline 分别启动受控 MCP 服务、连接并冻结能力。共享实现不共享 identity；授权回查当前 Grant、Host、ACL、角色工具，读／停止旧作业只获得原宿主收尾权限。未配置后端或身份时不注册工具，关闭先停止准入再连接和后端。
6. bridge 增加 mutation→by-operation 的显式恢复表，只有原操作有持久成功事实才能修复 ACK。不存在或未知均保持 OUTCOME_UNKNOWN，不靠通用写重试恢复。
7. 当前 Host 以其持久 endpoint／Task／worker／claimToken 每五秒续租，Worker 在短事务内复核当前成员、准入、状态、代际及尚未过期的 Grant，只更新同一许可的十五秒有效窗口。Runtime 收尾停止续租，失败中止后续模型／工具准入。Git 已接受动作在保存预期提交前从 Worker 读取同一当前 Grant 并保留原资源子集，暂停／旧代际／scope 扩大仍拒绝；读取当前许可不能代替续租或复活已过期许可。

## Risks / Trade-offs

- 附件可能来自不可信输入 → 严格 UTF-8、有界检索、精确引用与固定哈希；不执行正文内容。
- 文件／网络操作不与 SQLite 原子 → 先持久意图、再执行、按原事实恢复；不在 Worker 事务内等待外部动作。
- 目标 Linux Runner 不可用 → 本地协议和持久规则保留独立证据，实际容器／长任务仍待验收。

## Migration Plan

新增 migration 10 及后续必要迁移，保持历史 SQL 和 manifest 原哈希；升级前自动备份。无配置默认关闭新增服务。回退应用前保留 DB／内容／操作日志，不降级丢失已登记事实。
