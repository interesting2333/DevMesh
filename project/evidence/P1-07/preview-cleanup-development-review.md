# P1-07 原容器／网络显式移除开发复核

日期：2026-11-12；实施／复核：同一 Codex Agent。范围属于已有 OpenSpec 2.3 的本地开发增量，正式 P1-07 仍等待 P1-06／G0，完整 2.3 未勾选，变更 5/13，不归档，不宣称阶段或产品验收。

## 实际实现

Runner v6 新增原容器与独占网络的独立清理日志。仅 STOPPING、有原 STOP 及完整 container／network ID 的原对象可以清理；HELD／OWNED 和未登记旧对象不获得许可。原 CREATED／EXITED 再核实完整 profile 及最后授权，按完整 ID 移除，不带 force／volumes，不删除 dataset。成功的完整原 ID 列表查询为空才构成消失证明，inspect-null、命令失败／超时、错误输出均不替代该证明；未知创建无准确 ID 继续占用资源。

每个 CONTAINER_REMOVE／NETWORK_REMOVE 固定原启动 hash、STOP hash、profile 和完整对象 ID，只有一次 SENT／dispatch。许可、执行或观察提交丢 ACK 后只查原 ID，不重发。容器 OBSERVED 与尚未释放预留的 REMOVED／releasedAt／容量历史同事务提交，审计插入失败整体回滚；已 EXITED 释放的原预留保持原状态及容量历史。容器消失后才清理原独占空网络；watchdog 另扫包含已释放预留的清理记录，网络清理不因活动列表排除而遗失。

控制面区分 REMOVED／PREVIEW_REMOVED／removalVerified 与 EXITED／PREVIEW_STOPPED／exitVerified，回执须匹配原实例及同次观察。已有 REMOVED 历史后不能经 UNKNOWN 再复活 HEALTHY。独立 dataset 的业务 SQLite、准备日志和元数据全部保留。

v6 采用新建扩展 CHECK 的父表、复制原行、删除旧表、重命名新表、恢复索引／触发器并核实外键的事务流程；foreign_keys 在事务外关闭，finally 恢复。v2～v5 历史迁移 SQL 不改写。历史版本测试用隔离临时库显式重建旧 schema；它们不是生产旧库或真实旧二进制。测试覆盖真实原行／子表／历史保留、升级故障回滚／重试和 v6 指纹漂移拒绝。技术专题 D4／完整主文、实施文档、D07、OpenSpec 和台账基线同步。

## 实际验证

[原报告](./development/cleanup-v32/report.json)／[原命令](./development/cleanup-v32/commands.json)／[证据摘要](./development/cleanup-v32/evidence.json) 保存 win32 x64、Node v24.13.1、全部 406 个源码／模板输入 SHA，运行期间源码指纹未变化。不是干净 checkout 测试。

| 检查 | 实际结果 |
| --- | --- |
| frozen-install | 通过 |
| typecheck | 通过 |
| lint | 通过 |
| current-build | 通过 |
| cleanup | 18/18，跳过 0 |
| watchdog | 15/15，跳过 0 |
| containers | 14/14，跳过 0 |
| capacity | 15/15，跳过 0 |
| runner | 76/77，跳过 1 |
| lifecycle | 16/16，跳过 0 |
| datasets | 11/11，跳过 0 |
| preview-intents | 14/14，跳过 0 |
| workspace-fencing | 5/5，跳过 0 |
| scheduler | 10/10，跳过 0 |
| smoke | 9/10，跳过 1 |
| storage | 28/28，跳过 0 |
| contracts | 18/18，跳过 0 |
| contracts-check | 通过 |

共 251 次测试执行，其中清理／watchdog／容器／容量 62 次属于 Runner 重复子集；去重 189 项，187 通过、2 条条件跳过，无失败或取消。跳过分别为 Runner Linux Docker 和 smoke POSIX SIGTERM，见原日志，不算通过。本轮不重复计算历史模板单元／浏览器结果，也没有执行 Linux 容器。

新增 18 项实际执行 Runner SQLite Worker、业务 dataset／CRUD、清理三类 ACK 丢失、Worker terminate／重开、原请求不可变、容量历史故障回滚、未知／运行中拒绝、HELD／OWNED 保护、关闭时最后授权和 v5→v6 迁移。平台组合执行实际控制 SQLite 命令处理器、DatasetPreparer、PreviewLifecycleManager 和 RunnerPreviewBackend；并将控制库备份后由真实存储 Worker 重开读取 REMOVED／原回执。候选／质量／镜像身份和上游准入是明确数据库夹具，未执行真实模型／构建／OCI，也不是完整用户请求端到端或生产平台装配。

## 原失败与修正

[v30 原失败](./development/cleanup-v30-failed/evidence.json)：14 项中 13 通过、1 失败。新增 CRUD 测试的幂等键 cleanup-row 长度不足模板规定的 16 位，触发 IDEMPOTENCY_KEY_REQUIRED。改用合法长度，不修改模板幂等规则。

[v31 原失败](./development/cleanup-v31-failed/evidence.json)：加强覆盖后 18 项中 17 通过、1 失败。新增 UNKNOWN 观察测试携带非空 instanceId，被原 schema 正确拒绝；修正为 instanceId=null，在测试 HEALTHY 时另传准确原实例。随后增加实际控制 Worker 重开读取，并纠正测试标题以区分直接命令处理器与 Worker 传输。v31 到最终报告的源码差异仅 tests/runner-preview-cleanup.test.mjs，不放宽生产契约。两个原失败的日志及源码快照分别保留，不覆盖。

## 证据边界与后续

ControlledContainerDriver 明确提供容器／网络及移除事实，健康服务器是独立 HTTP 夹具。实际 SQLite／文件／HTTP／定时器／Worker 恢复已执行；没有实际 Docker CLI、物理容器退出／移除、gVisor／cgroup／硬配额／宿主防火墙证据。Docker argv 和消失输出校验只用明确输入测试，缺 Linux／quota／network-isolation 时 Driver 仍关闭。

设计核对依据 [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)、[Docker container rm](https://docs.docker.com/reference/cli/docker/container/rm/)、[container ls](https://docs.docker.com/reference/cli/docker/container/ls/)、[network rm](https://docs.docker.com/reference/cli/docker/network/rm/) 和 [network ls](https://docs.docker.com/reference/cli/docker/network/ls/)。文档核对不替代目标 Docker 版本验证。

仍需实际 quota／network-isolation 适配器、可信平台装配、T5 必需归属握手及 Linux／gVisor 联调；预览网关、接受／发布、真实模型／OIDC／生产迁移与人工验收继续实施。缺外部资源不阻止其余本地代码与验证。

保留后核对 406 个当前输入、28 份原日志、84 项材料和 47 个失败源码快照 SHA；v2～v5 SQL 与前一源码提交的 Git 对象逐字一致。Lint、台账、OpenSpec 严格校验、设计完整主文和 diff 检查通过，见 [post-retention-checks.json](./development/cleanup-v32/post-retention-checks.json)。
