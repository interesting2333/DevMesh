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
7. 当前 Host 以其持久 endpoint／Task／worker／claimToken 每五秒续租，Worker 在短事务内复核当前成员、准入、状态、代际及尚未过期的 Grant，只把到期时间延长至当前时间后十五秒，保留原 notBefore 以免撤销未到期的在途许可。Runtime 收尾停止续租，失败中止后续模型／工具准入。发往 Runner 的子许可另行收窄至最多十五秒，流水线从原 Job 查询持久序号，再提交当前授权的下一序号续租；未知回复先查询原 Job，不重新 start。Git 已接受动作在保存预期提交前从 Worker 读取同一当前 Grant 并保留原资源子集，暂停／旧代际／scope 扩大仍拒绝；读取当前许可不能代替续租或复活已过期许可。
8. MCP 调用默认十秒，可显式配置至最多一百二十秒并纳入连接快照。Git 的独立只读核实可以并行；成功写入 ref 后保存已确认的原事实，只有未知／重启恢复重新核实 ref 和对象。路径与目录设备／文件 ID 一并冻结，路径同名替换不能继承旧绑定。
9. 开发闭环需要实际文件工具，Git 提交不能替代文件编辑。repo 另提供受控工作区读取、UTF-8 文件写入／删除、固定 base 的工作区 diff 和精确源码 snapshot。文件修改绑定原 Attempt、写范围和目录身份，携带旧 SHA（创建要求不存在），先保存原意图，再在实际工作区 fencing 下以同卷暂存／原子替换或隔离移动完成动作。保存可与原操作关联的文件身份／材料证明；仅当前文件内容相同不足以确认旧写操作成功。未核实操作阻止后续写入／提交，恢复只查询原记录与证明，不重放写入。拒绝链接、路径逃逸、敏感路径、越界字节和任意 shell。P1-05 的 Runner 屏障与目录资源用于实际组合，默认无后端不注册。

文件工具细化：新写入最多 64 KiB UTF-8，JSON 编码另限 192 KiB，以适配既有 256 KiB 请求边界；读取最多 2 MiB 的源文件，按 UTF-16 offset／length 每次最多 65536 字符返回，SHA 始终校验整个文件。工作区清单包含 Git 跟踪及未忽略的普通源码实际字节、模式、大小和 SHA，排除已删除路径，最多 2000 项／8 MiB／192 KiB 元数据；它是工作区来源事实，不声称已有 commit 或归档 ACK。原操作材料位于 Attempt 父目录的私有 sidecar，保留旧内容／删除隔离件；准备文件以私有硬链接固定原 inode，准备证明先落 SQLite，再原子 rename，随后核实准确 inode／SHA。确认成功并删除准确私有 receipt、持久 cleanup 确认后才允许后续编辑／提交；未知保留材料。最终材料归档与回收仍须 P1-05 的完整 ACK。

工作区 lease 未交给文件／Git 动作前，资源准入失败说明业务动作尚未执行，原编辑或提交记录持久 FAILED，避免已知忙碌拒绝留下永久 SENT。Runner 屏障自身的未知结果继续保留原操作与独占事实；业务失败不等于屏障已释放。已交付 lease、进入文件／Git 动作后的未知结果仍按原证明核实。

## Risks / Trade-offs

- 附件可能来自不可信输入 → 严格 UTF-8、有界检索、精确引用与固定哈希；不执行正文内容。
- 文件／网络操作不与 SQLite 原子 → 先持久意图、再执行、按原事实恢复；不在 Worker 事务内等待外部动作。
- 目标 Linux Runner 不可用 → 本地协议和持久规则保留独立证据，实际容器／长任务仍待验收。

## Migration Plan

新增 migration 10 及后续必要迁移，保持历史 SQL 和 manifest 原哈希；升级前自动备份。无配置默认关闭新增服务。回退应用前保留 DB／内容／操作日志，不降级丢失已登记事实。
