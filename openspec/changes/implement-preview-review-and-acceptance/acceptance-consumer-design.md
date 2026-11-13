# Trusted acceptance preparation consumption

父工作包 P1-07；延续 4.1／5.1 的开发子步骤，不将本步骤视为真实 Runner、完整业务链或阶段验收。

## Composition and authority

`startPlatform` 只通过可信 `acceptancePreparation` 工厂取得后端实例及固定 project／policyHash／principalId／backendRef／runnerId。要求显式 Input API、持久存储及匹配的接受策略映射；没有工厂不扫描、不派发。启动前逐项核实 DB 已登记的原策略、后端主体与 Runner 绑定，拒绝重复项目、禁用后端或无效限制；启动失败释放已打开服务。不新增公共 HTTP／MCP 的注册、推进、proof 或自动接受入口。

工厂和后端不是 JSON 配置或普通用户可提供的能力。真实 Runner、物理写门、quota／容器适配器仍必须由可信装配提供，默认不推断。策略映射按启动快照保存，工厂不得静默替换该映射。

## Bounded recovery

私有 Worker 工作查询只返回准确项目／原策略上的 PREPARED／SENT／UNKNOWN，排除已关闭、已撤销和已提交原准备。原历史查询保持原行为；历史 FAILED／COMMITTED 不占消费页。有限页／范围预算、跨项目最多两个后端调用、同一项目串行、轮转范围与每范围游标；并发 tick 合并为同一次扫描。扫描失败和后端异常只保留受限错误码，下一轮按轮询间隔重试，不因单一项目失败饿死其他范围。

调用已有 AcceptancePreparer：PREPARED 仍需 preflight 和 writer 一次性派发许可；SENT／UNKNOWN 只 inspect 原对象。独立周期复核同一原 proof 的当前健康，GET 不刷新健康。丢派发许可 ACK 不补派；丢观察 ACK 后继续原对象查询。每次原工作都复核固定后端绑定；数据库 CAS／撤销／T5 继续关闭迟到观察。消费者不提交 T5、不发布、不关闭或清理原准备。

## Shutdown

stop 先同步停止新扫描和外部动作授权；已进入 preflight 在派发前复核停止标志，原后端最终授权回调也复核。已经开始的非可取消后端调用必须真实 drain 后再关闭存储，不通过超时竞赛假装结束或释放名额。重复 stop 返回同一排空过程；停止后 tick 不再工作，不能重新 start。后端永不返回时停机也保持等待，需实际适配器提供自己的有界 I/O；不宣称有强制取消能力。

## Verification

使用实际文件型 SQLite Worker 与平台 start／stop，后端物理状态为明确协议夹具。验证默认禁用、身份／策略／项目隔离、终态历史不挡新工作、并发 tick、轮转／并发界限、原派发／观察 ACK 丢失及重启、真实 30 秒健康失效和独立恢复、撤销／T5 排除、preflight 停机及后端排空先于 storage close。保留原日志、源码指纹、构建映射与台账，真实 Linux／gVisor 和产品验收单列。
