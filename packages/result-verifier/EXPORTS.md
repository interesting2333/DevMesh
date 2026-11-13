# 已验收版本交付包

这是 P1-07 的独立导出实现。创建、查询、重试、打包和下载均不调用验收、发布、Runner、迁移或模型，也不改变项目的 accepted 指针。通用会话回放、导入、业务库备份及完整默认应用装配继续按各自工作包实施。

## HTTP

现有 Input API 的可信 IdentityResolver 决定当前成员；默认无身份仍拒绝访问。

| 方法与路径 | 行为 |
| --- | --- |
| `POST /api/v1/releases/{releaseId}/exports` | JSON `{ "format": "zip" }`，需要 `Idempotency-Key`；202 返回持久 job，未开始打包 |
| `GET /api/v1/releases/{releaseId}/exports` | 当前成员列出原任务；可用 `limit=1..200`、`afterExportId`，恢复创建回执丢失后的查找 |
| `GET /api/v1/exports/{exportId}` | 当前状态、固定版本、截止点及 archive hash/size，无副作用 |
| `POST /api/v1/exports/{exportId}/retry` | 原创建者、JSON `{ "expectedGeneration": 1 }`；仅失败或租约超时可重新排队，仍是原材料 |
| `GET /api/v1/exports/{exportId}/download` | 仅 READY，每次重新验证成员，返回固定 ZIP attachment；不支持 Range |

公共响应不含 claim token、仓库路径、完整 snapshot 或原执行权限。历史已验收 Release 可导出，不要求它仍是当前 accepted 版本。下载过程中移除成员无法撤回已送出的字节，后续下载会被拒绝。

## 显式宿主接入

```ts
import {ReleaseExporter} from '@devmesh/result-verifier';
import {LocalReleaseExportSources} from '@devmesh/code-workspaces';

const exporter = new ReleaseExporter(contentStore,
  new LocalReleaseExportSources(controlDataRoot));
await exporter.advance(originalCreatorPrincipalId, exportId, shutdownSignal);
```

API 的 POST 只排队，GET 不隐式启动。一个 exporter 实例最多同时处理两个不同任务，相同主体/job 合并正在处理的调用；跨实例由控制 SQLite claim 串行。PACKING 的 generation/token/两分钟租约约束材料读取与归档写入，过期者不能完成引用提交。失败可按原任务重试；首次准备的 archive manifest/hash/size 不再变化。已注册内容丢 ACK 先查询 READY。原创建者已被移除时不继续读取，其他当前成员可创建自己的独立导出任务。

## 平台自动消费与恢复

已有持久 storage 的服务器配置可增加以下字段，无须模型或 Runner：

```json
{
  "releaseExports": {
    "enabled": true,
    "pollIntervalMs": 1000,
    "maxConcurrentJobs": 2,
    "maxJobsPerPass": 32
  }
}
```

完整配置参考 [server.release-exports.example.json](../../config/server.release-exports.example.json)。它只增加本地消费，不自动开启身份或 Input API；创建/下载仍须原 Input API 和可信 IdentityResolver。`enabled` 必须明确，缺省或 false 关闭消费者；无持久 storage 启动失败。轮询间隔100～60000ms，并发1～2，每轮1～200项。可在可信程序化宿主使用 `ReleaseExportScheduler(content, sources, options)`，通过 `start()`/`stop()` 管理，或用合并的 `tick()` 做有界单轮处理。

消费者私有分页扫描当前成员创建的 QUEUED，及两分钟租约已过期的原 PACKING；后者按原 generation CAS 重新排队。原快照/清单不变，不消费活跃 PACKING、普通 FAILED 或 READY，不重复验收/发布/迁移。普通失败只有显式 retry 才再消费；崩溃任务在原租约过期前保持 PACKING。新进程无需内存登记便能找回原作业。成员撤销后作业不再扫描，正在打包的后续材料读取及提交也拒绝，未完成原租约保留供准确恢复。

停止平台先关闭 Input API 准入，然后取消并等待当前打包退出，最后关闭存储。每次打包有90秒协作取消信号；如果底层调用未返回，不提前释放实例并发或宣称已经排空，硬退出按原租约恢复。`lastError` 仅保留固定错误码。启动完整性检查照常生效：已登记内容缺失会阻止整个宿主启动，须恢复原内容后启动；不能把导出自身 FAILED 处理理解成绕过存储完整性检查。

## 包内内容及边界

`manifest.json` 给出 accepted Release、原候选/manifest/SHA、需求和计划版本、检查配置和模板版本、控制事件截止 seq、材料数量及逐文件 SHA-256/size/原 hash/转换方式。`records.json` 是同一事务冻结的实际需求/计划、原检查配置正文、attempt role 配置、质量/验收回执、事件、A2A 历史和工具/仓库操作摘要及每会话实际消息截止游标。`artifactIndex` 将原 evidence/output/promptArtifactId 连接到包内材料；原角色提示词、用户消息及其附件也保留固定引用。原消息、提示词、运行说明、协作记录和生成配置以 JSON 值净化后导出。

`source/` 来自原受控 bare Git commit 和精确 manifest，包含已追踪 lockfile/migration 等源文件，保留 executable mode。`delivery/` 保留原构建/OCI 镜像/数据策略材料，`quality/` 和 `artifacts/` 保留原正式引用材料。文件的 `.bin` 扩展表示不自动执行的原始内容；具体用途及哈希见清单。它不是 `docker load` 格式，也不会启动应用。

平台结构化记录删除凭据、票据、权限和推理字段；文本执行固定 Bearer、私钥、已知 key 模式净化。原项目源码/构建/镜像是经该项目授权的交付物，保持原字节；此实现不是任意源文件秘密扫描器。业务数据、平台运行权限、模型 request/response 与私有推理明确不进入包。`COMPLETE_WITHIN_SCOPE` 只表示上述固定交付范围完整，不表示可重放平台或已完成物理部署验收。

ZIP32 STORE 不解压、不执行；固定时间、UTF-8 名称、CRC32，最多 20,000 项、每项64 MiB、包200 MiB，内部累计材料190 MiB，manifest192 KiB，控制 snapshot240 KiB。源码沿用受控 Git 的2,000文件/单文件2 MiB/总8 MiB边界；记录集合各最多2,000项。超限明确失败，不静默截断。路径拒绝遍历、绝对路径、软链接、子模块、Windows设备名、大小写/Unicode/父文件冲突。

缺失或损坏文件令当前导出失败，不改变接受状态。内容库将坏对象标 MISSING；恢复必须找回原字节、通过 CAS 原哈希/大小校验并重新登记，不能只修改数据库 READY。随后 retry 仍使用原 snapshot；本实现不会重新执行工作来弥补丢失材料。
