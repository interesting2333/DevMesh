# Tasks

## 1. Durable control state

- [ ] 1.1 新增控制目标迁移与共享投影：目标类型／准确 ID／状态／尝试次数／证据／检查时间；验证旧库升级、原子回滚与未知目标保留。
- [ ] 1.2 实现 pauseRun／cancelRun／resumeRun 领域命令：control revision CAS、PAUSED 恢复、恢复审查 hash、terminal／CANCELLING 保护与 epoch 推进；验证原键重放与冲突。

## 2. Cleanup and verification

- [ ] 2.1 实现 control-stop 逐目标收尾协调器与显式后端接口；未知只查询、不重发，全部目标释放后才完成 PAUSED／CANCELLED。
- [ ] 2.2 实现材料保存失败只重试对应保存，以及 30 秒核实提示（未解决目标、最近检查时间），不自动成功。

## 3. API, events and UI projection

- [ ] 3.1 接入受保护 pause／resume／cancel API 与控制状态查询，If-Match／原键／权限边界与 OpenAPI 更新。
- [ ] 3.2 投影 ControlProgress 事件与未解决目标；验证工作台断线重连后仍能读取真实控制状态，不用夹具冒充完成。

## 4. Verification and records

- [ ] 4.1 用受控后端验证 pause／resume／cancel、崩溃重启、未知目标、保存失败重试和 30 秒提示；保留真实日志与边界。
- [ ] 4.2 同步设计／验收／实施文档、基线、OpenSpec 与 P2-01 台账；正式 P2-01 仍保持 NOT_STARTED，不伪造 G1。

## 备注

本变更按用户明确授权作为 G1 之前的提前开发增量；正式工作包状态与阶段门槛独立评审。
