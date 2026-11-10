# DevMesh 项目管理

本项目使用 Git + OpenSpec + 仓库任务台账。Git 保存版本，OpenSpec 保存一次变更的理由、设计与实施步骤，台账回答“谁在做、做到哪里、还在等什么、凭什么算完成”。

本次建立结果见 [初始化验证记录](./初始化验证记录.md)。

## 记录分工

| 记录 | 保存内容 | 维护规则 |
| --- | --- | --- |
| PRD／技术设计／实施文档 | 目标、架构、不变量、36 个工作包、验收定义 | 变更影响这些内容时同步修订，保留 Git 差异 |
| [tasks.json](./tasks.json) | 工作包状态、责任职能、实际负责人、依赖、阻塞、关联变更、代码和证据、阶段门槛 | **唯一的工作包状态源**，不得另建一份人工状态表 |
| [任务台账.md](./任务台账.md) | 按状态源生成的进度与依赖视图 | 运行 `node project/manage.mjs render`，不直接修改 |
| `openspec/changes/<name>/` | 当前变更的 proposal、design、细分 tasks 和必要的增量 specs | 变更名用英文 kebab-case；在 proposal 中写明父工作包 ID |
| `openspec/specs/` | 已实施并通过验证、完成归档的能力规范 | 当前应用尚未实施，保持为空；设计目标不提前当成已实现能力 |
| [evidence/](./evidence/README.md) | 可定位的执行记录、结果摘要与原始材料引用 | 写清版本、实际环境和失败项；大体积材料放制品存储并附摘要与校验值 |

管理工具本身不提供服务端看板、自动排期或多人锁。多人协作通过分支、PR 和评审合并 JSON 变更；同一工作包约定一位实际负责人。以后接入 Issues／外部看板时使用相同工作包 ID，并明确唯一状态源的迁移方式。

## 初始化起点与实时进度

管理初始化时，36 个开发工作包均为 `NOT_STARTED`，G0～G4 均为 `PENDING`，仅 P0-01 满足初始依赖。已建立 [bootstrap-devmesh-workspace](../openspec/changes/bootstrap-devmesh-workspace/proposal.md) 变更；后续实际进度、步骤和证据统一查台账与变更内的 tasks，不在此重复维护状态。

本次建立 Git、台账和 OpenSpec 属于管理准备，不能视为 P0-01 整个应用 workspace、构建与跨平台验证完成。没有虚构负责人、工期、评审结论或测试通过记录。

## 每个工作包怎么推进

1. **选择与认领。** 运行 `node project/manage.mjs next`，用 `show P0-01` 看完整范围。在 `tasks.json` 填实际 `owner`、`startedAt` 并将状态改为 `IN_PROGRESS`。如果只是提前做接口夹具或可行性调查，先记在备注或独立探索变更；正式工作包仍须满足前置和上一阶段门槛。
2. **准备变更。** 已有关联变更时继续使用。新工作使用 `node project/openspec.mjs new change <英文名称> --schema spec-driven` 建目录，在 proposal 写父工作包 ID、范围和验收依据，补齐 design、tasks；改变能力行为时提供增量规格。也可以直接让协作 Agent 按这些要求生成。
3. **实施与记录。** 按变更内的任务推进，有真实产物才勾选。范围变化先修订变更文件，再同步受影响设计和台账基线，不静默绕过架构约束。
4. **提交复核。** 保存实际执行记录，在台账填写 `codeReferences`、`evidence`，转为 `IN_REVIEW`。证据路径使用仓库相对路径或 HTTPS 制品链接，不填无法复查的“测试通过”。
5. **结束工作包。** 按实施文档完成定义复核后，写 `reviewer`、`reviewNote`、`completedAt` 并改为 `DONE`。复核人与负责人按实际情况填写。当前单 Agent 实施由后续轮次执行代码与原始证据复核，明确记录同一 Agent 的身份和复核范围；不得冒充独立人员或人工签认。团队接入后的独立评审及阶段／产品验收仍单独记录；实际复核尚未完成时保持待复核。
6. **归档变更与评审门槛。** 仅在变更全部完成、验证和复核有依据后执行归档。归档后运行 `render`，台账会解析归档路径。阶段内任务全部完成后，另行记录门槛评审；任务全 DONE 不自动等于 G0～G4 通过。

归档操作会更新 `openspec/specs/`，因此应用变更应在工作完成后再归档。纯管理、文档或不改变能力行为的工程任务在 `.openspec.yaml` 设置 `skip_specs: true`，如首个 P0-01 变更；不能为通过格式校验而虚构能力规格。

一项变更跨多个工作包时，在各工作包 `changes` 中关联同一个名字；子步骤完成不能直接推导父工作包 DONE。一项工作包拆为多个变更时保留父 ID，并关联全部变更。OpenSpec 的 artifact 状态表示“实施材料已备齐”，不表示实现完成。

## 常用命令

```powershell
# 每天先看进度和可开始项
node project/manage.mjs status
node project/manage.mjs next
node project/manage.mjs show P0-01

# 修改 tasks.json 后更新视图并校验
node project/manage.mjs render
node project/manage.mjs check

# 查看变更与未完成的实施步骤
node project/openspec.mjs list
node project/openspec.mjs status --change bootstrap-devmesh-workspace
node project/openspec.mjs instructions apply --change bootstrap-devmesh-workspace
node project/openspec.mjs validate --all --strict --no-interactive

# 变更完成并复核后归档；不要用这条命令把未完成任务强行关单
# node project/openspec.mjs archive <change-name>

# 保存进度
git status
git add <本次实际修改的文件>
git commit -m "docs(project): update P0-01 progress"
```

台账检查包含：实施文档逐项对照、基线哈希、任务编号／依赖无环、前置任务与阶段门槛、关联 OpenSpec 路径、完成记录所需字段，以及 Markdown 视图是否过期。它能发现记录缺漏，不能替代真实构建、产品验收或人工复核。

状态源为普通 JSON：修改后先运行 `render`，若前置、必填字段或基线不匹配会直接报错。新增任务应先同步实施文档；基线发生合理修订后，评估关联任务／验证影响，再更新 `baselines` 中的 SHA-256。不要把哈希变化本身当成已完成影响分析。

四份基线文档的哈希针对原始字节，`.gitattributes` 对这些文件关闭自动换行转换，保证 Windows／Linux checkout 不因换行变化产生假漂移；修改这些文档后仍需评估并更新实际基线。

## 阻塞、阶段门槛和证据

`BLOCKED` 必须有实际负责人、`blockedReason` 和 `nextCheck`，后者写解除条件或下一次核实安排。正常等待前置任务保持 `NOT_STARTED`，由视图显示所需任务和门槛。

G0～G4 的状态在 `tasks.json.gates` 中维护，可用 `PENDING`／`IN_REVIEW`／`FAILED`／`PASSED`。通过时必须填写 `owner`、`reviewer`、`buildRef`、`evidence`、`decision`、`reviewedAt`；使用 [验收记录模板](./templates/验收记录.md) 保存实际记录。上一门槛未通过不进入下一阶段正式执行。

没有目标环境或真实依赖时，记录待验证和缺项；Windows 本机检查不能替代 Linux Runner／gVisor 隔离验收。安全信息仅记录 credentialRef 或领取方式，真实 token、密钥、用户会话和运行数据不进 Git。

## 可以直接怎么跟协作 Agent 说

- “开始 P0-01，继续已有 OpenSpec 变更，按实施文档推进，更新台账并给出实际验证证据。”
- “看看当前有哪些阻塞，下一项可以做什么。”
- “P0-04 要调整本地会话布局，先查现有设计，创建变更并同步受影响任务和验收。”
- “复核这个工作包，检查产物、提交版本和验收证据；满足完成定义再关单。”

这些请求会维护同一份仓库记录。OpenSpec 依赖已在 `tools/openspec` 固定；新机器先运行 `npm ci --prefix tools/openspec`。应用使用的 Node／pnpm／TS 版本按技术设计另行验证、锁定，不以管理工具当前可运行为通过依据。
