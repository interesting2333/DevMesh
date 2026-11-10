# SQLite 存储基础（P0-03／P0-04）

`@devmesh/storage-sqlite` 使用 Node 24.13.1 内置 `node:sqlite`，由单个 Worker 持有业务连接。公开入口是 `openStorage`、`SqliteStorage`、`StorageError` 和从严格 schema 推导的请求／响应类型。运行时不读取设计样例 SQL，不接受任意 SQL 或事务回调。已有真实迁移 CLI 和可选 HTTP 持久存储组合，A2A 消费者按后续工作包接入。

## 正式迁移

| 版本 | 范围 | 说明 |
| --- | --- | --- |
| 1 | store_metadata、content_objects | store UUID、layout=1、内容元数据；管理器另建 schema_migrations |
| 2 | 设计核心 24 表 | 项目／任务／Run、需求／计划／工作版本、operation、Attempt／槽位、event／Outbox、A2A／工具／Runner、成果／交付关系 |
| 3 | 5 张前置表及加强约束 | input_messages、role_snapshots、plan_confirmations、execution_grants、content_write_operations |
| 4 | 7 张内容与会话表 | object_write_operations、attachments、agent_sessions、session_messages、model_steps、context_snapshots、storage_pins；内容校验时间／错误字段及只追加约束 |

当前版本 4，共 39 张表。DB-A／DB-B 核心及 P0-04 会话存储正式建表已交付；其余 DB-C～DB-F 后续扩展。实际字节与根布局由 [blob-store](../blob-store/README.md) 组合，不把建表等同于完整授权或注册中心实现。

SQL 与 manifest 的 SHA-256 一同提交，已发布批次不得修改。启动核对文件、连续历史、名称、校验和、user_version 和 store/layout；拒绝未知库、未来／缺段／被改写历史与降级。每批 BEGIN IMMEDIATE，DDL、数据、历史和版本标记原子提交；失败只回滚当前批次，保留此前已提交批次。连接开启 WAL、外键、synchronous=FULL、5 秒 busy timeout；启动运行 quick_check／foreign_key_check。业务事务同步执行，禁止返回 Promise，不跨网络／文件／模型 await。

## 使用与维护

构建后使用；数据库父目录和独立备份目录由部署方明确创建。路径必须为本机绝对路径，不支持共享文件系统或软／硬链接数据库；完整 dataRoot marker 和跨根布局在 P0-04 接入。

```powershell
corepack pnpm@11.28.5 build
# 换成实际目录和新生成的 store UUID；已有文件不能覆盖。
node scripts/db-migrate.mjs --db D:/devmesh-data/db/devmesh.sqlite --store-id 8f31365a-8a41-41e3-a2da-a6f8c57a0637 --create
# 检查已有库；升级必须指定独立、已存在的备份目录。
node scripts/db-migrate.mjs --db D:/devmesh-data/db/devmesh.sqlite --store-id 8f31365a-8a41-41e3-a2da-a6f8c57a0637 --backup-dir D:/devmesh-backups
```

CLI 成功输出 JSON，关闭 Worker、释放锁后退出；失败非零退出，没有默认数据库路径。`--target 1|2` 用于版本夹具和维护验证，部分版本只允许 inspect。

已有 1／2／3 库升级前通过 SQLite backup API 生成独立 .sqlite 文件，切为 DELETE journal 并检查完整性，避免遗漏 WAL 旁文件。升级结果返回 backupPath。此备份只覆盖数据库；全平台会话／Git／Runner 协调备份属于 P3-06。回退须停写、在隔离目录检查备份后恢复，或添加前向修复，不运行逆向删表脚本。

数据库旁 `.writer.lock` 记录本机 hostname、PID、token，Worker 和维护 CLI 共用。正常关闭释放，另一活动实例拒绝打开。崩溃后核实进程退出、读取原 token，用 `--recover-lock <token>` 或 recoveryToken 显式恢复；代码仍复核 PID 死亡，不凭年龄接管。`.guard` 防止并发恢复；遗留 guard／损坏锁须停掉相关实例后离线检查，不能运行中直接删锁。

```ts
import { openStorage } from '@devmesh/storage-sqlite';
const storage = await openStorage({ databasePath, storeId });
try {
  const facts = await storage.request('inspect', {});
  const original = await storage.request('lookupOperation', {
    principalId, scopeId, idempotencyKey,
  });
  // 根据原结果响应或继续核实，不因超时重新分配 operation/Attempt。
} finally {
  await storage.close();
}
```

## 事务与接入边界

| 入口 | 已实现行为 | 后续接入职责 |
| --- | --- | --- |
| registerContent | 幂等登记 READY 元数据及大小冲突校验 | P0-04 BlobStore 先持久化／校验字节，不能直接登记用户声称的 hash |
| createProjectWithRun | 项目／task／Run／请求 artifact／输入／operation／event／Outbox 原子提交，既有项目 owner 校验 | API 认证与资源鉴权、Git baseCommit 和内容来源核实 |
| publishPlan／confirmPlan | 不可变版本、前置条件、显式确认和 plan hash | P1-03 完整 DAG／覆盖／源引用／变更影响校验；当前要求需求与计划版本共同推进，单独只改计划后续补充 |
| admitWorks | 已确认当前计划、控制门／epoch、工作版本／输入 hash、依赖及两槽约束；Attempt／grant 快照／dispatch operation／Outbox 同事务 | P0-05/P1-03 当前 Registry generation、健康、预算／全局配额及最终执行授权复核；存储保留不等于完整准入 |
| transitionAttempt | 期望状态、状态机、恢复时 grant／epoch 校验；终态释放槽／撤销 grant；未知态占槽，核实／成功要求 evidence artifact | verifier 核实证据内容、可信来源和工具／Runner 真实终态；不能用 A2A completed 推导业务成功 |
| setControlIntent／finishRun | 保存暂停／取消、撤销 grant；Attempt 全部结束才可 FAILED／CANCELLED，取消须有持久意图 | 远端／Runner 停止、Delivery 与人工验收；没有直接 COMPLETED 入口 |
| lookupOperation／getOperation／getRun／getAttempt | 原幂等结果及持久事实查询 | HTTP 层鉴权，不直接暴露裸存储入口 |
| listEvents | Run seq 稳定分页，返回历史版本 | 后续 JSONL／SSE 投影与断线重连 |
| claimOutbox／settleOutbox | 短事务领取、owner＋deliveryAttempt token＋期限核验 | 事务外网络；回执只表示投递，不表示业务成功 |

命令按 `(principalId, scopeId, idempotencyKey)` 唯一。Worker 对 kind 和去除 meta 的请求计算规范 hash；同键同参数先返回原结果，异参数 409，业务前置失败全部回滚。规范 JSON 按 UTF-16 对象键顺序递归排序、省略 undefined、保留数组顺序，数字／字符串用 JSON.stringify，以 UTF-8 SHA-256 计算，不做 Unicode 正规化。inputManifest 自带 v1 schemaVersion；修改算法须显式升级。

默认最多 128 个未确认 RPC，可配置 1～10000；主线程发送前限制 256 KiB。超容量 503、超体积 413，明确未发送；Worker 再校验白名单和严格 schema。SQLite 锁等待留在 Worker。close 拒绝新请求、排空已受理请求、关闭连接并释放锁，可重复调用，收尾失败向调用方传播。意外退出／紧急 terminate 后未确认请求为 OUTCOME_UNKNOWN，必须重开按原键核实。

Outbox 租约到期转 RECONCILE，禁止直接重发。本轮提供持久领取／确认／核实状态，没有网络消费者、自动重试或核实调度器。未知 Attempt 不因租约、重启或超时释放槽。当前 payload 为 `devmesh.dispatch-intent.v1`；真实 A2A envelope、accepted 输入文件在 Runtime 接入时生成，不能伪造已发送的 `devmesh.work.v1`。

## 验证

构建后运行 `corepack pnpm@11.28.5 test:storage`。测试使用真实文件库、Worker 和 CLI，在临时目录执行。测试专用 SQLite trigger 阻塞生产领域事务，再杀控制进程验证提交前整体回滚；提交后、外部调用方获响应前杀进程，验证锁恢复、原键唯一性、暂停及未知 Attempt 保持。故障切点只存在 tests fixture，不增加生产故障开关或 SQL RPC。

固定 Node 版本会输出 SQLite ExperimentalWarning，多入口声明构建还会输出 tsdown/rolldown sourcemap 警告；声明和真实入口均参加类型与执行验证。同代码提交的 Windows／Linux 原始证据见项目 P0-03 记录。完整 T07、G0 和后续安全／隔离验收等待相关工作包。
