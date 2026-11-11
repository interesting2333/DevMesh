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

分配器向 repo MCP 提供实际 `acquire(binding, signal)`。锁覆盖整个工作区动作，项目集成另外获得项目串行准入；顺序固定为项目后工作区，避免互锁。准入回查当前 Host／Grant／ACL、Run／Work epoch、实际 Runner 原 Job 与编辑器状态。仍活动或结果未知时不能获得可写／回收许可。

跨进程或节点的资源 fencing 由拥有目录的 Runner 管理服务实施；只有控制面 SQLite 记录或锁超时不足以释放目录。启动／续租／停止的代际保持与已有 permit 协议一致。未接真实 Runner 时仅启用明确本地、无活动 Job 的测试／开发分配器，保存证据范围。

本地适配组合实际目录的进程文件锁与 Runner SQLite 持久屏障。屏障不自动过期，登记／认领与屏障取得在同一 Runner Worker 串行事务复核；等待、运行、停止中和未知 Job 都阻止取得写许可。取得／释放保留原 operation、完整 permit 依据及 holder token，回复丢失查询原记录。崩溃恢复必须核实本机原持有进程已死亡并提供准确文件锁 token，不能因 Grant 到期或控制面锁超时推断 Git 已退出；实际 Git 子进程 close 之后才释放锁。Runner 返回的物理路径须匹配配置的本地 Runner 根和固定 Attempt repo 子目录。远程目录执行代理仍需单独配置，不以该本地适配代表远程验收。

### Source verification and transfer acknowledgement

接收 resultCommit 时验证原 repo.commit 操作、父链、固定 base、Work 写范围、Git mode、文件／总大小和内容哈希。通过受信任传输适配器导入受控项目仓库，校验对象与树一致后原子建立保留 ref 和原归档操作 ref。Worker ACK 保存准确 commit、tree、源码清单哈希与传输身份。ACK 丢失只查询原 ref 和记录；临时 checkout 保留。

传输和归档不改变接受指针。受控仓库收到对象只是保存事实，开发结果是否可用于当前集成仍需校验当前依赖和控制代际。

### Serialized three-way integration

候选初始为 UserTask.baseCommit。持项目串行准入，读取前候选 SHA 与冻结源 manifest，校验本次输入仍属于当前依赖。使用受控仓库的三方 tree 合并产生候选 tree；禁止外部 merge driver、hooks、自动覆盖选择与可执行属性处理。优先使用本机实际支持的 `merge-tree --write-tree`，能力不足明确拒绝启动该后端。

成功时先保存确定 commit 依据／父 SHA，再以多 ref 事务 CAS 更新候选及原 integration ref；之后提交 Worker 结果。开发分支不更新项目接受指针。并行分支依次整合，发生基础接口变化时重新验证依赖，不以调度时的独立性跳过。

冲突时保存 base／ours／theirs SHA、文件路径、各 stage blob／缺失标记、冲突详情和内容存储引用；原候选保留。冲突材料经 LocalContentStore 哈希验证并建立来源引用后回写 Worker，失败保留原操作待恢复。只有明确新工作／决策解决冲突后才重新准入，不暗中选择一方。

### Verification inputs and safe reclamation

验证分配器只 checkout 固定候选 SHA，并生成有界源码 manifest，开发目录后续变化不影响验证输入。质量报告解释和候选冻结由 P1-06 实现。

回收先确认所有原 Job 已实际退出、必要源码进入受控仓库保留 ref、未提交／未跟踪／恢复材料按清单保存且控制面已持久 ACK。先隔离到 Runner trash 中的原操作目录，再按原 operation 核实删除；最终目标必须解析在对应 workspaces 子树，绝不包含 datasets、项目仓库或根目录。未知／未 ACK 不回收。测试使用专属临时根目录，不清理历史被拒目录。

## Risks / Trade-offs

- Git 动作和数据库不能原子提交 → 原意图、确定对象、原操作 ref、多 ref CAS、持久 ACK 分开记录；未知先核实。
- 生成代码篡改 Git 元数据或路径 → 固定仓库身份、独占 fencing、受控对象导入及文件 mode／路径／范围校验。
- 跨节点资源状态失联 → 保留工作区和锁定事实，停止新写入，通过原 Job／操作恢复。
- 冲突或未跟踪材料体积大／含敏感文件 → 有界批准清单和受控内容存储，超限明确保存失败，不据此回收。

## Migration Plan

在 P1-04 已有迁移之后新增版本，保持历史 SQL／哈希。升级前备份；新后端默认不配置，不自动扫描宿主仓库。回滚应用仍保留工作区、保留 refs、归档正文、SQLite 与 ACK，不降级或覆盖无法识别的新状态。固定提交在干净 Windows checkout 冻结安装后回归；真实远程身份、Linux Runner、runsc 与 T05/T23 保留待环境验收。
