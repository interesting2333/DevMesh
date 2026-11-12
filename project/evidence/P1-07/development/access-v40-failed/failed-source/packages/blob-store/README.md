# 本地内容与会话存储

P0-04 使用 Node 文件系统与 `@devmesh/storage-sqlite`，不增加原生扩展。`LocalBlobProvider` 负责字节；`LocalContentStore` 负责写入阶段、授权引用和维护互斥；`SessionStore` 负责 Attempt 会话、消息、模型步骤、上下文和 JSONL 投影。迁移 4 追加至现有数据库，当前共 39 张表。

## 初始化与配置

先 build，再明确初始化；常规启动不隐式创建存储：

```powershell
corepack pnpm@11.28.5 storage:init --config config/server.local.json
corepack pnpm@11.28.5 storage:verify --config config/server.local.json
node apps/server/dist/main.mjs --config config/server.local.json
```

配置示例（本机路径按部署修改）：

```json
{
  "host": "127.0.0.1",
  "port": 3210,
  "storage": {
    "dataRoot": "D:/DevMeshData/control",
    "runnerDataRoot": "D:/DevMeshData/runner",
    "backupRoot": "E:/DevMeshBackup",
    "mode": "local",
    "initialize": false,
    "minimumFreeBytes": 67108864
  }
}
```

数据、Runner 和备份根目录不能相同或互相包含。所有现有祖先检查 lstat／realpath，拒绝 symlink、junction、共享 UNC 和误配文件；物理对象只使用受控相对键。路径中不使用用户文件名或外部 contextId。部署方负责目录账户及 Windows ACL，未宣称防御拥有该目录写权限的本机管理员。

`DEVMESH_DATA_ROOT`／`DEVMESH_RUNNER_DATA_ROOT`／`DEVMESH_BACKUP_ROOT` 覆盖文件字段；本地相对值锚定配置文件目录，共享模式要求显式绝对路径。无配置文件时本地默认相对于启动目录，实际路径及来源由启动日志记录。存储是可选组合；没有 storage 字段／DATA_ROOT 环境变量时沿用仅 HTTP 基础模式。

布局见 D5 §7：`db/`、`artifacts/sha256/xx/hash`、`repositories/`、`views/`、`staging/`、`logs/`、`cache/`、`manifests/backups/`、`locks/`、`trash/`。storage-layout.json 固定 UUID、layoutVersion=1、nodeKind=control 和创建时间，与 DB 身份交叉校验。未知非空根拒绝采用；已有完成标记缺 DB 时，即使传 initialize 也不重新建空库。

初始化先保存专用 initializing 标记。空间不足等失败后，仅显式 storage:init 可按该标记继续同一身份；常规启动拒绝半成品。完成 DB 后才原子发布正式 layout 标记。目录布局版本与 SQL schema 版本独立。

节点锁为 `<dataRoot>.node.writer.lock`，覆盖布局、Worker、恢复和所有会话服务。正常关闭排空 Worker 后释放。崩溃先核实原 PID 已退出，再将原节点 token 配置到 storage.recoveryToken；恢复过程还核实旧 DB 锁。活动 PID 或未知 guard 不自动接管，不按锁年龄删除。不要将恢复 token 写入提交配置。

## 保存与恢复

1. beginObjectWrite 在 DB 保存操作键、主体／scope、目标、期望大小和 hash，返回稳定 writeId。
2. Provider 将流写到同卷 staging，按块核对大小、流式 SHA-256 并 fsync；失败没有 READY 引用。
3. 通过排他 hardlink 发布不可覆盖的内容，已有同 hash 文件先校验；然后清理 staging。目录同步按平台实际能力记录。
4. seal／commit 短事务保存 READY 内容、附件／消息／模型步骤／上下文引用和 operation 成功结果。

文件发布后提交失败，完整对象和 SEALED 操作保留。原键重试或 recoverPublished 核实相同内容后完成唯一索引，不重调模型或工具。只有 .part 的接收不会被后台当作已保存；同键显式重传可复用已核实完整 staging。不要直接调用旧 registerContent 代替此流程，那个入口仅为可信元数据／兼容夹具保留。

内容 hash／大小错误或丢失会记录 MISSING 和错误，阻断读取；不会造空文件或读旧 views 补齐。对缺失字节的恢复须显式重新发布核实内容或从备份恢复；损坏的同名文件不自动覆盖。`storage:verify` 对缺失返回非零退出码；HTTP 可选存储组合在完整性失败时不开 readiness。

对象字节不经过 Worker。读入口必须传 principalId 和 attachment/message/artifact/context/model-step 引用，由 DB 解析真实归属，再对已打开文件描述符核实字节并返回流。hash 不是下载凭据；共享去重不共享权限。当前主体校验使用项目 owner／附件 owner；真实企业身份和 project_members 在后续模块接入。

读操作保留 ACTIVE pin，流关闭后释放；过期时间不自动解除未知活跃读保护。节点独占启动后回收旧进程读 pin。deleteUnreferenced 仅是可信维护 primitive：DB 核实所有真实内容外键、活动写入和 pin，先置 DELETING，再删字节和元数据；新引用不能穿过 DELETING。完整保留策略、GC operation、归档和授权维护 API 仍属于 P2-07，当前不自动清理业务资料。

## 会话与模型步骤

一个 Attempt 一个稳定工作流 session，新 Attempt 新 session；不接受任意 Run/session 混用。Invocation 的独立会话随 P2-06 的真实宿主表建立，不用通用无外键字段冒充。

消息按会话内连续 seq 追加，clientMessageId 与操作键分别去重，正文不可改写。工具消息关联 stepNo＋toolCallId，完整模型回复尚未持久化时拒绝追加工具记录。上下文 manifest 固定同会话消息顺序／hash、角色快照、throughMessageSeq 和 configHash；未压缩上下文列全消息，超过 200 条须显式形成有来源的 summary，不静默丢弃历史。

模型请求先 PREPARED，可单独标 SENT；重启保留 SENT，不能在原请求未核实前跳到下一步。回复／中断片段形成不可变响应和 assistant 消息。此包只保存事实，Runtime 决定是否继续；没有执行模型或工具的隐式重试。模型载荷拒绝认证字段、Cookie、内部思维等对象字段；业务原文作为消息／附件保留，不改写原件。

JSONL 投影只从 DB 和授权正文生成，manifest 有源游标、生成时间、hash 和归属。临时文件 fsync 后替换 transcript，最后替换 manifest；二者切点可按 hash 识别，投影不参与恢复。删除／手改 views 后重新生成不影响历史。

## 验证和适用范围

`pnpm test:content` 使用真实文件、SQLite、Worker、HTTP 组合、CLI 和实际被杀子进程，覆盖 stage／publish／commit 切点、DB 回滚、重启、权限／路径、缺失与阅读投影。`pnpm test:storage` 包含 3→4 升级和旧批次完整性回归。

Windows 可能不支持目录 fsync，此时明确返回 directorySync=unsupported；文件 fsync、不可覆盖发布和进程崩溃恢复仍执行验证。测试不等于磁盘断电认证，也不代表 Windows ACL、企业身份、真实 DeepSeek 或 Docker/gVisor 已通过。本轮按用户要求独立于这些暂缺资源持续实现。
