# P1-05 local composition review

2026-11-12，同一 Codex Agent 在实现提交后复核源码、开发失败历史和固定提交原始日志；不是独立人员签认。

固定提交 `1df2e80ca4b007ca93e4b16511aa16e75a0af7aa` 的干净 Windows checkout 经冻结安装后完成 21 项检查，全部退出 0。原报告与日志位于 `../windows-1df2e80/`，`evidence.json` 保存逐件 SHA-256、源码指纹和锁文件哈希。工作区 92/92、存储 28/28，无失败或取消；smoke 和 Runner 各一条环境条件测试跳过，不计作目标环境验收。

## Composition and original operation recovery

- `workspace-runtime.test.mjs` 六条用例均在完整工作区套件执行。实际 Scheduler 准入资源并发送 A2A，Runtime 在首个 HTTP 模型协议请求前完成准确基点分配；服务启动后动态 MCP 查原分配、文件 CAS、真实 Git commit。原成功提交与结果不可变日志固定后，源码 ACK 是发布候选、A2A completed 和 Host FINISHED 的必要前置。
- 源码对象已保留而 ACK 丢失时，保留原日志与原归档 ID；暂停后用原领取者核实原 ref，补 ACK 并发布历史结果。无新模型请求、commit、对象传输或 Grant 恢复。成员降权、任务取消、外来 claim 和替换结果均拒绝；发布回复丢失返回既有原子结果。
- 准备阶段已分配但尚未调用模型而回执未知时，第二次 execute 被拒绝，分配和准备钩子均未重跑。此最后补充用例在本固定提交完整回归中通过；较早 runtime-v7 只覆盖另外五条，不能替代此结果。
- 原 Host FINISHED 后实际认证 Runner HTTP 拒绝新 Job；维护与正常执行采用不同权限。`workspace-maintenance-runner.test.mjs` 验证 queued／未知停止 Job 阻止维护，只有明确退出后才进入实际文件屏障；Tester 不必获得 repo 写工具也能按原操作完成降权保存与回收。

## T05 / T23 applicability

T05 的本地准确 SHA、来源 ACK、串行候选、三方冲突材料及固定验证 checkout 已有真实 SQLite／Git 证据；新开发写入不改变既有 Tester 输入。T23 的原材料保存、独立持久 ACK、Grant 撤销、Runner 屏障、原目录隔离和部分删除恢复已有本地 HTTP／Git／文件系统证据，外部目录和 datasets 保持可读。

上述满足本次变更 5.1 与 5.2 明确约定的本地适用范围，子任务可以勾选。远程 Runner 身份、跨节点传输、Linux/runsc 实际容器、真实模型、OIDC 与独立人工／产品／阶段验收均未执行。ControlledBackend 未启动容器，脚本化 HTTP 模型仅验证协议。正式父工作包仍等待前置与 G0，不改为 DONE、不提前归档或将目标环境条件记通过。P1-06 质量解释、Work 成功与 ReleaseCandidate 冻结不属于该提交能力。
