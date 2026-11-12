# P1-07 Runner 独立到期与 Release 归属开发复核

日期：2026-11-12；实施／复核：同一 Codex Agent。范围属于已有 OpenSpec 2.3 的本地开发增量，正式 P1-07 仍等待 P1-06／G0，完整 2.3 未勾选，变更 5/13，不归档、不宣称阶段或产品验收。

## 实际实现

Runner v5 前向迁移新增生命周期及不可变历史，不改 v2／v3／v4 迁移正文或 SHA。新 RESERVED 在外部动作前显式登记，原 requestHash／期限固定；旧已派发预览不自动收养，watchdog 对未登记对象只查询。升级保留原作业、fence、预留、容器日志和历史，失败回滚本次 DDL／版本，再核实并重试。

PREVIEW 可以进入 STOPPING 或 RELEASE_HELD；只有原 HELD 可以确认 RELEASE_OWNED。STOP 归属变化与原动作 SENT／唯一派发位同事务提交；接受准备与 STOP 在同一 writer 互斥。私有 hold 校验准确原实例、候选／manifest／镜像／dataset、原启动键与请求 hash、新鲜 HEALTHY、接受请求与 releaseId；重复原 claim／commit 幂等，变更拒绝。HELD／OWNED 不因 TTL 变成停止许可，未知接受结果保持保护。尚无撤销 API，未来必须基于明确未提交证明设计。

独立 RunnerPreviewWatchdog 默认关闭，显式启用后只依赖 Runner store／原后端，每轮从 0 分页，单对象失败隔离、不重入、close 等待在途任务且最后授权阻止新副作用。它不调用控制数据库，不使用短作业租约。到期未派发对象可以取消；已派发对象只核实原名称／profile／实例，再保存确定性原 EXPIRED STOP 并唯一派发。未知停止或丢 ACK 后只查询，准确原实例 EXITED 才释放容量，dataset 保留。CREATED 从未启动继续保留，尚未实现显式移除。

期限同时检查单调经过时间、墙钟截止和持久高水位。观察到回拨立即锁存；外层 SQLite 事务回滚也不撤销 Worker 内观察，成功提交后跨重启保留。最后 Runner 授权检查能拒绝平台仍允许的延迟 START。完全未观察到的宿主重启时钟变化仍依赖可信宿主时间。

## 实际验证

[原报告](./development/watchdog-v29/report.json)／[原命令](./development/watchdog-v29/commands.json)／[证据摘要](./development/watchdog-v29/evidence.json) 保存 Windows x64、Node v24.13.1、全部 401 个源码／模板输入 SHA，运行期间源码指纹未变化。不是干净 checkout 测试。

| 检查 | 实际结果 |
| --- | --- |
| frozen-install | 通过 |
| typecheck | 通过 |
| lint | 通过 |
| current-build | 通过 |
| watchdog | 15/15，跳过 0 |
| containers | 14/14，跳过 0 |
| capacity | 15/15，跳过 0 |
| runner | 58/59，跳过 1 |
| lifecycle | 16/16，跳过 0 |
| datasets | 11/11，跳过 0 |
| preview-intents | 14/14，跳过 0 |
| workspace-fencing | 5/5，跳过 0 |
| scheduler | 10/10，跳过 0 |
| smoke | 9/10，跳过 1 |
| contracts | 18/18，跳过 0 |
| contracts-check | 通过 |

共 187 次测试执行，其中 watchdog／容器／容量 44 次属于 Runner 重复子集；去重 143 项，141 通过、2 条条件跳过，无失败或取消。跳过分别为 Runner 的 Linux Docker 条件和 smoke 的 POSIX SIGTERM 条件，见对应原日志，不算通过。不重复计算历史模板检查，之前模板单元／浏览器记录仍见 containers-v26/template；本轮没有重新执行模板浏览器或 Linux 容器。

新增用例实际执行 Runner SQLite／Worker、真实本地 dataset 和模板 CRUD、HTTP、真实到期定时器、Worker terminate／重开、原 STOP intent 恢复、HELD／OWNED 跨到期／重启保护、hold 与 STOP 两种提交顺序、错误主体／请求／实例拒绝、派发和历史故障原子回滚、分页失败隔离与关闭时延迟执行拒绝。时钟单元测试使用明确可控时间输入；其他时钟回拨场景明确注入持久高水位，与真实墙钟到期测试分别记录。

历史 v1／v2／v3／v4 均升级到 v5；v4 活动原容器日志及旧迁移历史逐字保留，v5 注入迁移历史失败核实 DDL／版本回滚，再重试；v2／v3／v4／v5 指纹漂移被拒绝。没有把旧预览登记为新未接受对象。

## 原失败与修正

[初轮 v27](./development/watchdog-v27/evidence.json) 的新增／容器／容量 43 项通过，随后加强 Worker 内回拨锁存和最后 START 授权用例。保留 [v28 原失败](./development/watchdog-v28-failed/evidence.json) 的全部日志及 15 个失败源码快照：15 项中 14 通过、真实定时器夹具 1 失败。本机 Runner／dataset 实际启动超过夹具 3 秒 TTL，生产守卫正确返回 PREVIEW_RESERVATION_EXPIRED。最终只把测试 TTL 改为 20 秒、观察宽限改为 15 秒并设 90 秒测试上限，未改变生产期限、归属或唯一派发守卫。失败与最终报告的输入差异仅 tests/runner-preview-watchdog.test.mjs。

保留后核对 401 个当前源码／模板输入、28 份原日志、52 项材料及 15 个失败源码快照 SHA，Lint、台账、OpenSpec 严格校验、设计完整主文和 diff 检查均通过，见 [post-retention-checks.json](./development/watchdog-v29/post-retention-checks.json)。

## 证据边界与后续

ControlledContainerDriver 提供全部网络／容器事实，健康服务器也是独立 HTTP 夹具；测试不执行 Docker，不证明物理退出、真实镜像健康或 gVisor／cgroup／quota／宿主防火墙。真实本地文件、SQLite、HTTP、定时器及 Worker 恢复实际执行。

ReleaseHold／Commit 目前只是私有可信 Runner 归属握手，没有 T5 提交或完整控制面接受流程；后续 T5 必须先持有再提交接受，最后按原键确认。仍需从未启动容器／网络的显式清理证明、实际 Linux quota／network-isolation 适配器、可信平台装配与 Linux／gVisor 联调；网关、接受／发布及真实模型／OIDC／生产迁移和人工验收继续实施。缺外部资源不阻止其余本地代码与验证。

源码检查点为 `bdb3711b3b238fd929e295eb7e211371a77d5303`；[checkpoint-binding](./development/watchdog-v29/checkpoint-binding.json) 的全部 401 个输入与该提交 Git 对象字节一致，绑定不等同于重新测试或干净 checkout。
