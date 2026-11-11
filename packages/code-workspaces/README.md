# Managed code workspaces（实施中）

`ControlledGit` 目前提供固定 Git 操作：独立 bare／checkout 初始化与绑定、精确 commit／源码清单、有界 pack 对象传输、固定 SHA checkout 和 `refs/devmesh/` 多 ref CAS。每次动作复核物理目录、设备／文件 ID、Git directory／common directory；拒绝外部 filter／merge helper、对象 alternates、符号链接源码、敏感路径和越界体积。它不开放调用方 argv、仓库 URL、shell 或共享可写 `.git`。

传输使用受控 pack-objects／index-pack，目的仓库重新校验 commit、tree、文件 SHA-256 与大小；它没有更新业务接受指针。目录只能在明确空闲且受信任的所有权／fencing 下使用，Provider 本身不能代替 Runner 作业准入或数据库 ACK。

迁移 13 和 Worker 命令保存项目仓库及工作区的原操作、准入代际、base、写范围、清单和物理目录身份。`LocalManagedWorkspaces` 仅在明确 `local-development` 模式和部署者提供实际 fencing 时可构造；项目目录为控制面 `repositories/<projectId>/repo.git`，独立 checkout 为 Runner `workspaces/<attemptId>/repo`。准备先落库，未知目录拒绝接管，READY 目录丢失拒绝重建；恢复查询与继续写入分别检查，暂停后不因原操作存在就允许继续 checkout。源码清单有 192 KiB 上限，以适配 Worker 消息限额。

v9 中 Git／Worker／本地分配验证 10/10、存储 28/28 通过。v11 新增内部 Attempt 分支与分配 1/1、Runner 持久屏障 3/3，通过日志与源码指纹已保存。本地实际目录的进程文件锁与 Runner v2 持久屏障共同排除写入；等待、活动、停止中或未知 Job 都阻止取得屏障，屏障也阻止新作业登记／认领，不以超时自动解锁。回复丢失只查询原记录；死进程恢复需准确文件锁 token。Runner 的实际路径必须匹配本地配置根，Git 子进程 close 之后才可释放许可。该适配只接受本机 Runner，不能替代远程执行代理。

`createLocalRepoAcquire` 将 repo MCP 的原 operation／permit 接入实际锁：验证固定 Attempt repo，项目后工作区取得，按相反顺序释放。原操作恢复使用 Runner 的 cleanup 屏障，要求单独的当前成员／原归属权威回查；不取得新 Job 或编辑权。文件联调 v8 5/5、屏障 v7 5/5 已通过，包含真实子进程 SIGKILL 后准确 token 恢复。日志、源码指纹及历次失败见 `project/evidence/P1-04/development/file-validation.json`；最终固定提交全量回归仍需单独执行。

repo MCP 已完成本地实际锁组合；调度准备、源码归档 ACK、三方候选集成、冲突内容、验证分配和安全回收仍按 `implement-managed-code-workspaces` 的未完成任务推进。默认平台与 CLI 尚未启用该后端；本地 Git 检查不代表远程身份、Linux/runsc 或 T05/T23 验收。
