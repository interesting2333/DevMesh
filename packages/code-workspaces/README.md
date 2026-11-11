# Managed code workspaces（实施中）

`ControlledGit` 目前提供固定 Git 操作：独立 bare／checkout 初始化与绑定、精确 commit／源码清单、有界 pack 对象传输、固定 SHA checkout 和 `refs/devmesh/` 多 ref CAS。每次动作复核物理目录、设备／文件 ID、Git directory／common directory；拒绝外部 filter／merge helper、对象 alternates、符号链接源码、敏感路径和越界体积。它不开放调用方 argv、仓库 URL、shell 或共享可写 `.git`。

传输使用受控 pack-objects／index-pack，目的仓库重新校验 commit、tree、文件 SHA-256 与大小；它没有更新业务接受指针。目录只能在明确空闲且受信任的所有权／fencing 下使用，Provider 本身不能代替 Runner 作业准入或数据库 ACK。

迁移 13 和 Worker 命令保存项目仓库及工作区的原操作、准入代际、base、写范围、清单和物理目录身份。`LocalManagedWorkspaces` 仅在明确 `local-development` 模式和部署者提供实际 fencing 时可构造；项目目录为控制面 `repositories/<projectId>/repo.git`，独立 checkout 为 Runner `workspaces/<attemptId>/repo`。准备先落库，未知目录拒绝接管，READY 目录丢失拒绝重建；恢复查询与继续写入分别检查，暂停后不因原操作存在就允许继续 checkout。源码清单有 192 KiB 上限，以适配 Worker 消息限额。

v9 中 Git／Worker／本地分配验证 10/10、存储 28/28 通过。v11 新增内部 Attempt 分支与分配 1/1、Runner 持久屏障 3/3，通过日志与源码指纹已保存。本地实际目录的进程文件锁与 Runner v2 持久屏障共同排除写入；等待、活动、停止中或未知 Job 都阻止取得屏障，屏障也阻止新作业登记／认领，不以超时自动解锁。回复丢失只查询原记录；死进程恢复需准确文件锁 token。Runner 的实际路径必须匹配本地配置根，Git 子进程 close 之后才可释放许可。该适配只接受本机 Runner，不能替代远程执行代理。

`createLocalRepoAcquire` 将 repo MCP 的原 operation／permit 接入实际锁：验证固定 Attempt repo，项目后工作区取得，按相反顺序释放。原操作恢复使用 Runner 的 cleanup 屏障，要求单独的当前成员／原归属权威回查；不取得新 Job 或编辑权。文件联调 v8 5/5、屏障 v7 5/5 已通过，包含真实子进程 SIGKILL 后准确 token 恢复。日志、源码指纹及历次失败见 `project/evidence/P1-04/development/file-validation.json`；最终固定提交全量回归仍需单独执行。

repo MCP 已完成本地实际锁组合，源码对象归档已有开发验证；调度准备、三方候选集成、冲突内容、验证分配和完整材料回收仍按 `implement-managed-code-workspaces` 的未完成任务推进。默认平台与 CLI 尚未启用该后端；本地 Git 检查不代表远程身份、Linux/runsc 或 T05/T23 验收。

`LocalSourceArchives` 与迁移 15 实现源码接收：输入仅含原分配／提交操作，核实唯一父 base、范围、实际对象及目录身份，传输后保留原操作 ref 和固定源码 ref，再写 Worker ACK。恢复只查原事实，未知不重传；使用本地 fencer 的 cleanup，部署者须用 `getSourceArchive` 核实原归属与资源。源码 ACK 不包含未提交、未跟踪和文件恢复 sidecar，不能授权回收。v2 开发驱动归档 4/4、受控 Git 5/5、存储 28/28 和类型／lint／构建通过，原始证据见 `project/evidence/P1-05/development/source-v2/`。这组测试使用明确无 Job 的受控 fencer，不能替代 Runner 或固定提交验收。

Provider 固定 `core.fsync=all` 和 `core.fsyncMethod=fsync`，使对象、pack 元数据和保留 ref 使用 Git 的持久化路径；按 [Git 2.39 配置](https://git-scm.com/docs/git-config/2.39.0#Documentation/git-config.txt-corefsync) 选择，不沿用仓库的弱 flush 配置。提交正文沿用原准备契约的 10000 个 UTF-16 字符上限，允许原提交工具接受的中文消息；实际 JSON／传输仍有各自字节上限。新增参数与归档实现已通过上述软件验证，未执行底层存储掉电测试。

三方集成底层 `mergeTree`／`writeCommit` 核实精确共同祖先集合与实际提交，解析 Git 的 NUL stage／冲突消息，保留三方 SHA，生成确定提交对象，并沿用多 ref CAS。五条真实 Git 用例已通过，覆盖独立分支、同文件冲突、删除冲突、旧 CAS、固定验证 checkout 和交叉历史中的虚拟基点；既有 Git 5/5 及存储 28/28 回归通过。类型、lint、构建和原始日志见 `project/evidence/P1-05/development/integration-v1/`。持久集成日志、冲突内容发布及调度组合仍待实施，3.1／3.2／3.3 保持未完成。

Worker 的 `candidate-basis.ts` 提供当前来源资格推导及只读 `getCandidateSourceBasis`／`assertCandidateSourceBasis` 命令：从已确认计划、当前 Work／需求／输入、最新核实结果及原源码 ACK 冻结精确来源集合，分别支持 Work 输入依赖闭包与完整 Run 候选；不接受调用方提供 SHA 作为资格。七条数据库资格用例已通过，来源 ACK 使用明确的数据库夹具，验证范围与真实 Git 用例分开记录。尚未接持久集成服务和调度准入；非空接口快照的批准来源查询仍待实现，当前代码对此明确拒绝。持久集成快照尚未实现时，无法证明来源集合的合成 SHA 也明确拒绝。

后续迁移 16 及 `candidate-integration-domain.ts` 已编写候选持久操作、顺序步骤、当前依据复核、确定提交正文、一次发送、原 ref ACK 与物理候选 head；新的来源资格查询使用已 ACK 快照的精确来源证明。Work 输入快照不修改 Run 候选，任一候选都不修改接受指针。完整依据与源码清单分别读取，避免将两个大对象拼进单条 Worker 响应。九条数据库操作用例及原七条资格用例共 16/16、既有存储 28/28 通过，类型／lint／构建与迁移日志见 `project/evidence/P1-05/development/journal-v2/`；其中 Git/ref/ACK 为明确数据库夹具，不能当成真实 Git 集成或冲突内容发布通过。3.1～3.3 仍未完成，默认后端仍关闭。

`ce823fb` 的干净固定提交全量回归在 MCP Runner 屏障用例失败：前十二项通过，MCP 34/35，后八项未执行。原始证据见 `project/evidence/P1-04/windows-ce823fb-incomplete/`，2.1 已重新打开。当前补丁在新读写屏障前重新查询并校验当前许可；原操作 cleanup 仍使用独立恢复权威和原编辑 ID，不续期过期的 Host 授权。确定性用例主动使已准入请求的捕获许可过期，检查真实 Runner 收到当前许可；补丁已通过类型、lint、构建及全部 Repo Git／文件／Runner 联调 11/11，证据见 `project/evidence/P1-05/development/fence-refresh-v1/`。2.1 已依据开发验证恢复勾选，最终固定提交全量回归仍未完成。
