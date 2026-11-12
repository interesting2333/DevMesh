## 1. Exact candidate review

- [x] 1.1 新增逐项审查协议、前向迁移及 Worker 只读投影，验证必要需求／人工检查集合、稳定 ID、历史候选与无正式冻结的兼容边界。
- [x] 1.2 实现人工结论追加、标准 meta／If-Match／当前记录 CAS 和证据引用，验证权限、丢回执、冲突修改、陈旧候选、错误预期／材料及不改变原自动事实／接受指针。
- [x] 1.3 实现退回及分类纠正记录，验证原范围与新增范围不混用、历史保留及未确认范围不自动执行。

## 2. Dataset and preview persistence

- [x] 2.1 增加 dataset／预览意图与原操作状态迁移，验证跨项目约束、幂等、目录边界、UNKNOWN 原对象恢复及独立保留。
- [x] 2.2 实现可信 dataset 准备接口和首次空／演示、隔离快照适配，验证实际 SQLite 一致副本、源数据不回写、失败和 ACK 丢失不重建；真实生产迁移未配置时关闭。
- [ ] 2.3 实现准确镜像／dataset 预览启动、健康／停止／到期核实，验证原实例绑定、未知不替代、停止未接受预览不影响旧 release／dataset；真实容器另留缺项。

2.3 当前开发范围：持续健康持久观察、原启动／停止／到期的私有控制面恢复器及受限 loopback HTTP 检查已完成本地验证；Runner v3 持久预览预留与原作业统一累计 slot／CPU／内存，UNKNOWN 保留容量，只有未派发取消、准确原实例 EXITED 或独立 REMOVED 证明才释放。Runner v4 新增不可变原 profile／NETWORK_CREATE／CREATE／START／STOP 日志、唯一派发许可、原对象核验和显式 RunnerPreviewBackend 组合；Docker Driver 代码固定 OCI／config／层、独占网络、只读准备元数据挂载及沙箱／资源策略，缺真实 Linux／硬配额／宿主网络隔离适配器保持关闭。Runner v5 增加持久归属和独立到期 watchdog，私有 ReleaseHold／Commit 与 STOP 在同一 writer 互斥；HELD／OWNED 不因 TTL 失去保护，旧未登记预览只查询，观察到的时钟回拨锁存到期。新用例实际执行本地定时器、Worker 重启、归属与 STOP 并发、事务回滚及历史升级，网络／容器事实仍明确受控。原控制面组合和实际 dataset 保留已有本地验证，模板显式容器监听另有 HTTP／SQLite／浏览器验证。Runner v6 新增独立 REMOVED／PREVIEW_REMOVED、原容器／网络唯一清理日志、准确 ID 消失观察与容量历史同事务、包含已释放预留的清理恢复扫描，前向迁移不改旧迁移正文；HELD／OWNED、未知创建无原 ID 和 dataset 继续保护。真实 Docker CLI／gVisor 启动／退出／移除联调、实际 quota／network-isolation 适配器、可信平台装配及 T5 必需归属握手仍待完成；完整子项不提前勾选，受控容器事实不是实际镜像健康或物理退出证据。

## 3. Separate preview access

- [ ] 3.1 实现独立 origin、固定目标、短期用途凭据与成员复核，使用真实本地 HTTP 验证 Cookie／用途／项目隔离、目标限制、读写门和到期。
- [ ] 3.2 接平台预览查询／访问入口、隔离 iframe 策略及下载只读边界，验证未配置关闭、状态明确、访问或下载不接受。

## 4. Two-phase acceptance and publication

- [ ] 4.1 持久固定接受依据与外部准备原操作，验证原接受指针、reviewHash、数据策略／明确替换决定、fencing／健康凭证和陈旧依据拒绝。
- [ ] 4.2 实现 T5 原子 Release／接受指针／必要人工完成／Run 终态／Outbox／事件，验证每个写入故障回滚、并发 CAS、原键恢复、缺项／未知写阻塞与不可变接受历史。
- [ ] 4.3 实现发布 Outbox 和独立导出任务恢复，验证路由／打包失败保留接受事实、ACK 丢失不双建、不重复迁移、旧写门未核实不重开。

## 5. Composition and evidence

- [ ] 5.1 将准确候选、审查、实际本地数据副本和 HTTP 预览／发布组合验证，逐项记录 D01～D08 与 T5 的实际覆盖，受控后端不代替真实构建／健康或产品验收。
- [ ] 5.2 在固定提交干净 checkout 执行适用回归，保存原日志／SHA／源码指纹、部署与恢复说明，同步 OpenSpec 和父工作包台账，单列企业身份／真实 Linux／容器／迁移验收条件。
