## Context

父工作包、动机与验收依据见 proposal.md。准确候选由 P1-06 的 candidate_freezes／release_candidates 固定，包含 Work 正式证明、当前最终 Tester 原质量、交付数据方案与实际内容预检集合。其历史正文不可变，当前资格会因来源、计划、问题或材料变化变为 STALE。当前尚无人工审查、dataset、预览运行或接受服务；核心 releases 表不能单独构成 T5 实现。

## Goals / Non-Goals

**Goals:** 按 design/04 §6～8、design/05 T5 完成版本绑定的人工审查、隔离预览、数据准备和接受／发布持久内核，以真实本地 SQLite／文件／HTTP 验证事务、恢复、访问边界。缺少真实后端时关闭相关能力。

**Non-Goals:** 本变更不新增模型权限、不替代企业身份接入、不把镜像字节身份视为构建／健康证明、不在本机模拟 Linux 隔离通过。P3-01 仍负责持续迭代的完整业务流程、迁移负载和旧数据并发写入验收。

## Decisions

### 1. Review is an append-only overlay over an exact candidate

新增候选审查域，读取已冻结且当前有效的 candidate、原需求 revision 和 plan，不更改原质量或 Work 评估。每条必要需求的 acceptance 文本形成稳定逐项人工审查项；额外收集当前最终 Work 的 human-decision 和原质量策略的 human 检查。历史沿用 Work 的人工许可按原正式证明保留，不能重复批准旧失败。自动检查只显示原正式评估，不接受人工把 FAIL 改为 PASS。

需求项 ID 由候选、需求 ID、验收序号和原文本哈希生成；Work／质量人工项使用类型、原操作和 checkId 的独立命名空间，拒绝未知项和重复冲突。每条人工记录保存候选 ID／revision／manifestHash、条目 hash、PASS／FAIL、实际操作者、操作、预期、观察、时间、可选的同 Run READY artifact 引用。预期须匹配展示依据；用户补充操作说明不改变检查定义。不适用只能来自原自动规则，不提供人工随意 N/A。

使用标准 meta、owner 权限和 If-Match；每条修改追加，前置 resultId CAS，防止两个标签页覆盖结论。原键丢回执返回原记录，仍核实当前成员权限。只读历史允许查看，但新记录须候选 CURRENT 且 Run REVIEW／可交互。reviewHash 覆盖完整必要集合、准确候选、当前记录和自动状态；任何结论、候选或依据变化使旧 hash 失效。人工审查不完成 Work、不改变 Run 终态或接受指针。选择此覆盖层是为保留自动原始失败；改写原结果或把 candidate READY 当审批均不成立。

### 2. External effects have durable original identities

dataset、预览、接受准备和发布各用独立持久操作、稳定远端键、请求 hash、状态、证据和查询接口。外部文件／网络／容器动作在 Worker 事务外，Worker 只保存意图和原 ACK。SENT 后失联进入 UNKNOWN，仅查询原对象，不新建替代实例，不重跑迁移。跨项目复合外键和原内容 hash 保护归属；缺失／不一致证据拒绝进入 READY。

首次预览明确 INITIAL 的空／演示数据，迭代预览使用原接受 dataset 的隔离快照并显示时间。预览写入不回写源数据。目录依本地存储 layout 建在独立 Runner dataset 根下，持久 ID 决定目录键，用户路径不参与；停止预览不清 dataset。真实数据完整性／迁移必须由可信适配器实际执行，未配置时明确不可用。

### 3. Preview access is separate from platform identity

预览目标 origin 必须与平台 origin 不同，服务端固定允许目标和路由，禁止任意 URL 代理。成员先经平台鉴权获取短期、preview audience、指定 previewId／projectId／到期的访问凭据；平台 Cookie 不转发到生成应用，响应去掉上游 Set-Cookie 等平台不允许字段，iframe sandbox 与 CSP 限制平台身份读取。网关检查权限、用途、过期、状态、原 image／dataset 绑定及写门；地址不可用显示恢复中，不伪造健康。预览到期和取消只停止对应未接受实例，已接受版本通过独立 release 归属保护。

### 4. Acceptance preparation and commit are separate facts

负责人显式请求接受，固定 candidate revision／manifestHash、reviewHash、当前 acceptedReleaseId、数据策略／确认决定和 image digest。准备凭证由可信适配器绑定以上依据、准确 targetDataset、schema／迁移哈希、完整性与真实服务健康／写门状态；客户端、普通模型或自报健康不能签发。首次准备不创建旧数据；保留原数据必须持有递增 fencing 写门，排空在途写，最新一致快照后迁移；REPLACE 必须准确独立确认，不能把预览克隆悄然覆盖原数据。

T5 在短事务复查原准备、当前候选、完整审查／质量、内容 READY、准确原接受指针、Run／计划／epoch 和无未知动作；一次提交不可变 Release、指针、必要待人工 Work 的最终人工完成、Run COMPLETED、operation、promotion Outbox 和事件。外部准备或内容实际读取在事务外，提交中重核其准确 hash／版本。回滚不显示接受成功。提交后不得因路由或打包失败撤销接受记录。

### 5. Promotion is recoverable without replaying acceptance

promotion 使用 releaseId 作为幂等键，含准确 image／dataset／原写门 fencing。提交后消费者仅路由／开放新写门；ACK 丢失查原发布，只有原目标一致才完成。失败或 UNKNOWN 保留“已接受，预览恢复中”，不重复创建 Release、不重跑测试／迁移、不重新接受。旧写门在准确切换已证实前保持关闭，不同时开放两份数据。导出打包使用独立任务和失败状态。下载和只读查询没有接受副作用。

### 6. Rejection and scope correction remain explicit

退回保存准确候选、原范围缺陷／新增需求分类及证据；用户可纠正分类。原范围问题连接新前向修复，新范围连接变更审查和新计划，不通过更改候选审查表扩写已确认范围。P2-03 尚未实现的变更应用只保存待处理事实，不伪造已应用。

退回先保存 NOT_APPLIED 的明确下一步，不自动调用修复／变更。每个逻辑退回有稳定 ID 与当前记录 CAS；纠正和有理由撤回均追加历史。整个 Run 仍有 OPEN 退回时阻止接受准备，创建新候选不能隐去旧待处理问题。历史候选允许负责人明确撤回已有退回，仍禁止新批准或新 OPEN 退回；撤回只解除该待处理项，不改变人工检查或自动质量。原范围问题必须绑定已有审查项，新增需求可无既有条目，不能借分类更改验收定义。

### 7. Intent acknowledgement does not assert an external effect

迁移 32 为私有 Worker 域新增 preview_backend_policies、datasets、previews、preview_effects 与不可变观察历史。配置策略固定 project、template／schema、Runner、backendRef 和可信后端主体；仅显式可信装配可使用该内部登记接口，当前没有公共 HTTP／MCP 登记或回执入口。项目 owner 的普通主体不能替代已配置后端主体提交成功回执。未登记策略返回不可用；策略登记本身不启动服务，也不证明后端已配置／健康。

owner 通过标准 meta／If-Match 保存准确候选上的 dataset 或 preview 意图。通用 operation 的 SUCCEEDED 表示意图事务已保存；外部执行状态必须读取独立 preview_effects，初始 PREPARED。原键恢复的是同一资源／操作，返回其当前状态，不是重新执行。effect 固定 requestHash、原 remoteKey、准确镜像／dataset／候选和服务主体；数据库短事务只允许一次 PREPARED→SENT 的 dispatch=true，SENT／UNKNOWN／终态再请求均为 false。后端失联或无充分证据保持 UNKNOWN，仅检查原对象。未发送且已过时的 PREPARED 可由可信后端明确关闭为 FAILED，释放后续准入；不把它伪装成外部动作完成。存在未核实意图时拒绝新建替代 dataset／preview。

成功回执核实原 requestHash 与类型、dataset／存储键／来源／schema、准确 preview／image／instance 和观察时间；终态回执不可改写，观察追加保存，并与对象状态及领域事件同事务提交。后端动作、文件操作和网络请求全部位于这些事务外。后续适配器负责实际执行、可靠本地日志、内容／健康证据；本步骤的受控回执测试只证明持久核验规则。

后端重启可按显式 project／policyHash 使用受限分页扫描原 PREPARED／SENT／UNKNOWN 操作；只有配置的原后端主体可扫描。游标按不可删除原行的位置排序，每轮恢复扫描从 0 开始，不把它当作状态变化流；找回 SENT／UNKNOWN 只查询原 remoteKey，不申请第二次执行许可。实际调度消费者仍由后续适配器实现。

首次数据只允许冻结方案声明的 EMPTY／DEMO；迭代预览始终克隆原接受 dataset，即使最终接受方案选择 REPLACE 也不提前清空旧数据。源接受指针、项目、可用状态与 schema 需准确匹配；跨 schema 的生产迁移尚未配置时关闭，不将简单复制视为迁移成功。dataset 不能同时绑定两个可写预览。停止意图使用独立 previewRevision／impactReviewHash，只有原实例可核实退出后才 STOPPED／EXPIRED；已被 Release 引用的候选／dataset 拒绝新停止和停止派发。

RunnerDatasetPaths 从已初始化且身份匹配的 Runner layout 解析 `datasets/<projectId>/<datasetId>/app.sqlite` 和同目录 `operation.json`，调用者不能传任意路径；控制面、备份和 Runner 根互斥。路径组件、数据库／日志／WAL／SHM 的链接与硬链接均受检查。该目录独立于 workspaces，预览停止及工作空间清理不删除 dataset；当前只实现保留，不提前实现到期 GC。实际 SQLite 一致快照、数据文件操作恢复、真实实例健康／到期、独立 origin 与接受发布仍按后续步骤实施。

## Risks / Trade-offs

- [无真实模型／容器／OIDC] → 本地可验证接口、签名用途、访问隔离和恢复；真实构建／启动／健康和人工产品验收单列缺项，生产能力未配置即关闭。
- [复用旧质量或人工结论] → 绑定候选完整 manifest、原质量、条目和 reviewHash；新候选重新审查，原失败追加保留。
- [接受与外部动作竞态] → 数据准备 fencing、原接受指针 CAS、短 T5、单一发布 Outbox；未知不重发。
- [大候选／审查阻塞 Worker] → 沿用 256 KiB 请求限制，逐项写入和分页历史，当前投影设置条目和序列化总量上限；不返回无界正文列表。
- [身份尚未接入] → 复用显式 local-development 的可信平台主体边界；公共服务 token 无人工确认入口；不将本地测试主体称为企业用户认证通过。

## Migration Plan

按现有前向编号新增审查、dataset／预览、接受准备与发布表及内容外键，启动前由现有备份／migration 流程保护。先部署默认关闭的领域 API 与只读投影，再显式配置可信适配器和独立预览 origin。历史候选不回填人工通过、准备凭证或 Release；无 candidate_freezes 的旧候选只能历史阅读。故障回退关闭新准入，保留已提交记录并恢复原操作，不回滚已接受事实或清理 dataset。
