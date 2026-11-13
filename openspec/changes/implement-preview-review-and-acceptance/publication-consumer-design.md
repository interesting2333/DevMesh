# Trusted publication consumption

父工作包 P1-07；继续 4.3／5.1。现有 ReleasePublisher 与 Runner 原阶段 continuation 由可信宿主显式接入后台；没有物理适配器不安装默认实现。

## Composition

startPlatform 的 releasePublication 工厂提供固定 projectId／policyHash／principalId／backendRef／runnerId 和后端实例。启动前核实原 acceptance backend policy；发布沿用该已接受准备的后端权限，不创建另一套普通用户可登记的发布主体。每项目一个范围，有限范围／页预算、最多两个项目并行，重复 tick 合并，范围轮转。工厂需要显式持久存储，但不依赖输入身份或接受入口仍开启：停止新接受之后，原已接受发布仍可由其明确配置的原后端恢复。

## Original unresolved work

私有工作查询只选当前 accepted_release_id 上该原策略的 PENDING／SENT／UNKNOWN，不返回已发布或过期历史；原完整历史查询保持不变。准确 Release、Outbox／接受凭证、原后端和来源／目标写门继续由 writer 和 Runner 验证。

PENDING 经 preflight 和唯一 durable grant 才调用 publish；SENT／UNKNOWN 不再调用原 publish。先 inspect 原对象；只有当前 continuation 授权成立且后端显式提供 resume 时，续接原 Runner 日志中尚未派发的下一阶段，各阶段独立唯一许可，不重发未知已派发阶段，不创建替代版本、不重新初始化或迁移。没有续接能力或缺充分事实保持 UNKNOWN。PUBLISHED 是已保存事实，工作查询不借此定期重写证明或延长健康。

发布／路由失败不回滚 T5、原 Release、指针或 Run 终态，不重开旧源门或提前打开目标门。完整发布证明仍由既有 writer 原子保存并开目标门，不能由消费者直接改 gate。

## Stop and evidence

stop 同步关闭新扫描、publish／resume 最终授权，preflight 返回后再次核实停止；已经开始的后端调用必须真实排空后再关闭存储。重复停止共享排空过程，停止后不能 restart。接口不强制取消后端，可信适配器须自行有界 I/O，外部资源生命周期仍由构造者管理。

使用真实文件 Worker、T5／发布事务及宿主生命周期验证队列、作用域、周期续接、丢 ACK、CAS、并发和排空。物理 Runner、路由／fence／健康若为协议夹具则明确标记；完整后继数据链和真实 Linux／gVisor 不据此通过。最终记录源码／产物字节、原始日志、台账与剩余验收条件。
