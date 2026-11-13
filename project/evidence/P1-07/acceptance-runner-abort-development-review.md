# 接受服务撤销清理：本地开发复核

本轮在控制面的不可变撤销决定之后，实现独立 RunnerAcceptanceAbortBackend、Runner v9 原决定登记和 STOP／CONTAINER_REMOVE／NETWORK_REMOVE 唯一派发日志。可信装配从控制库读取原决定，绑定准备请求／Runner／后端主体／原 service request／profile／完整容器与网络 ID；即使尚无服务预留也保存 tombstone，阻止迟到创建。新派发、健康事实与 proof 被关闭，既有日志／claim／proof／数据保留。只对准确原对象执行非强制、保留数据卷的清理。

丢回执或进程重启只查询原对象，不重派；未知 CREATE 无原 ID 保留占用。准确容器消失观察、REMOVED／容量释放与服务历史同事务，网络独立核实，网络恢复不依赖已释放容量的活动页。未曾 CREATE 的网络清理后可取消；尚未执行动作的预留原子取消。CREATED 容器可以清理，不能伪造 EXITED。该组件尚未装入默认平台启动流程，不改变默认关闭策略。

验证：abort-02 20/20；regression-02 45/45；cleanup-01 19/19；历史迁移专项实际选中3个用例通过（TAP 4/4中的另一项是零匹配文件包装，未当成迁移验证）。合计87个执行用例通过，无失败／跳过；另有1个空文件包装。六包构建、根类型检查、Lint和154/154源码映射通过；Runner旧v2～v8迁移正文及控制库全部40份迁移／manifest与父提交不变。

测试实际执行控制／Runner SQLite Worker、v8→v9 DDL重建、DDL冲突与history写失败完整回滚、迁移漂移拒绝、重启及原决定→清理组合、真实只读业务数据文件／HTTP。容器、网络、镜像来源和物理fence是明确夹具；Docker测试仅校验命令／完整profile与失败查询边界，没有执行真实Docker／gVisor。

保留首轮失败：abort-01为19/20，regression-01为43/45，三项均因Runner inspect固定显示8、实际库已升级9。修正为读取实际user_version，并增加DDL失败回滚边界；原失败日志、修正前源码和前后SHA均保留。build-01之后新增两份独立测试，build-02之后无代码／测试输入变化；所有最终测试输入与build-02相同、运行期间源码和产物均未变化。没有用最终结果覆盖失败记录。

这仍是完整安全撤销的一部分：物理dataset fence解除、源写门恢复、项目占用释放和控制面ABORTED尚未实现；控制面继续ABORTING／目标CLOSED，绝不因服务清理成功重开源写门。可写发布转换、正向保留／替换、可信完整装配、真实Linux配额／网络隔离／身份和产品验收继续。正式P1-07仍NOT_STARTED、未认领，等待P1-06／G0；OpenSpec8/13、4.1未勾选，不归档。

原日志／输入及产物指纹／修正链见[清单](./development/acceptance-runner-abort/manifest.json)和[绑定](./development/acceptance-runner-abort/final-binding.json)。最终管理、OpenSpec、设计、契约、Lint和diff检查见post-1。本次为修改中checkout的本地开发复核，没有执行完整根pnpm check、固定提交干净checkout或独立／产品验收。
