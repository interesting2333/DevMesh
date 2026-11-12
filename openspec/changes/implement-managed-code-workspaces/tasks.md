## 1. Repository ownership and durable allocation

- [x] 1.1 建立受控 Git Provider、固定 argv／环境和目录身份校验，从固定模板子树生成独立初始提交；以真实临时仓库验证精确对象、来源、禁外部 helper 和路径漂移拒绝。
- [x] 1.2 增加项目仓库、工作区、原分配操作及状态的向前迁移和 Worker 命令；验证去重、错 base／错归属拒绝、准备中断恢复及历史迁移升级。
- [x] 1.3 实现独立 checkout、内部 ID 分支和固定源码清单；验证工作区与项目目录隔离、精确 HEAD，未知目录保留且不覆盖。

## 2. Exclusive access and source retention

- [x] 2.1 实现项目／工作区准入及 Runner 状态 fencing，接 repo MCP 的 acquire 接口；验证并发互斥、暂停／旧代际拒绝、活动及未知 Job 拒绝写入和回收。
- [x] 2.2 实现开发提交父链／范围／文件类型校验、受控对象传输和保留 ref；用分离的真实 Git 仓库验证错来源、越界、缺对象、原归档操作去重与 ACK 丢失恢复。

## 3. Candidate integration and conflict evidence

- [x] 3.1 实现串行三方候选集成、当前依赖复核、多 ref CAS 与原操作恢复；以两个同基点开发分支验证全部变更保留、接受指针保持原值、冲突和成功原操作不重复执行。
- [x] 3.2 保存 base／ours／theirs、冲突路径、blob 或缺失标记及内容引用；以真实冲突验证三方材料可读、哈希固定、内容发布失败不推进候选。
- [x] 3.3 实现固定候选 SHA 的验证 checkout 和 source manifest；验证后续开发写入不改变验证输入，质量判定仍交给 P1-06。

## 4. Archive acknowledgement and reclamation

- [x] 4.1 实现源码／未提交／未跟踪／恢复材料保存清单、受控仓库保留事实和持久 ACK；验证未 ACK、缺材料、哈希漂移或未知 Job 时不能回收。
- [x] 4.2 实现仅原工作区的隔离／回收与原操作核实；在专属临时根验证重复回收、崩溃恢复，datasets、项目仓库和外部目录保持可读。

## 5. Composition and evidence

- [x] 5.1 接调度资源分配、repo MCP 与 Runner 管理边界，默认无后端关闭；用真实本地协议／Git 联调验证来源与生命周期，明确远程身份和 Linux/runsc 未执行项。
- [x] 5.2 执行固定提交干净 checkout 的冻结安装与适用全量回归，保存原始报告、操作／材料摘要、部署文档，更新父工作包和 OpenSpec；按真实证据评审 T05/T23。
