# P1-07 私有预览访问与持久写门开发复核

日期：2026-11-12；实施／复核：同一 Codex Agent。已有 OpenSpec 3.1 的本地增量；完整 3.1 和 2.3 仍未勾选，变更 5/13。正式 P1-07 等待 P1-06／G0；不归档，不代表人工、产品或阶段验收。

## 实现

前向迁移 34 保存不可变 gateway／project／configurationHash／service principal 策略。当前 owner 登记策略；准确原 dataset 后端按准备 operation／hash 登记写门，缺任一项关闭访问。每次准入和发送前复核当前成员、新鲜健康、期限、原 fence，以及原候选、manifest、镜像、dataset、启动 operation／hash、Runner、实例与 loopback 端点。owner／operator 可以取得业务写方法许可，viewer 仅安全方法，不扩大平台写权限。私有接口见 [PREVIEW-ACCESS](../../../packages/storage-sqlite/PREVIEW-ACCESS.md)。

关闭与唯一派发许可在同一个 SQLite writer 串行。PREPARED 只一次变为 DISPATCHED；许可丢 ACK、重复 begin、UNKNOWN 和重启不再授权发送。DISPATCHED／UNKNOWN 写请求跨网关持续计数，不靠 TTL 推断完成；关闭递增 fence，新写拒绝，新 fence 安全读仍可准入。原请求／目标／主体／fence、观察及不可变历史持久保存，故障同事务回滚；UNKNOWN 不能反向变成 NOT_SENT。

健康仅接受 0～30 秒观察，时钟回拨后未来观察不可用。HTTP FINISHED 包括错误响应，仅证明完整传输观察；GET／HEAD 分类不强制物理数据库只读，计数归零不证明后台写入结束。没有把 READY 改成 WRITE_FROZEN、创建 Release、变更接受指针、自动重开门或完成 T5。

## 验证来源

下表分别列出实际运行。v38、v39、v41 的 FAILED 报告保持原样；成功检查可以复核，不能改称本轮重新执行。v42 只新执行修改的定时器单例及 Lint 两项；没有重跑未修改且已通过的其他用例。

| 检查 | 原结果 | 来源 |
| --- | --- | --- |
| frozen-install | 通过 | v38 原执行 |
| typecheck | 通过 | v38 原执行 |
| lint | 通过 | v38 原执行 |
| current-build | 通过 | v38 原执行 |
| access | 19/19；失败 0；取消 0；跳过 0 | v38 原执行 |
| lifecycle | 16/16；失败 0；取消 0；跳过 0 | v38 原执行 |
| preview-intents | 14/14；失败 0；取消 0；跳过 0 | v38 原执行 |
| datasets | 11/11；失败 0；取消 0；跳过 0 | v39 原执行 |
| storage | 32/32；失败 0；取消 0；跳过 0 | v39 原执行 |
| runner | 75/77；失败 1；取消 0；跳过 1 | v39 原执行 |
| watchdog-repair | 14/15；失败 0；取消 1；跳过 0 | v41 原执行 |
| scheduler | 10/10；失败 0；取消 0；跳过 0 | v41 原执行 |
| smoke | 9/10；失败 0；取消 0；跳过 1 | v41 原执行 |
| contracts | 18/18；失败 0；取消 0；跳过 0 | v41 原执行 |
| contracts-check | 通过 | v41 原执行 |
| lint | 通过 | v41 原执行 |
| watchdog-repair | 1/1；失败 0；取消 0；跳过 0 | v42 本次执行 |
| lint | 通过 | v42 本次执行 |

原报告：[v38](./development/access-v38-failed/report.json)、[v39](./development/access-v39-failed/report.json)、[v41](./development/access-v41-failed/report.json)、[v42](./development/access-v42/report.json)。各自保留准确命令、原日志及 SHA、Node／平台／架构与 414 个输入。访问 19 项包含 4 项存储测试，storage 再次执行它们；不同运行不能直接相加成独立用例数。Linux Docker 与 POSIX SIGTERM 条件跳过不算通过，v42 的名称筛选也不执行未匹配用例。

[source-comparisons](./development/access-v42/source-comparisons.json) 逐项核实只有 watchdog 测试文件变化，其余 413 个产品、构建、锁文件、模板和测试输入字节相同。不声称完整同指纹全绿、修正后完整 Runner 命令重跑或干净 checkout。

访问／迁移测试使用隔离的真实迁移 SQLite、完整外键／CHECK、schema 和 storage Worker，覆盖串行并发、许可提交后丢 ACK、terminate／重开、成员撤销、时钟／健康／期限、跨网关计数及事务失败。每例复制显式最小合法状态 seed；上游交付／冻结、原候选、镜像、dataset 与容器健康是明确夹具，没有执行完整资格／构建链或向生成应用转发 HTTP。Runner 另有真实本地计时器／存储／恢复测试，容器 Driver 仍受控。

## 失败与修正

| 运行 | 原结果与处理 |
| --- | --- |
| [v33](./development/access-v33-failed/evidence.json) | 类型检查失败；明确错误函数 never 返回，修正 nullable endpoint 收窄。 |
| [v34](./development/access-v34-failed/evidence.json) | Lint 控制字符正则失败；改为等价码点检查，保留路径限制。 |
| [v35](./development/access-v35-failed/evidence.json) | 17 项 9 通过、8 失败：旧 Worker 命令、成员必填字段和 Windows EBUSY 清理次序。修正夹具，保留生产 schema。未自然退出，经只读诊断明确停止自己的 PID 39220。 |
| [v36](./development/access-v36-failed/evidence.json) | 18 项 14 通过、4 失败，自然退出；上游夹具在访问命令前 RUNNER_FORBIDDEN／RELEASE_DELIVERY_POLICY_CHANGED，准备增至 31～92 秒，未放宽权限或期限。 |
| [v37](./development/access-v37-failed/evidence.json) | 前四检查通过，访问仍被上游夹具超时阻断，明确停止本轮自己的测试树父 PID 592，无完整 TAP 计数。后续改为明确合法状态 seed，真实 Runner 回归保留。 |
| [v38](./development/access-v38-failed/evidence.json) | 前七检查通过；datasets 10/11，在上游 DeliveryCollector、被测数据命令前失败，自然退出；未捕获具体质量事实，根因未确定。 |
| [v39](./development/access-v39-failed/evidence.json) | datasets 11/11、storage 32/32，Runner 75 通过、1 失败、1 跳过。原定时器测试一看到 EXITED／releasedAt 就关闭 watchdog，却断言后续独立清理已完成。 |
| [v40](./development/access-v40-failed/evidence.json) | 15 项 14 通过、1 失败，自然退出；第一次修正错误地等待 REMOVED，额外 expiry+15 秒窗口结束仍是 EXITED；全部 414 个失败源码输入保留。 |
| [v41](./development/access-v41-failed/evidence.json) | 15 项 14 通过、1 在原 90 秒超时取消；两项原清理观察已 OBSERVED／absenceVerified，EXITED 保持不变。其余五项检查独立执行通过。变化的测试源码单独保留。 |

v41 诊断纠正了前两次测试修改的终态理解：已 released 的 EXITED 预留不可变，capacity-domain 的 recordRemoved 保留它，原 v6 SQL 触发器同样禁止覆盖；后续清理证据独立保存。v42 恢复原 EXITED 断言，等待两项原 OBSERVED 消失证明后才关闭 watchdog，再核对原实例、清理类型、absenceVerified、完整动作顺序与零容量。只修改该测试，用原 90 秒超时／abort 信号约束等待并捕获错误状态；没有修改 Runner 产品代码、旧迁移、生产租约或超时。新执行准确匹配这一单例及 Lint，结果见表；失败运行不改写成成功。

健康下界修正保留两次红测：[第一次](./development/access-clock-red-v37/evidence.json) 在上游夹具失败，未复现；[旧构建实际复现](./development/access-clock-red-v38-before-build/evidence.json) 缺少预期拒绝的断言，七项原构建产物 SHA 不变，预期非零不计通过。最终访问用例验证修正边界，只注入测试 Date，不改宿主时钟。

v38 [资源／五秒 CPU 采样](./development/access-v38-failed/lifecycle-profile.json) 未暂停或修改应用；v39 [资源快照](./development/access-v39-failed/resource-probe.json) 当时约 CPU 100%、32GB 内存可用约 0.5GB。短 TEMP 的 canonicalRoot 每十次测量约 122～182ms，默认约 889～965ms；v39 后续检查显式使用独立短 TEMP／TMP，产品代码及权限／期限未改。这些诊断不证明历史失败根因或产品修复，不计功能测试。

## 后续

HTTP 网关、用途凭据／会话、每预览 host／独立可注册域的 Cookie／iframe 浏览器验证、可信 Runner 本地目标传输及生产装配继续 3.1／3.2。真实请求头／正文必须由传输层绑定和观察，service principal／配置 hash 不代替登录。实际数据排空／物理 fencing、T5、发布恢复与明确未切换后的重开协议继续实施。模型／OIDC／Linux／Docker／gVisor 未配置时保留关闭边界，继续本地代码与验证。

保留后核对 414 个输入、49 份原日志、586 项材料和 491 个失败源码快照 SHA；v1～v33 SQL 及 manifest 前缀与上个提交保持一致。v42 Lint 已通过；台账、OpenSpec 严格校验、设计主文与 diff 检查通过，见 [post-retention-checks.json](./development/access-v42/post-retention-checks.json)。

源码检查点 `9bef56249b642403e690aa3c23da95026d29b03a`；[checkpoint-binding](./development/access-v42/checkpoint-binding.json) 的全部 414 个输入与 Git 对象字节一致，绑定不等同重新测试或干净 checkout。

绑定后台账与 diff 再核对通过，见 [checkpoint-management-checks](./development/access-v42/checkpoint-management-checks.json)。本次文档收尾只更正 post-retention scope 的 Lint 来源版本为 v42，未改动检查命令、退出码、计数或原日志。
