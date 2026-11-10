## Context

P0-03，参照 D5 §1/2/4/6、实施文档 §5.1 DB-A/DB-B。现有 contracts 提供 ID、状态、工作定义和事件 schema，正式库从本包版本化 SQL 创建，运行时不读取 design/contracts。

## Goals / Non-Goals

交付可独立使用的持久存储与真实失败恢复测试。业务认证、内容文件发布、注册健康／配置代际、预算／公平调度及最终质量验证仍由后续工作包实现；本包提供 T1/T2 存储原子部分，不提供 HTTP 成功占位接口。

## Decisions

1. 使用 Node 内置 node:sqlite DatabaseSync，仅 Worker 打开业务连接。WAL、foreign_keys=ON、synchronous=FULL、busy_timeout=5000；主线程以请求 ID 关联结果，所有请求经白名单 schema，禁止任意 SQL／闭包。队列容量在发送前检查，超过容量返回 503；Worker 意外退出时未确认写入返回 OUTCOME_UNKNOWN，不能自动重发。
2. 正式 SQL 复制核心关系的设计意图并独立维护，补齐请求成果到同项目 artifact、artifact 到内容对象等外键。迁移 1 为 store/content 元数据，2 为核心 24 表，3 为输入／角色快照／确认／grant 前置及加强约束。迁移历史校验版本、名称和 SHA-256，拒绝未知／被改写历史和降级；每批 BEGIN IMMEDIATE 原子提交。
3. 数据库路径必须显式绝对路径，父目录已存在；创建新库要求 create=true，storeId/layoutVersion 必须与调用方匹配。未知非空库拒绝。数据库旁进程锁防止第二个 Worker 或维护 CLI 写入；正常退出释放，进程崩溃后的锁需提供已检查的 token 且原 PID 已退出才能恢复，恢复过程使用互斥 guard，异常遗留 guard 明确拒绝自动接管。完整 dataRoot 标记和跨根路径校验在 P0-04 接入。
4. 已有受支持库升级前使用 SQLite backup API，在独立备份目录生成一致性快照并验证 quick_check／外键；未提供备份目录就拒绝升级。备份不等于全平台备份，P3-06 仍需会话／Git／Runner／dataset 协调恢复。
5. 领域事务内部同步执行，不持有事务跨 await。请求哈希由规范 JSON 在 Worker 内计算；原键先查重，异参数 409，原结果响应丢失可查询。业务状态、event_seq、operation 结果和 Outbox 同事务。未知 Attempt 持续占 work／角色槽，不因 Worker 重启、Outbox 租约或超时创建第二次尝试。
6. admitWorks 只落实数据库侧当前计划／确认、控制门、代际、依赖及两槽约束，冻结调用方已解析的目标版本、输入和 role snapshot。注册健康／generation、预算／全局配额的完整准入复核在 P0-05/P1-03 接入，不把存储调用当执行授权；本轮无 Outbox 网络消费者。bootstrap 理解／规划专用路径留待 Runtime／Scheduler，不能由模型自声明。

## Risks / Trade-offs

- [锁文件崩溃残留] → 拒绝不明接管；按 token 与死进程证明恢复，不按锁年龄删除；测试实际杀控制子进程。
- [迁移中断／多版本升级] → 单批事务、固定校验和、升级前备份；失败保留原已提交版本，不执行降级 SQL。
- [Worker 响应丢失] → 主线程不推断回滚；重开后按原键查询持久事实。单实例锁释放须等待 Worker 真正退出。
- [设计样例约束不足] → 独立加强外键、快照不可变、总槽、终态保护；保留差异说明和测试。

## Migration Plan

新库显式创建并执行 1→2→3；已有 1/2 版本先备份再升级。迁移失败关闭 Worker 并保存错误，重开复核历史后继续未完成批次。未知数据库、未来版本或校验和变化不自动修复。回退采用停止写入后的备份隔离恢复或前向修复；不在运行库直接逆向删除列／记录。
