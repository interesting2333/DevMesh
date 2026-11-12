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

#### Scenario: Dataset directory survives workspace cleanup
- **WHEN** 工作空间被清理，或请求尝试用路径、链接、硬链接替代 dataset 数据库／日志／侧文件
- **THEN** dataset 保留在受控 ID 决定的独立 Runner 目录，拒绝越界或链接文件，不暴露控制数据库和备份

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
