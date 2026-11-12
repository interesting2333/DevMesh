## Context

See proposal.md。当前 `testerOutput` 只约束报告引用的 targetCommit 相等；Runner 输出有准确 job／operation／request hash、路径、SHA-256、大小和退出事实，PipelineCoordinator 仅采集原作业事实；issues 工具也明确 finding 不等于验证通过。`recordVerifiedWork` 是可信 IPC，现由调用方直接提供 success/findings，尚无原报告采集、独立解析或 ReleaseCandidate 冻结。模板固定 Vitest 4.1.11／V8，输出 Istanbul 兼容 coverage-final.json，已有完整业务 include，适合实现明确版本的有界解析器。

## Goals / Non-Goals

**Goals:** 按 D2 ResultVerifier、D4 §3/6、D5 事务与引用规则，将原执行／原报告、源码范围、独立质量计算、Work 验证和候选修订闭合；确定失败与未知分别保留。覆盖 T10、R07/R12/R13/R19。

**Non-Goals:** 降低 80/70 门槛；在控制面执行生成业务或报告内脚本；把脚本化作业视为真实 runsc；在本包实现接受后的数据迁移／路由切换，或把人工检查自动判为通过。

## Decisions

### Trusted policy and immutable report inputs

新增版本化质量策略契约，冻结 requiredCheckIds、检查种类／生产侧、批准命令、测试身份与需求映射、业务 include/exclude、必要报告集合和零分支 N/A 规则；规范哈希与准入 inputManifest.checkConfigHash 一致。它是可信模板／项目配置，模型工具不能注册或放宽。现有仅含配置哈希的历史激活不倒填“已验证策略”，继续保留待配置，不推定通过。

可信采集服务以原 pipeline/job 查询实际状态，流式读取有界 Runner 输出和日志并核实 SHA／大小。先持久验证原操作与固定输入，报告内容用专用内容 target 在登记事务内建业务外键。原字节落盘后独立解析，不从 Agent 提供的 status、百分比或 artifact 名称推导通过。请求丢回复只查原操作；SENT/未知作业不重跑。前后端报告由策略指定的生产侧与来源作业匹配，不能用重复上传同一报告充数。

### Pure bounded report and coverage evaluation

独立 TypeScript 包不依赖模型执行，先实现纯解析和计算，再接可信采集与 Worker。首版原格式为模板实际使用的 Istanbul/V8 JSON 及明确版本的结构化测试结果，命令／类型／构建报告仍绑定原 Runner 事实。未知格式明确失败，不自动猜测。

准确 Git manifest 冻结全部业务文件及内容哈希；可信插桩／报告映射保留每个文件的完整位置集合，包含未执行文件。相同 SHA 的 overlapping producer 对共享源码必须给出一致位置身份；冲突、无法 source-map、缺文件或缺必要 producer 返回缺失／过期，不把未知位置当已覆盖。路径只接受规范相对源码名，绝对路径仅由部署固定 prefix 映射；拒绝越界、重复规范路径和大小写歧义，不读取报告指定的宿主路径。计数、文件量、深度与正文有明确上限。

Istanbul statement start.line 去重形成可覆盖行，同一行任一 statement 有命中即覆盖；分支身份取类型、原位置和备选路径位置，不使用各生产侧自增数字 ID。共享源码命中按身份并集，次数不重复累加分母。阈值使用整数交叉相乘，不因浮点或显示四舍五入放行。非空业务范围和有效完整映射下零分支需冻结规则及证据；空业务集合不能 N/A。

### Verification transactions and compatibility

向前迁移保存验证操作、冻结 basis、原报告元数据／字节引用、逐项 PASS/FAIL/MISSING/NOT_APPLICABLE/STALE 和最终解析结果。Worker 从原源码 ACK／验证分配、Runtime 角色候选、当前 Work revision／epoch、策略与报告来源重建输入，异步读字节／解析在事务外；提交前再次核对 basis。未知写工具／Runner Job 阻止完成验证与冻结。

ResultVerifier 只通过可信接口提交可复核计算；普通 MCP 仍只记录发现和原 Job。将调度 `recordVerifiedWork` 的正式验证入口绑定这些持久事实，保留必要历史夹具的显式兼容路径，但生产托管来源不能经旧接口绕过。更改行为需同步增量规格和实际测试，不把伪造 success 留作部署默认。

### Findings, forward repairs and candidate revisions

复用已有 issue 历史，不覆盖原失败；缺陷保存复现、预期和报告引用。新的受信任修复规划操作以原失败为依据，生成 developer fix → tester reverify 的前向 Work，最多两轮，纳入 DAG 30 项与当前计划确认约束。涉及需求／接口变更进入已有审查，不自动确认。复验只能关闭确切修复 SHA 和原缺陷，旧通过不沿用。

候选冻结采用原操作与不可变 candidateRevision：从当前 run-candidate 源码 ACK 和已验证集合推导准确版本，核对必要检查、缺陷、未知写操作、构建哈希／镜像、数据方案及必要材料。自动检查通过才产生可供人工审查的候选，人工项显示待完成；P1-07 在接受事务再次复核全部人工及数据准备凭证。候选冻结不移动接受指针。材料变化生成新修订，旧审查不迁移。

## Risks / Trade-offs

- 不可信报告／超大数据 → 固定格式、上限、来源作业、字节哈希、位置和完整范围校验，不执行脚本。
- 自报覆盖率刷分 → 全量业务清单、必要 producer、原始位置计数，缺失不视为 0 分母。
- 历史可信 IPC 绕过 → 正式托管完成必须匹配持久验证；兼容范围显式测试，不宣称历史材料具有新证明。
- 解析后来源改变／GC 竞争 → basis 重核与内容 target 原子外键；旧报告保留，候选新修订。
- 无 Linux、模型、真实 Runner 资源 → 本地格式／存储／协议组合照常实施；真实执行来源和门槛逐项记未执行，不伪造通过。

## Migration Plan

在迁移 20 后增加连续版本，历史 SQL／哈希不变；升级前独立一致性备份。策略显式注册且默认不开放验证／冻结，不自动补齐历史缺失报告。应用回滚保留原报告与日志、缺陷、验证和候选修订；不降级数据库。纯计算边界先验证，再做真实 SQLite／Git／HTTP 原操作组合，最终固定提交干净 checkout 冻结安装和适用回归；验收和父工作包状态分别记录。
