# P2-01 控制状态机与逐目标记录（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-run-control-lifecycle`（父工作包 P2-01）
- 任务：1.1 控制目标迁移与共享投影；1.2 pauseRun／cancelRun／resumeRun 领域命令
- 结论：迁移 0046、控制目标记录和 resume 领域命令已实现并通过定向测试；正式 P2-01 仍为 `NOT_STARTED`，G1 未通过，不伪造门槛

## 实现内容

| 项 | 内容 |
| --- | --- |
| 迁移 0046 | `runs.recovery_review_hash`；`run_control_targets`（run／类型／准确 ID／状态／尝试次数／证据／检查时间）及待处理索引 |
| pauseRun | 校验 control revision、terminal、CANCELLING；为活动 attempt／准备登记目标；PAUSING、epoch 与 control revision 推进；撤销 grant；ControlProgress 与 control-stop Outbox |
| cancelRun | CANCELLING、目标登记、grant 撤销与 control-stop；拒绝覆盖已保存取消 |
| resumeRun | 仅 PAUSED；control revision 与 recovery review hash 精确匹配；要求无活动 attempt、目标全部解决；恢复 OPEN 并推进 epoch，清除 review hash |
| recordControlTarget | 显式状态迁移（PENDING／STOPPING／SAVED／RELEASED／UNKNOWN／FAILED），尝试次数、失败码、证据与检查时间 |
| finishControl | 仅 PAUSING；所有目标 SAVED／RELEASED 才 PAUSED；生成 recovery review hash |
| finishRun | CANCELLED 前要求控制目标已解决 |

## 验证

```powershell
node --test --test-reporter=spec tests/run-control.test.mjs                         # 2/2
node --test --test-reporter=spec tests/storage.test.mjs                              # 17/17
node --test --test-concurrency=1 tests/storage-acceptance-reconfirmation-upgrade.test.mjs tests/storage-migrations.test.mjs  # 7/7
corepack pnpm@11.28.5 --filter @devmesh/storage-sqlite build                        # 退出 0
corepack pnpm@11.28.5 typecheck                                                      # 退出 0
```

新增测试覆盖：

- 错误 control revision 拒绝；pause 登记 ATTEMPT 目标；未解决目标不能 finishControl；
- SAVED／RELEASED 后生成 64 位 recovery hash；错误 hash 拒绝 resume；正确 hash 恢复 OPEN 并推进 epoch；
- CANCELLING 不能被 pause 覆盖；活动 attempt 存在时 finishRun 拒绝；目标未解决时取消被拒绝；
- 取消完成后终态为 CANCELLED。

## 未完成与边界

- 2.x：control-stop 逐目标收尾协调器、材料保存重试、30 秒核实提示尚未实现；本轮只有存储状态机与显式记录接口。
- 3.x：受保护 API、OpenAPI 与 UI 事件投影尚未接入。
- 4.x：崩溃重启／未知目标／真实日志与文档同步待后续轮次。
- 未执行真实 Runner／容器停止；正式 P2-01 与 G1～G4 不变。
