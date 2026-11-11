## Context

动机及工作包见 proposal；具体依据为 D3 §3 确认前准备例外、D1 §8 部分回答、D2 §2～5 来源／A2A／模型持久化和 D5 §3。现有 `admitWorks` 只准入已确认计划；原会话、许可和 A2A Task 都有真实实施 Attempt 外键。P1-01 的 `PROCESS_INPUT` 作业及 Outbox 是准备阶段的输入，不能用虚构 Work 绕过这些约束。

## Goals / Non-Goals

**Goals:** 实现独立且可核实的准备宿主，使用原 Run 的控制门／代际和共享角色容量；产品理解、澄清解释、架构草稿均经官方 A2A JSON-RPC 持久受理。先提供预加载来源的有界结构化模型请求，不执行生成代码。

**Non-Goals:** 不把准备结果当实施完成或人工接受；不默认配置模型、企业身份或 Runner；不在本变更实现完整实施调度、变更应用和公开 Invocation。草稿的实施级 DAG 完整准入由 P1-03 校验；已有草稿也不能越过必要问题或用户确认。

## Decisions

1. **独立准备表及只读许可。** 新 migration 增加 preparation jobs／attempts／steps／slots／Task／inbox。它们引用真实 Run、处理 operation 和不可变角色配置，模型输入输出按 READY 内容哈希登记。原实施表与 Invocation 外键保持不变。准备许可只容许固定来源读取和自身分析发布，不能转换为 Runner／仓库写许可。替代方案是伪造已确认 bootstrap Work，因语义和权限冲突拒绝。
2. **A2A 保留统一角色入口。** 同一已配置角色端点按独立 `devmesh.preparation.v1` DataPart 受理，保存 caller＋operation 唯一 Inbox、标准 Task 和 accepted claim；查询按持久归属路由，未知提交只查询原 Task／operation。端点绑定、Registry 代际、主体权限、Run epoch 及当前许可都在受理事务复核。准备消费者与实施消费者分开，不能消费对方记录；协议没有私有状态。无配置时没有派发或模型调用。
3. **容量、控制与恢复。** 准备槽位与现有 role_slots 用交叉约束保证同 Run 最多两项、同角色最多一项；未知模型／协议结果继续占用。开始、发送和发布均检查当前 Run epoch、OPEN、成员和输入 basis。暂停只落答案与等待作业，不能激活；发送前失败可明确失败，发送后无完整落库回复必须 RECONCILE，不自动重发；重启扫描不把未知标成功。模型请求、配置哈希、输入上下文先登记，再标 SENT，再调用；回复先入内容库和 step，之后才原子发布领域成果。取消请求不会冒充模型已停止。
4. **来源与结构化契约。** 新理解 schema 补齐问题 prompt、可选 options／默认项、冲突双方 sourceRefs；保留旧四角色输出兼容。产品每条需求和冲突均引用本 Run 的消息、附件／成果或指定旧需求版本。来源正文不可改写，查询返回引用及可展示文字；不保存思维链。可信仓库只读 bootstrap 固定 SHA，路径白名单、有界 `git show`，仅预加载文本；没有 install、shell 或写入工具。请求 token、正文、来源数和单步输出有界，拒绝任何未授权 toolCall。
5. **问题和答案版本。** understanding revision、问题内容与 requirementBasis 不可变，OPEN／ANSWERED／SUPERSEDED 放当前状态表。问题变更创建新 revision；旧题提交全批拒绝且不吃掉客户端键。Answer 在一个权限／CAS 事务全批校验后追加，保存计数与解释作业／Outbox 同提交；只有实际回答才增加介入次数。回答值不能引用不存在选项；默认项必须主动选择。解释重试引用失败作业原 answerIds／basis，返回独立 operation，不再写 Answer。答案已保存而解释失败可以准确查询两种状态。
6. **需求与计划分开发布。** 理解先追加 requirement revision，并把当前需求指针与问题状态同事务更新；架构从固定需求版本生成至多 30 项草稿，不能改写有效需求。草稿引用精确 requirementRevision，基线变化使迟到结果不可发布。必要问题未回答时允许可见草稿但不可确认／实施；确认前二次检查问题与当前 basis。查询补入 workspace 理解／待办／处理状态，分页有界，当前成员权限在每次 HTTP 和重放时复核。

## Risks / Trade-offs

- [现有 `publishPlan` 把需求和计划版本绑定推进] → 抽出兼容发布逻辑，让新准备路径引用已存在的需求版本；原低层测试路径仍逐版检查，两个路径共用草稿不可变和确认条件。
- [断开／磁盘失败造成发送结果未知] → 保留原 attempt／step／operation，禁止自动新尝试；完整回复已持久化则可只做领域应用，不再次调用模型。用进程中断与真实内容文件验证。
- [资料矛盾和伪造来源] → schema、哈希、同 Run 引用及来源摘要都验证；结构化输出有效不等于真实模型理解质量，通过受控 Provider 只验证平台规则。
- [无外部环境] → 不依赖它完成代码及本地协议验证，真实模型质量、企业权限和目标 Runner 验收保留待执行。

## Migration Plan

在 migration 7 之后追加 migration 8、校验摘要和备份；既有 Run、会话、发布和输入原样保留。旧 PROCESS_INPUT／Outbox 在首次准备时按原 operation 幂等建 job，失败仍可原键查询。关闭可选消费者可回到仅保存输入的运行模式；不降级数据库、不删除历史或上传文件。验证旧库迁移、失败回滚、真实 FK、交叉容量和模型请求前后崩溃，保存固定提交及原始结果；父工作包／阶段状态仍按实际前置记录。
