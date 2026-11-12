## Context

依据 D4 §3、D5 §7.2～7.3 和实施 P1-05。现有 input-api 可从精确 Git SHA 取受控模板；repo MCP 有受限提交、原操作 SHA／ref、候选 CAS，依赖部署者提供工作区绑定、独占租约与业务验收检查。Runner 有独立 SQLite 作业、原操作查询、停止及单调时钟租约。尚无受控项目 Git 仓库管理、工作区分配／归档 ACK 和三方集成服务。

当前 Windows Git 为 2.39.2.windows.1；实现时以本机实际能力探测和真实临时仓库验证为依据。控制面、Runner、备份根目录必须继续分开，跨节点不共享可写 `.git`。模型、Runner容器不能获得项目接受指针或控制面目录。

## Goals / Non-Goals

**Goals:** 用真实 Git 和 Worker 事务闭合“准入起点 → 独立 checkout → 验证开发提交 → 受控保存 → 串行候选 → 精确验证输入 → 归档 ACK → 回收”链路，明确每个外部动作的发送与恢复依据。

**Non-Goals:** 在本包判定测试质量或接受 ReleaseCandidate；安装未经批准的软件源／执行模型任意 Git 命令；用本地传输替代远程 Git 身份与 Linux/runsc 验收。

## Decisions

### Repository and workspace ownership

新增 Git Provider 包统一受控 argv、环境、超时、输出大小和 object/ref 校验。项目沿用 D5 的控制面 `repositories/<projectId>/repo.git`，Runner 使用 `workspaces/<attemptId>/repo` 的独立 checkout；分支和 ref 只使用服务端内部 ID。读取精确对象和导入本地对象可在开发模式显式启用本地受控传输。远程适配器只接受部署绑定的 endpoint、服务身份与资源引用，未配置时拒绝，不能自动切到共享路径或裸宿主 shell。

选择独立 checkout／对象传输而不是跨节点 git worktree，是为了让项目仓库接受指针、临时代码和回收权限各自可控。物理 root、Git directory、common directory 在分配时固定；之后身份漂移拒绝。

模板来源仓库的提交不等于生成应用的初始提交。初始化从固定来源 SHA 的批准模板子树取得精确 tree／对象，以确定元数据生成独立初始 commit 并保留模板 ref，记录 sourceCommit／sourcePath／templateVersion。新项目入口配置使用该独立 commit；不能把控制面整个仓库 checkout 到 Runner，也不改写既有 Run 的冻结 base。模板子树之外的对象不进入源码 pack；源码只允许普通文件及显式批准的 `.gitignore`／`.node-version` 等模板配置，仍拒绝 `.env`、密钥路径与链接。

### Durable state and original operations

向前迁移保存项目仓库、workspace allocation、workspace lease、source archive、integration operation、candidate source 和 archive ACK。所有记录带项目／Run／Attempt、原 operationId、请求哈希及冻结 base／writeScope。展示或配置对象不能充当完成记录。

工作区准备采用 PREPARING → READY／RECONCILE／FAILED，原操作先落库，再创建目录／checkout，完成后校验精确 HEAD、目录归属及冻结清单。崩溃恢复查原目录及标识；不把“路径存在”作为 READY，也不覆盖无法证明归属的目录。内存锁只优化同进程，不能替代持久状态。

组合顺序沿用 Scheduler 的只读资源规划：准入固定资源 ID 后由 A2A Host 认领，Runtime 先启动已有 Host 续租，再执行受信任的工作区准备钩子，确认 READY 后才进入模型和工具调用。准备过程中不执行模型指令；未知结果保存原分配记录并进入核实，不能把目录存在当作继续依据。不得为 Git 准备耗时而放宽十五秒窗口，也不得让尚未认领的 Grant 自行续期。项目模板仓库的初始化由受信任入口承担，使用固定生成的应用初始 SHA。

### Exclusive access and Runner coordination

分配器向 repo MCP 提供实际 `acquire(binding, signal, {operationId, permit, purpose})`。锁覆盖整个工作区动作，顺序固定为项目后工作区，避免互锁；上下文来自执行宿主，不作为模型业务参数。准入回查当前 Host／Grant／ACL、Run／Work epoch、实际 Runner 原 Job 与编辑器状态。仍活动或结果未知时不能获得可写／回收许可。

跨进程或节点的资源 fencing 由拥有目录的 Runner 管理服务实施；只有控制面 SQLite 记录或锁超时不足以释放目录。启动／续租／停止的代际保持与已有 permit 协议一致。未接真实 Runner 时仅启用明确本地、无活动 Job 的测试／开发分配器，保存证据范围。

本地适配组合实际目录的进程文件锁与 Runner SQLite 持久屏障。屏障不自动过期，登记／认领与屏障取得在同一 Runner Worker 串行事务复核；等待、运行、停止中和未知 Job 都阻止取得写许可。取得／释放保留原 operation、完整 permit 依据及 holder token，回复丢失查询原记录。崩溃恢复必须核实本机原持有进程已死亡并提供准确文件锁 token，不能因 Grant 到期或控制面锁超时推断 Git 已退出；实际 Git 子进程 close 之后才释放锁。Runner 返回的物理路径须匹配配置的本地 Runner 根和固定 Attempt repo 子目录。远程目录执行代理仍需单独配置，不以该本地适配代表远程验收。

暂停或 Host 结束后的原文件操作核实，使用可选 `purpose=cleanup` 和单独的 `verifyWorkspaceCleanup` 回查原 operation、owner、资源与当前成员权限；它只能取得检查／收尾屏障，不能登记 Job、复活 Grant 或发送新编辑。未配置该权威回查时明确拒绝；缺省 purpose 仍按当前写准入，旧请求 JSON／哈希不补默认字段。`createLocalRepoAcquire` 绑定实际 Attempt repo 路径并按固定顺序组合两种锁；新动作使用 write，原操作核实使用 cleanup。

固定检查点 `ce823fb` 的全量回归在真实 MCP／Runner 屏障用例返回 `RUNNER_FORBIDDEN`，2.1 重新打开核实。MCP 入口准入后的准备过程可能跨越一次 Host 续租；取得新读写屏障时应从原 Host／Grant／资源回查当前 permit，再交给 Runner，不能一直使用早先的请求快照。该回查不自行续租、不延长十五秒执行窗口、不改变 owner／代际／资源；原 cleanup 仍走独立当前成员与原操作权威，不用刷新写权限绕过暂停。修复需用入口通过后旧 permit 到期而同一 Host 当前租约仍有效的确定用例验证。

该补丁已通过类型、lint、构建和完整 Repo Git／文件／Runner 联调 11/11，主动使请求捕获许可过期的真实 Runner 用例通过，2.1 依据开发验证恢复勾选。原始报告及源码指纹保存在 `project/evidence/P1-05/development/fence-refresh-v1/`；新的固定提交全量回归和 5.2 仍需单独完成。

### Source verification and transfer acknowledgement

接收 resultCommit 时验证原 repo.commit 操作、父链、固定 base、Work 写范围、Git mode、文件／总大小和内容哈希。通过受信任传输适配器导入受控项目仓库，校验对象与树一致后原子建立保留 ref 和原归档操作 ref。Worker ACK 保存准确 commit、tree、源码清单哈希与传输身份。ACK 丢失只查询原 ref 和记录；临时 checkout 保留。

传输和归档不改变接受指针。受控仓库收到对象只是保存事实，开发结果是否可用于当前集成仍需校验当前依赖和控制代际。

源码接收只接受 `allocationOperationId` 与原 `commitOperationId`，不接受调用方替换 commit。迁移 15 冻结 READY 分配、项目仓库物理身份及 SUCCEEDED repo.commit 的绑定、准备正文、父起点与范围，状态为 SENT → PREPARED → ACKNOWLEDGED／FAILED。归档属于已执行动作的材料收尾，使用独立 cleanup fencing 和当前成员／原归属回查，可在暂停后保存原提交，不能取得新编辑或 Job 权限。屏障交付前失败尚未开始传输，可登记 FAILED；对象或 ref 动作未知则保留原记录。

本地适配逐次核实目录设备／文件 ID、Git/common directory、原提交 ref、提交正文 SHA-1、唯一父 base、实际 diff 范围和完整源码清单。先持久 PREPARED，再传输有界 pack，目的仓库复核后以多 ref CAS 同时保留 `refs/devmesh/source-archives/<operationId>` 与 `refs/devmesh/sources/<commit>`。ACK 回复丢失先查原 DB；恢复仅查询原 ref／对象／清单，不重复导入或 ref 更新。SENT 或缺原 ref 不能证明成功，阻止同工作区替换归档操作。已确认的源码对象 ACK 不包含未提交／未跟踪／文件 sidecar 材料，不授权删除工作区；完整材料清单及回收门槛在 4.1／4.2 实施。

Git Provider 的固定参数强制 `core.fsync=all`、`core.fsyncMethod=fsync`，覆盖对象、pack／索引和引用，不能继承仓库配置的弱持久化方式。选项按已安装 2.39.2 对应的 [官方配置文档](https://git-scm.com/docs/git-config/2.39.0#Documentation/git-config.txt-corefsync) 核实；命令返回后仍需核实原 ref／对象及 Worker ACK。软件检查不替代底层存储掉电持久性验收。

### Serialized three-way integration

候选初始为 UserTask.baseCommit。持项目串行准入，读取前候选 SHA 与冻结源 manifest，校验本次输入仍属于当前依赖。使用受控仓库的三方 tree 合并产生候选 tree；禁止外部 merge driver、hooks、自动覆盖选择与可执行属性处理。优先使用本机实际支持的 `merge-tree --write-tree`，能力不足明确拒绝启动该后端。

交叉合并历史可能存在多个最佳共同祖先。按 [Git 2.39 的递归祖先合并规则](https://git-scm.com/docs/git-merge-tree/2.39.0)，保留 `merge-base --all` 的完整排序集合并在合并前精确复核，不能任取一个祖先。只有单祖先时才记录单个 base SHA；多祖先由 Git 计算虚拟基点，冲突 stage 1 对象代表该文件的实际基点材料，另保留原祖先集合、ours／theirs 和完整冲突记录。该细节不改变原输入来源、写范围和接受指针权限。

成功时先保存确定 commit 依据／父 SHA，再以多 ref 事务 CAS 更新候选及原 integration ref；之后提交 Worker 结果。开发分支不更新项目接受指针。并行分支依次整合，发生基础接口变化时重新验证依赖，不以调度时的独立性跳过。

集成由受信任项目服务执行，不能拿已结束 Developer 的 permit 发送新的项目写入。Worker 从当前已确认计划、Run／Work epoch、Work revision、最新 Attempt、已核实输出及原源码 ACK 推导输入资格；调用方给出的 SHA 或 artifact 本身不足以授权。Git 动作发送后若发生暂停／换代，仍保存原动作的真实结果，但是否可供当前调度使用需另行复核，不能把历史成功直接当成当前准入。

候选还需保存准确的依赖来源集合。给某个 Work 规划输入时，只能使用与其当前依赖闭包相符的已核实候选；全局最新候选可能包含无关或过期变更，不能静默代替输入。对于显式受控项目后端，Scheduler 从当前来源依据查询匹配的 `work-input` ACK；缺少匹配快照时拒绝准入。未接受控项目后端的既有路径继续保留多个前驱 SHA 的 `CODE_BASIS_AMBIGUOUS` 拒绝。该组合代码已编写，真实联调与回归验证正在执行。

快照准备使用独立的受信任 `prepareCodeBasis` 钩子，保持 `planResources` 只读。准备服务使用当前依据哈希与主体生成稳定的原操作 ID，存在未知操作时只能核实，已知失败需显式受信任重试；不在调度循环内自动换 ID。已有 ACK 也要核实受控仓库身份、原 integration／snapshot refs 与实际源码清单，并在 I/O 后再复核当前来源。Worker 最后在原调度准入事务内查询当前精确快照，不嵌套打开事务，也不接受调用方 SHA 充当输入权威。无开发来源的初始 Work 使用冻结 base；tester 必须具有已核实开发来源。Work 输入快照不移动 Run 全局候选。

实现上区分 `work-input` 与 `run-candidate` 两种受信任请求：前者只取指定 Work 的当前依赖闭包，后者在当前计划的开发结果均核实后取完整开发来源。它们分别保留固定源码快照；Work 输入快照不移动 Run 候选 ref，Run 候选也不移动人工接受指针。冻结依据包含计划及需求版本、当前 Run epoch、Work revision／epoch、最新已结束且核实的 Attempt、输入指纹、成果引用及原源码 ACK；按拓扑从 UserTask.baseCommit 串行构建，来源集合不匹配时不以全局最新值代替。

已完成来源可跨一次单纯暂停保留，但不能直接继承旧执行权限。新的集成请求仍须当前成员和当前 Run epoch 准入，并重新核对该来源的 Work epoch、需求哈希、输入成果、计划决策及代码祖先集合；任何一项变化都拒绝资格。非空接口快照还需已批准接口的当前来源证明；该权威查询尚未接入时，资格实现明确拒绝，不把接口列表存在当成验证通过。

冲突时保存 base／ours／theirs SHA、文件路径、各 stage blob／缺失标记、冲突详情和内容存储引用；原候选保留。冲突材料经 LocalContentStore 哈希验证并建立来源引用后回写 Worker，失败保留原操作待恢复。只有明确新工作／决策解决冲突后才重新准入，不暗中选择一方。

实施时将原集成操作分为 BUILDING → PREPARED → CAS_SENT → ACKNOWLEDGED；每个源步骤也先落意图、再冻结三方结果与确定提交正文／SHA、标记发送、最后核实原保留 ref。项目同一时刻只能有一项未核实集成。每步从 UserTask.baseCommit 按冻结拓扑累计；步骤来源、顺序和原 ref 不接受调用方改写。原动作可能已发送时，恢复只查询冻结对象和原 ref，不重新合并、另建 operation 或选择某一方来绕过未知。Git 子进程退出与准确 fencing 恢复仍是后续动作的前提。

最后的 CAS_SENT 与当前来源资格复核在同一个短 Worker 事务完成。PREPARED 表示尚未发送最终 ref 事务，当前依据变化可关闭为已知失败；BUILDING 仅在没有未核实步骤时可关闭，保留已经 ACK 的历史步骤。CAS_SENT 必须核实原最终 ref，不能用新的当前依据直接宣布成功或失败。最终多 ref 事务同时保留原 integration 和固定 snapshot ref，仅 `run-candidate` 更新 Run 候选。持久物理候选 head 和当前业务资格分别保存；未经本后端 ACK 的既有物理 ref 不自动接管或覆盖。

冲突材料需要专用的内容 target／reference，`commitObjectWrite` 在登记内容的同一 Worker 事务写入带 `content_objects` 外键的业务引用，避免“先裸写 content、再单独建引用”期间 GC 获准删除。先冻结报告描述及哈希，再按有界页登记不可变材料元数据、稳定写入 UUID 和字节哈希；全部必要材料 READY 或明确 ABSENT 后才确认冲突 ACK。内容登记失败保留原操作和原材料，不能推进候选。批准主体与当前非 viewer 成员参与写入复核，读取仍按当前项目成员校验；历史 ACK 不授权新集成。

报告保存安排在步骤的 COMPUTING 意图之后、冻结三方结果之前。内容封装保存完整 Git 报告和原 stage 1 blob 字节，后者可能来自不属于任一原祖先提交的虚拟基点；仅保存 blob SHA 而无保留对象或字节不足以保证恢复。封装字节哈希和规范化合并报告哈希分别记录，虚拟 blob 按 Git 对象 ID 复核并限制体积。报告已经持久保存时可从原内容对象或经哈希核实的原 staging 继续准备；尚未保存的计算结果保持未知，不重新执行 merge-tree。文件／目录／缺失材料按原来源 tree、消息与 stage 路径并集生成，目录有准确 tree 对象身份，缺失不伪装为零字节文件。报告和各版本内容仍沿用批准的 `artifacts/sha256` 与 `staging/objects` 布局，不增加独立的数据根目录。上述迁移 17、内容适配及完整冲突 ACK 代码已编写，正在执行类型、构建、原子引用、ACL 与真实冲突恢复验证；验证前不作为已完成能力归档。

真实 Git 探测已经证明，合法的互斥路径范围也会产生冲突：来源 A 将 `old/a` 移至 `new/a`，来源 B 新建 `old/b` 和 `new/b`，两者改动路径没有重叠；本机 `merge-tree` 返回 `CONFLICT (file in way of directory rename)`，包含 `new/b`／`old/b` 两个消息路径，却没有 stage 条目。因此材料收集必须遍历消息与 stage 路径的并集，另查每个原 base／ours／theirs tree 中的实际文件、目录或缺失，并保留虚拟基点的 stage 1 blob。不能把“无 stage”当成“无冲突”，也不能把缺失版本当成零字节文件。该探测仅证明夹具成立，后续持久集成和内容 ACK 验证尚未完成。

### Verification inputs and safe reclamation

验证分配器只 checkout 固定候选 SHA，并生成有界源码 manifest，开发目录后续变化不影响验证输入。质量报告解释和候选冻结由 P1-06 实现。

回收先确认所有原 Job 已实际退出、必要源码进入受控仓库保留 ref、未提交／未跟踪／恢复材料按清单保存且控制面已持久 ACK。源目录只允许原 `workspaces/<attemptId>` 父目录，隔离目标只允许同一 Runner 数据根下 `trash/<原operationId>`，再按原 operation 核实删除；分别解析并检查这两个固定边界，绝不包含 datasets、项目仓库或数据根目录。未知／未 ACK 不回收。测试使用专属临时根目录，不清理历史被拒目录。

完整保存清单与源码对象 ACK 分开。迁移 18 和本地保存适配正在实施：冻结原分配、原主体、全部已知提交及各自源码 ACK、文件操作／cleanup 事实；保存前后复核当前冻结依据与实际目录身份。没有成功提交的失败开发或固定验证 checkout 仍需保留其准确 base，使用原保存操作的受控保留 ref；不能把 repo.commit 的源码 ref 当成 checkout HEAD（本实现 HEAD 仍是准入 base）。只允许已知分配／Attempt 分支／原提交 refs，额外 ref 或与 base 不同的暂存区阻止完整保存，避免丢掉仅位于 Git 元数据中的材料。

实际扫描覆盖原 Attempt 父目录中的普通源码、Git 忽略及未跟踪文件、tmp 和 `.devmesh-file-operations` 恢复副本，记录内容 SHA-256、大小、模式、物理文件身份、时间戳和必要缺失标记。目录链接、外部硬链接、敏感路径、特殊文件和超限内容明确拒绝且保留原目录；内部硬链接仅在所有链接均在完整清单中时允许。固定排除项只有经受控 refs 核实的 `repo/.git` 与源码树中的可重建 node_modules，每项进入清单；被跟踪源码落入排除项则拒绝，不静默遗漏。限制为 8,000 项、单文件 2 MiB、总逻辑内容 128 MiB、清单 8 MiB。外部 Runner job-outputs、datasets、控制面仓库和独立 Git scratch 不随本工作区回收。

完整保存清单和每个必要文件使用专用内容 target，在内容登记的同一 Worker 事务建立不可变业务外键引用；所有字节 READY 并核实受控保留 refs、原目录及原清单后才提交完整 ACK。Runner 再按原 operation 保存并 fsync 独立 receipt，上传成功本身不等于该 receipt。PREPARED 恢复只观察原 Git ref 并续接原对象写入 UUID，不重放 Git ref 更新；缺原保留事实、原字节漂移或未核实结果保持未完成，不替换操作。取得回收屏障时再次核实 ACK、当前主体、原清单、内容可用性及 receipt；未知或未完成 cleanup 的文件操作／恢复目录仍阻止回收，保存字节不将其转换成执行或删除权限。本节代码和清单预检尚未通过应用层完整验证，4.1、4.2 保持未完成。

回收步骤 4.2 的后续实现将冻结完整保存 ACK、原 Attempt 父目录、唯一隔离目录及物理目录身份，并记录 PREPARED → ISOLATION_SENT → ISOLATED → DELETE_SENT → DELETED。隔离／删除意图和实际事实分别有 Runner 本地 fsync receipt，保存在 Attempt 之外；丢回复只核实原操作。首次移动要求完整清单一致，删除恢复允许原条目因部分删除而缺失，但每个剩余条目的路径、身份、内容和模式仍须符合原清单；内部硬链接允许因 unlink 减少链接数，新增外部链接、未知材料、内容变化或替换根目录均拒绝继续删除。DELETED 重放返回原事实，绝不删除后来复用路径的新目录。

删除准入还需原执行 Grant 明确 REVOKED，并持有项目及工作区的实际屏障；租约过期或一次“无 Job”查询不能代替该准入关闭。默认从已满足持久 ACK 和撤销准入条件、首次建立原回收记录之后额外保留 24 小时；本地测试显式设为 0。维护授权允许验证 checkout 原资源为只读，仍要求原所有者和当前项目非 viewer 身份，不能据此恢复执行写入。统一维护授权适配将分别核实分配、repo、源码保存、完整保存和回收的原操作；没有受认证的维护后端时保持关闭。这些回收与组合代码目前仍在草案阶段，残余材料草案预检 8/8 不代表 4.2 或 5.1 已实现或通过验收。当前适配限于显式 local-development，同机目录和本机路径语义；跨节点／跨操作系统不共享宿主绝对目录，仍需 Runner 管理协议和真实远程身份验证。

## Risks / Trade-offs

- Git 动作和数据库不能原子提交 → 原意图、确定对象、原操作 ref、多 ref CAS、持久 ACK 分开记录；未知先核实。
- 生成代码篡改 Git 元数据或路径 → 固定仓库身份、独占 fencing、受控对象导入及文件 mode／路径／范围校验。
- 跨节点资源状态失联 → 保留工作区和锁定事实，停止新写入，通过原 Job／操作恢复。
- 冲突或未跟踪材料体积大／含敏感文件 → 有界批准清单和受控内容存储，超限明确保存失败，不据此回收。

## Migration Plan

在 P1-04 已有迁移之后新增版本，保持历史 SQL／哈希。升级前备份；新后端默认不配置，不自动扫描宿主仓库。回滚应用仍保留工作区、保留 refs、归档正文、SQLite 与 ACK，不降级或覆盖无法识别的新状态。固定提交在干净 Windows checkout 冻结安装后回归；真实远程身份、Linux Runner、runsc 与 T05/T23 保留待环境验收。
