# Tasks

## 1. Durable control state

- [x] 1.1 新增控制目标迁移与共享投影：目标类型／准确 ID／状态／尝试次数／证据／检查时间；验证旧库升级、原子回滚与未知目标保留。
- [x] 1.2 实现 pauseRun／cancelRun／resumeRun 领域命令：control revision CAS、PAUSED 恢复、恢复审查 hash、terminal／CANCELLING 保护与 epoch 推进；验证原键重放与冲突。

## 2. Cleanup and verification

- [x] 2.1 实现 control-stop 逐目标收尾协调器与显式后端接口；未知只查询、不重发，全部目标释放后才完成 PAUSED／CANCELLED。
- [x] 2.2 实现材料保存失败只重试对应保存，以及 30 秒核实提示（未解决目标、最近检查时间），不自动成功。

## 3. API, events and UI projection

- [x] 3.1 接入受保护 pause／resume／cancel API 与控制状态查询，If-Match／原键／权限边界与 OpenAPI 更新。
- [ ] 3.2 投影 ControlProgress 事件与未解决目标；验证工作台断线重连后仍能读取真实控制状态，不用夹具冒充完成。

## 4. Verification and records

- [ ] 4.1 用受控后端验证 pause／resume／cancel、崩溃重启、未知目标、保存失败重试和 30 秒提示；保留真实日志与边界。
- [ ] 4.2 同步设计／验收／实施文档、基线、OpenSpec 与 P2-01 台账；正式 P2-01 仍保持 NOT_STARTED，不伪造 G1。

## 备注

本变更按用户明确授权作为 G1 之前的提前开发增量；正式工作包状态与阶段门槛独立评审。

2026-11-16：完成1.1／1.2，变更2/8。迁移0046新增`run_control_targets`与`runs.recovery_review_hash`；pauseRun／cancelRun／resumeRun／recordControlTarget／finishControl／listControlTargets落地，finishRun取消前检查目标已解决。定向测试run-control 2/2、storage 17/17、迁移与再确认7/7，storage构建与全量typecheck通过。2.x协调器／保存重试／30秒提示、3.x API与4.x文档同步未完成；正式P2-01仍NOT_STARTED，不伪造G1。证据：`project/evidence/P2-01/run-control-storage-development-review.md`。

2026-11-16：补充控制状态查询，变更仍2/8。`getControlStatus`返回未解决目标、最近检查时间与30秒`verificationOverdue`；`listControlRuns`提供PAUSING／CANCELLING扫描入口。测试覆盖31秒前后overdue翻转，且不自动成功。control-stop协调器、保存失败重试、API与事件投影仍未实现；正式P2-01／G1不变。

2026-11-16：完成2.1／2.2，变更4/8。新增`RunControlCoordinator`：显式`ControlStopBackend`，PENDING／STOPPING只`stop`一次、UNKNOWN只`inspect`（无inspect保留未知不重发）、全部目标释放后`finishControl`转PAUSED；CANCELLING只释放目标，由`finishRun`明确完成。材料保存失败只重试保存并复用同一幂等键；30秒提示由`getControlStatus`的unresolved／lastCheckedAt／verificationOverdue提供，事件与UI投影留3.2。coordinator测试5/5、run-control 2/2。正式P2-01／G1不变。证据：`project/evidence/P2-01/run-control-storage-development-review.md`。

2026-11-16：完成3.1，变更5/8。新增受保护`POST /runs/{runId}:pause`、`:cancel`、`:resume`与`GET /runs/{runId}/control`；pause／cancel要求`If-Match: "r<controlRevision>"`，resume用正文controlRevision与recoveryReviewHash；均先做成员写／读权限检查，操作经既有幂等键与原键回执。契约新增控制错误码并重新生成OpenAPI，新增ReadRunControlStatus路径（总66路径）；contracts 18/18、control HTTP 1/1通过。事件／UI投影仍属3.2；正式P2-01／G1不变。
