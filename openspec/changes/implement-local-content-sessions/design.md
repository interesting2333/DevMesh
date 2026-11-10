## Context

参见 proposal。实现遵循 D5 §3.3/5/7、D2 §3 和实施文档 P0-04。已有迁移 1～3、严格 RPC、操作去重和 WORKFLOW Attempt 可作为会话归属，尚无 Invocation 宿主；不用无外键的 ownerKind 通用表绕过宿主隔离。

## Goals / Non-Goals

交付真实本地存储和可重启读取的工作流 SessionStore，保留 Provider 接口。企业 OIDC／OAuth、模型调用、隔离执行、完整保留策略和跨节点备份由对应工作包实现。物理目录 fsync 能力按平台记录，不把进程崩溃测试当断电认证。

## Decisions

1. 追加迁移 4；不改写既有 SQL。写入操作先登记 ACCEPTED，冻结 hash／大小／MIME／目标，再在事务外流式 stage、fsync、校验并无覆盖发布，最后短事务登记 READY 内容与业务引用／操作结果。Worker 只接收元数据。失败产生可核实操作或孤立完整文件，没有虚假已保存回执。
2. 对象 key 固定 sha256/前两位/64位小写哈希。用户文件名只展示。统一路径层检查各现有祖先、链接／junction、相对键、保留名和根目录交叉；管理目录限制写权限。用同卷硬链接的排他创建实现不可覆盖发布，再清 staging；已有内容核实后复用。Windows ACL 与目录 flush 限制如实记录。
3. 根目录只在显式初始化时新建，storage-layout.json 固定 storeId/layoutVersion/nodeKind；未知非空目录拒绝采用。初始化专用 pending 标记保留同一身份，失败仅允许显式 init 核实续做，数据库完成后发布正式标记。节点锁覆盖布局和 Worker 生命周期，崩溃需原 token＋死 PID 恢复。启动检查可写、容量、同卷及 DB 身份，已有完成 marker 缺 DB 不静默新建。共享模式必须绝对路径，本地相对路径锚定配置文件目录。
4. attachments 在 Run 之前绑定上传主体。agent_sessions 对 Attempt 唯一并复合引用同 Run，消息 seq／步骤号分别连续，消息追加且正文 READY。模型请求绑定 context snapshot，完整可展示回复持久化后才允许后续工具；不保存内部思维、认证头或 Cookie。
5. 读入口接受主体和 attachment/message/artifact/context/model-step 引用，Worker 校验其真实归属后返回内容元数据。仅 hash 不构成权限。当前项目 owner 权限是基础，后续 project_members/OIDC 补充真实身份解析。
6. SessionStore 生成规范上下文清单，按真实已提交消息与角色配置校验顺序和 hash。JSONL／manifest 只读投影采用临时写入后替换，携带源游标和内容哈希；删除或篡改 views 不能影响恢复。
7. 恢复只核实已登记写入操作，不扫描任意 .part 成为业务内容。完整内容缺失或损坏标 MISSING 并阻断消费者；RECEIVING/SEALED 可按原键显式完成，失败的流需同键重传。无引用对象删除仅开放受控存储维护入口，完整 pin／保留／GC 策略在 P2-07 扩展。

## Risks / Trade-offs

- [发布与 DB 切点] → 文件先于成功索引、持久写入阶段、真实进程崩溃与事务失败测试。
- [路径重定向] → 逐祖先 lstat／realpath、严格逻辑键、节点锁和部署目录所有权；不向模型开放根路径。
- [投影过期] → 记录 throughMessageSeq，读取 DB／正文权威，可重建；投影不参与执行。
- [外部环境暂缺] → 依用户要求持续编码并保留默认关闭入口，真实模型／企业身份／runsc 项记待联调。

## Migration Plan

已有库按原备份机制 3→4；空库执行全部批次。首次根目录用 storage:init 明确生成身份，常规启动校验已有根。恢复节点锁时同时核实旧 DB 锁原进程已退出。回退停写后在隔离目录检查备份，不逆向删除会话索引。
