# P1-07 预览生命周期控制面开发复核

## 范围和当前状态

本记录覆盖开发子项 2.3 的控制面部分：持续健康观察、准确原实例／端口、启动／停止／到期的私有恢复器及受限 HTTP 检查。它承接 [持久意图](./preview-intent-development-review.md) 与 [实际 SQLite 数据准备](./dataset-preparation-development-review.md)。完整 2.3 继续未勾选；正式 P1-07 仍等待 P1-06／G0。本记录是同一 Codex 的实施与复核，不是独立评审、人工产品或阶段验收。

真实执行 SQLite 迁移／事务、实际控制 Worker 关闭／重开、实际本地数据文件与原模板 CRUD、实际控制定时轮询和 loopback HTTP。`ControlledPreviewBackend` 明确提供容器／健康／退出事实，不是生产后端或容器；来源／准入／Runtime 与 Release 归属仍为 fixture。测试中的成功不能推导准确镜像实际运行／健康，当前平台启动也未自动装配预览消费者。

## 状态和原操作约束

迁移 33 增加不可变 `preview_runtime_observations`。复合外键把观察绑定到准确 preview／原启动 operation／requestHash；历史追加保存，并与实例绑定、状态变更、Run 版本及事件同事务提交。heartbeat 没有状态／身份变化时只追加检查时间，不持续提高用户操作的版本。

原启动成功是不可变的历史事实。当前 `availability=AVAILABLE` 另须 dataset READY、preview READY、未到期，以及 30 秒内同一原实例的 HEALTHY 观察。当前检查失败、失联或变旧就关闭可用性，不改写原 SUCCEEDED。首次 READY 回执还须同一次准确健康观察，单个成功回执不充分。停止完成须同一次原实例 EXITED 观察，意图、超时或停止命令 ACK 均不等于已停止。

新启动请求固定候选已核实 OCI manifest／config／层身份、准确 dataset 准备 operation、模板／schema 和受控存储键。停止请求固定原启动 operation／requestHash 与 instanceId。新必需绑定不从旧请求无证据补出。私有 API 只有原策略配置的后端主体可用；普通 owner、错误请求 hash 和主体均被拒绝。

Runtime 观察使用外部 I/O 前取得的 sequence CAS 与观察时间，旧响应不能覆盖新事实；原实例核实后不得替代，首次核实的 loopback 端口不得漂移。UNKNOWN 保留已经知道的 instanceId，以便继续查原对象和准确清理。

`PreviewLifecycleManager.advance` 只在首次派发许可明确返回 true 时调用后端 execute；SENT／UNKNOWN 只 inspect。执行动作前，后端必须调用 `verifyPreviewExecution`，重新检查当前授权／候选／到期或 Release 归属。许可提交 ACK 丢失不执行第二次；动作 ACK 或观察提交 ACK 丢失恢复同一操作。控制器关闭后拒绝新动作；并发初始化恢复器也被拒绝。

`reconcilePage` 扫描原生命周期，包含已启动实例的持续检查，每轮从游标 0 开始。`start` 只接受显式项目／policyHash，使用不重叠的定时轮询；这不是平台默认自动启用。到期且原实例已知时，由配置服务主体保存一个幂等的停止 operation；原实例未知继续核实，不另建替代实例，不伪造退出。已接受版本拒绝到期清理和最后一步的停止授权。停止不删除 dataset。

## 实际 HTTP 边界

`probePreviewHealth` 只接受原容器检查应提供的 `127.0.0.1` 高位端口，固定请求 `/api/health`。它使用独立 HTTP 请求，无平台 Cookie／Authorization、无重定向、无调用者 URL，最多读取 4 KiB，校验 200／JSON／严格 ready 结构并限制超时。端口身份仍须未来实际预览后端从原容器事实取得；探针不能自行证明容器、镜像或 dataset 身份。

实际 HTTP 测试使用明确测试服务器，检查请求路径和无身份头；200 JSON 通过，重定向不访问第二个服务，HTML／大响应／多余字段／超时失败，非 loopback 目标和低位端口拒绝。它没有启动生成应用镜像。

## 验证与失败证据

- [lifecycle-v17-failed](./development/lifecycle-v17-failed/evidence.json)：安装通过，类型拒绝 UNKNOWN 事实中的未解析品牌 ID。改用共享 `previewRuntimeFact` 解析器，没有类型强制转换；没有执行测试。
- [lifecycle-v18-failed](./development/lifecycle-v18-failed/evidence.json)：类型通过，Lint 扫到上一轮保留的验证 driver，报未使用变量。保留旧证据字节，根 Lint 精确排除 `project/evidence/**/validation-driver.mjs`；活跃源码／脚本／测试继续检查。原失败日志与源码均保留。
- [lifecycle-v19](./development/lifecycle-v19/evidence.json)：安装／类型／Lint／当前依赖构建、新生命周期 13/13、原意图／目录 14/14 通过。
- [lifecycle-v20](./development/lifecycle-v20/evidence.json)：增加复合外键、关闭后的最后授权和旧版本实际数据保留检查；完整相关回归 149 项，147 通过、2 条条件跳过。之后补齐恢复器并发初始化守卫和实际定时器测试。
- [lifecycle-v21](./development/lifecycle-v21/evidence.json)：最终 15 项检查全部完成；150 项测试，148 通过、2 条条件跳过，无失败／取消。16 项生命周期测试全部通过，包含真实控制定时器在没有新用户请求时处理到期，以及并发初始化被拒绝。运行期间源码指纹未变化，保留实际 driver、命令数组及原日志 SHA。

| v21 检查 | 结果 |
| --- | --- |
| 离线冻结安装、类型、Lint、当前 contracts／storage／runner／platform-core 依赖构建 | 全通过，安装使用 `--frozen-lockfile --offline --ignore-scripts` |
| 生命周期／HTTP | 16/16 |
| 原意图／目录 | 14/14 |
| 实际 SQLite 数据准备 | 11/11 |
| 平台 smoke | 9 通过，1 条 POSIX 信号条件跳过 |
| 调度 | 10/10 |
| 审查／退回 | 13/13 |
| 原冻结 | 14/14 |
| SQLite 存储／历史升级至 33 | 28/28 |
| Runner | 15 通过，1 条真实 Linux Docker 条件跳过 |
| 契约／OpenAPI | 契约 18/18，生成一致性通过 |

运行环境为 Windows x64／Node `v24.13.1`；这是本工作树的完整相关回归，不是全仓库／干净 checkout 验证，也不是实际容器运行。条件跳过不计为通过。

归档证据生成后再次执行 Lint、台账检查、OpenSpec 严格校验、设计主文一致性与差异格式检查，全部通过；见 [post-retention-checks.json](./development/lifecycle-v21/post-retention-checks.json)。同时核实 386 个当前源码输入、41 份原日志、76 项保留材料和 26 个失败源码快照的 SHA 一致。记录／格式检查不替代应用或产品验收。

新增生命周期测试的实际范围包括：完整镜像与数据准备绑定、无后端默认关闭、30 秒健康过期、失联／恢复不替代实例、启动 ACK／派发 ACK／观察提交 ACK 丢失、停止未知只查原对象、实际 SQLite 保留、到期幂等停止、Release 归属及最后授权、CAS／时间／原子回滚／复合外键、控制 Worker 重开，以及真实控制定时器。上游和容器事实的 fixture 边界如前所述。

## 继续实施

完整子项 2.3 仍需预览专用 Docker／gVisor 后端的持久动作日志和原容器核实、与现有作业统一的 CPU／内存／容量预留、独立 Runner 到期 watchdog、容器网络／原模板监听配置及可信平台装配。实际后端必须固定原 OCI 身份和数据挂载、收紧网络／资源，并在 create／start／stop 前核实授权；不能把本测试 fixture 引入生产装配。

子项 3.x 的独立 origin／访问凭据／网关／平台入口、4.x 的接受准备／T5／发布，以及 5.x 的组合／固定干净版本检查继续待实施。企业身份、真实模型、真实 Linux Docker＋gVisor、生产迁移和人工产品／阶段验收未执行。当前没有可从平台页面打开的生产预览能力。
