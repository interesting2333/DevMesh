## Purpose

提供准确候选上的逐项人工审查、隔离预览与业务数据准备，并在满足原质量、审查和数据条件时原子保存接受事实。把候选就绪、人工通过、版本接受和实际发布分别呈现，保障中断后恢复原操作以及业务数据保留。

## ADDED Requirements

### Requirement: Exact candidate review with immutable human observations

The system SHALL 从准确冻结候选及原需求生成完整必要审查集合，区分原自动事实与人工结论。人工结果 MUST 绑定候选 revision／manifest、检查依据、操作者、操作、预期、观察和时间，追加保存并采用权限、幂等及当前记录 CAS。未知项、任意 N/A、用人工覆盖自动失败或对陈旧候选新批准 SHALL 被拒绝。

#### Scenario: A necessary item is missing or failed
- **WHEN** 某必要需求项未检查、人工失败或原自动质量未通过
- **THEN** 逐项显示该状态和依据，完整审查不得显示 PASS，不开放接受

#### Scenario: Candidate changes during review
- **WHEN** 源码、计划、材料、候选版本或有效依据变化，随后提交原审查或旧 reviewHash
- **THEN** 拒绝新结论／接受并显示 STALE，历史原结论保持可读且不迁移到新候选

#### Scenario: Concurrent correction and lost acknowledgement
- **WHEN** 两个不同操作基于同一当前记录提交相反结论，或原成功操作丢回执后重试
- **THEN** 仅一个 CAS 修改成功，历史不覆盖；原成功操作恢复同一记录，成员被撤销后不再返回受保护内容

### Requirement: Isolated preview and durable dataset lifecycle

The system SHALL 将生成应用置于独立 origin 和独立业务 dataset，绑定准确候选、镜像和数据来源。迭代预览 MUST 使用隔离快照，停止／到期与数据保留分开。访问 MUST 验证项目权限、用途、期限及状态，不能转交平台身份或允许任意目标代理。

#### Scenario: Preview writes and expiry
- **WHEN** 用户向预览写入业务记录，然后预览到期或被取消
- **THEN** 原已接受数据不被改写，准确实例停止，源码／报告／历史与按策略保留的数据仍存在，旧已接受实例不被连带停止

#### Scenario: Wrong audience or origin
- **WHEN** 平台 origin 被配置为预览目标，或访问凭据用途／项目／预览／期限不匹配
- **THEN** 配置或访问被拒绝，平台 Cookie 和身份不发送给生成应用

#### Scenario: Durable intent and uncertain original effect
- **WHEN** dataset／预览意图已经提交，首次派发后丢失回执或服务重启
- **THEN** 原键恢复同一资源与原操作；只有首次 PREPARED 派发获得执行许可，SENT／UNKNOWN 只查询原对象，未核实前拒绝新建替代对象，不把意图提交称为启动完成

#### Scenario: Wrong backend receipt or accepted instance cleanup
- **WHEN** 非配置后端、不同 requestHash／image／dataset／instance 的回执到达，或停止意图指向已接受版本
- **THEN** 拒绝改变原执行事实或派发停止，保留原数据和版本归属；观察／对象状态／事件失败时全部回滚

#### Scenario: An earlier successful start no longer proves current availability
- **WHEN** 原启动成功后没有新鲜健康观察、实际检查失败或原实例失联
- **THEN** 保留不可变的原启动成功事实，但关闭当前可用性；持续检查原实例，恢复时不新建替代实例或修改原完成回执

#### Scenario: A delayed health observation attempts to replace a newer fact
- **WHEN** 慢响应使用旧 sequence 或更早时间提交，或者观察试图替代已经核实的实例／端口
- **THEN** 拒绝写入，保留准确较新事实；历史、实例绑定、状态与事件保持原子，不通过健康心跳覆盖用户操作版本

#### Scenario: An unaccepted preview expires during recovery
- **WHEN** 原实例已核实且预览到期，或到期时原实例仍未知
- **THEN** 只对已核实的原未接受实例建立一个持久停止操作并核实退出；未知实例继续查询，已接受版本／数据不被停止，不把意图或超时当作已退出

#### Scenario: Jobs and previews compete for one Runner capacity
- **WHEN** 作业或预览申请资源，且 Runner 上已有运行中、停止中、失联或重启恢复的原占用
- **THEN** 在同一事务核实全局 slot／CPU／内存，任何主体不能绕过原占用；UNKNOWN 不释放资源，已派发预览仅在准确原实例退出核实后释放

#### Scenario: A reservation acknowledgement or dispatch acknowledgement is lost
- **WHEN** Runner 预留或唯一派发位已提交但 ACK 丢失，随后重试或重启
- **THEN** 原操作返回同一不可替换预留，派发位不再次给出执行许可；未派发取消可以释放，已派发未知预留继续保留并只查询原对象

#### Scenario: A container action loses its acknowledgement
- **WHEN** 原 network／create／start／stop 动作的派发位或执行 ACK 丢失，或者 Runner 重启
- **THEN** 只检查原持久名称、profile、labels 与实例，不重发原动作；不同镜像、目录、网络或实例不能替代原对象，未核实退出继续占用资源

#### Scenario: Generated application tries to change preparation evidence
- **WHEN** 预览容器写业务数据库，或试图改写同目录准备日志、完成回执和应用身份 marker
- **THEN** 数据库及 WAL 在独立 dataset 内按配额可写，原日志／回执／marker 的只读挂载受到核验，不开放平台目录、备份、socket 或凭据

#### Scenario: Dataset directory survives workspace cleanup
- **WHEN** 工作空间被清理，或请求尝试用路径、链接、硬链接替代 dataset 数据库／日志／侧文件
- **THEN** dataset 保留在受控 ID 决定的独立 Runner 目录，拒绝越界或链接文件，不暴露控制数据库和备份

#### Scenario: Actual initialization matches the pinned template
- **WHEN** 显式配置本地可信数据适配器，为当前冻结 INITIAL 方案准备 EMPTY 或 DEMO
- **THEN** 创建能被原模板直接读写的实际 SQLite、独立应用身份和 marker，保存不可变原请求及完成回执；未知模板或 schema／迁移不可用

#### Scenario: A snapshot observes only committed source data
- **WHEN** 同 schema 源数据库有已提交 WAL 和尚未提交事务，随后准备隔离预览副本
- **THEN** SQLite 一致副本包含已提交内容、排除未提交内容；源与副本之后的业务写入互不回写，副本具有新的应用身份

#### Scenario: An original file preparation fails or loses an acknowledgement
- **WHEN** 实际准备因容量等原因留下部分文件、完成后丢回执、控制面观察提交后丢回执，或服务重启
- **THEN** 原日志只创建一次，部分文件保持 UNKNOWN 且不重建；已完成操作通过原文件证据或已提交控制记录恢复，不重复初始化／复制，源后来不可用不使已完成副本依赖源恢复

#### Scenario: Dispatch permission acknowledgement is lost
- **WHEN** 唯一派发许可已提交但调用者没收到许可，也不能证明原动作已完成
- **THEN** 后续只核实原对象并保留 UNKNOWN，不以重试为由再次初始化，不伪造 READY 或解除未知副作用阻塞

### Requirement: Durable acceptance preparation without destructive defaults

The system SHALL 在外部准备前固定候选、审查、原接受指针和数据策略，保存原操作身份。保留数据 MUST 用带 fencing 写门排空旧写入并快照最新数据，经准确迁移／完整性和服务健康验证后才准备完成；替换数据 MUST 有准确明确确认。未知结果 SHALL 查询原操作且不重复执行副作用。

#### Scenario: Unconfirmed replacement or stale preparation
- **WHEN** 没有用户确认就要求清空／替换数据，或准备后候选／计划／数据策略发生变化
- **THEN** 拒绝准备或提交，保留原接受版本和原数据，不把预览克隆当作默认替换来源

#### Scenario: Preparation acknowledgement is lost
- **WHEN** 数据或镜像准备已经发送但响应丢失
- **THEN** 持久状态保持待核实，查询原对象，不新建 dataset 或重跑迁移，不同时开放新旧写门

### Requirement: Atomic acceptance with independent publication recovery

The system SHALL 在短事务重核候选、完整审查、准确原质量、准备凭证、当前接受指针和未知副作用，原子创建不可变 Release、更新接受指针、完成 Run 并保存发布意图。事务外准备和发布不得占用该事务。已提交事实 MUST 在路由或打包失败后保留，恢复只处理原发布／导出。

#### Scenario: Acceptance transaction fails
- **WHEN** T5 保存过程发生错误
- **THEN** Release、指针、Run 完成和发布意图全部回滚，不显示接受成功

#### Scenario: Publication fails after acceptance
- **WHEN** 接受已提交而路由切换或打包失败
- **THEN** 显示已接受及对应恢复状态，原 releaseId 可幂等恢复发布，不创建第二次接受或重跑验证／迁移

#### Scenario: Download without acceptance
- **WHEN** 用户只下载部分成果、查询候选或打开预览
- **THEN** 不创建 Release，不改变接受指针或下一次迭代起点

### Requirement: Rejection preserves scope and user correction

The system SHALL 保存准确候选退回依据，区分原范围缺陷与新增需求，并允许用户纠正分类。新增范围 MUST 经过变更与新计划确认，不能通过人工审查结论直接获得实施授权。

#### Scenario: User corrects rejection classification
- **WHEN** 用户把系统建议的新增需求改为原范围问题，或反向纠正
- **THEN** 追加保存纠正及依据，原分类保留，后续流程使用明确当前分类且不隐式应用未确认变更

#### Scenario: A new candidate cannot hide an unresolved rejection
- **WHEN** Run 中仍有 OPEN 退回时冻结新候选，或负责人明确撤回原历史候选的退回
- **THEN** 新候选继续展示待处理项并阻止接受准备；有理由撤回追加保留历史，只解除该项，不批准质量或人工检查
