# 接受服务 Runner 日志

`acceptanceService*` 是可信库装配调用的私有 Worker 方法，没有新增公共 HTTP、MCP 或模型回执入口。服务用途固定 ACCEPTANCE，直接引用准确 `acceptancePreparationRequest`，不创建 PREVIEW effect。

`acceptanceServiceReserve` 同时保存完整原接受依据、实际数据回执、原源／目标持有记录、原服务 requestHash 与固定资源。它不核实物理隔离或启动容器；实际适配器必须先核实这些外部事实。`acceptanceServiceRequest` 校验原 hash、dataset／数据来源／迁移和 custody 文件摘要；文件格式为 canonical JSON 加 LF，摘要保持原格式。

Runner v7 只增加新表，校验 v2～v6 原迁移正文摘要并保留其行与历史。作业 claim、预览 reserve 和接受服务 reserve 在同一个 writer 核算所有未释放 slot／CPU／内存；接受服务与预览的同一 dataset 跨 controller 互斥。UNKNOWN、失联和重启不释放容量，较低预算只拒绝新准入。只有从未派发的预留可以取消，已派发占用必须由准确原容器 EXITED 事实释放；缺失对象不当作退出。

服务 profile 固定原 reservation／requestHash、仓库、目录、配额、只读访问与专用 network／container 名。登记 profile 后才可取得唯一 dispatch；各 NETWORK_CREATE／CREATE／START 再分别提交不可替换 SENT。只收到本次 dispatch=true 的调用方才可执行，并在执行前通过 `acceptanceServiceActionAuthorized` 和控制面最后授权。丢许可或执行回执后只查询原名称、profile、网络及容器 ID，不能再次发送原动作。新动作必须先取得准确前置对象。

观察绑定原 operation／release／dataset／image、准确原容器及固定端口；版本 CAS 和观察时间拒绝慢结果。HEALTHY 另要求原 START 的 RUNNING 观察；这两个字段均应来自实际可信 Driver／HTTP 检查，持久层不生成物理事实。原实例／端口不被 UNKNOWN 清空，事件写入失败回滚观察和容量释放。

`acceptanceServiceHold` 仅对未释放且新鲜 HEALTHY 的准确实例取得 RELEASE_HELD，健康年龄为 0～30 秒。独立服务 claim 固定原接受 hash、serviceRequestHash、reservation／profile、release／candidate／review／数据方案／dataset／image／实例；重试恢复同一个 claim，不按 TTL 解除。旧预览入口只接受旧预览 claim；控制面 prepared proof 同时保留旧记录读取兼容及新服务 claim 的准确绑定。

当前接口不提供 RELEASE_OWNED、接受提交、物理 Docker／gVisor 或安全撤销／停止。预览 watchdog／清理只扫描预览表，不能代替接受服务后续的专用恢复协议。完整服务 Driver、控制面与数据／服务的组合、物理排空、未提交核实、T5 和发布继续实施；没有真实资源不启用外部执行。
