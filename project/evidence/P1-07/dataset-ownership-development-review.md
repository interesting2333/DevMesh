# 数据准备归属与逻辑写门开发复核

日期：2026-11-13。实施与复核：Codex，同一 Agent。父工作包 P1-07，OpenSpec `implement-preview-review-and-acceptance`。本记录覆盖工作树中的开发增量；起点为 `af36e821e13e957322ba98bc7b66667de6dd48be`，不代表干净 checkout 或独立人员／产品验收。正式工作包仍等待 P1-06／G0，变更仍为 7/13，完整 4.1 未勾选。

## Change

迁移 38 将真实数据策略归入 `dataset_backend_policies`，固定 PREVIEW／ACCEPTANCE 用途；原预览登记接口经筛选兼容视图保留，接受策略只从实际接受策略表镜像。不可变 `dataset_preparations` 固定原 operation／requestHash、dataset、项目、策略、用途和 baseReleaseId，不为接受伪造预览策略、PreviewEffect 或预览实例。

接受意图与 PREPARING 目标元数据、原准备归属、初始 CLOSED 逻辑门及初始门历史同事务提交。保留迁移才登记旧数据为 origin；REPLACE 只保留旧接受基线。接受准备数据使用明确的无限期保留标记，独立于预览期限。准确原证明落库后，同事务推进目标 WRITE_FROZEN；未知观察保留数据身份及关闭门。

原写门的物理名称、关闭请求、访问请求和历史保留，外键改为通用准备归属。只有明确带入 SQL 校验和的 rebuild 标记才暂关外键并事务重建，检查完成后恢复原 pragma；晚期失败回滚 schema、行、版本和迁移历史。原 1～37 迁移正文不改。恢复异常独立处理，若迁移与恢复均失败则同时保留两个原因。

私有 `getAcceptanceDataset` 复核成员／准确后端和原 hash。私有 `closeAcceptanceSourceWriteGate` 只能由准确接受后端关闭原请求指定的源门，固定源准备 operation／hash、expectedRevision／expectedFence；闭门、递增 fence、历史和 Run 事件同事务。闭门 ACK 恢复原记录，即使当前接受基线后来变化也不产生新动作；当前没有开放门或超时重开接口。

## Validation

存储全量 38/38 通过，包含本轮三个归属用例及两个接受迁移用例；此前迁移专项 5/5。综合接受／契约／实际数据副本／预览访问和生命周期 80/81 通过，一项失败：并发接受控制器用例的上游 releaseFreezeFixture 在 beginReleaseDelivery 被 RELEASE_DELIVERY_POLICY_CHANGED 拒绝，尚未进入控制器断言。原失败没有完整质量／Runner 轨迹，根因未确认；带时间轨迹的独立夹具复现通过，不能据此证明原失败原因。保持源码和产物不变，仅重跑发生失败的整份 readiness 文件，5/5 通过；没有通过重复运行来删除首次失败，也不把综合组写成全绿。

最终额外加入独立旧证明升级用例，1/1 通过：使用真实 v37 schema、完整有效协议证明和观察，晚期 SQL 故障回滚后重试 v38，目标直接恢复 WRITE_FROZEN／原 snapshotAt，保留准备、证明、观察和关闭门。它是明确历史元数据夹具；不是物理证明验收。原综合、存储及重跑组源码／产物在各自执行期间均未变化；随后仅新增独立测试；final-input-binding.json 记录 SQL 格式修正前的绑定，最终校验和的补充绑定见下。

最终存储构建、根类型检查、Lint、契约检查及 134/134 源码映射匹配。原日志、driver、输入／产物指纹、诊断与范围位于 [development/dataset-ownership](./development/dataset-ownership/)。台账、全部 OpenSpec strict、完整设计与 diff 检查的初次原输出在 post-2；SQL 格式修正后的最终输出在 post-3。只证明相应检查，不代替产品验收。

提交前的 `git diff --cached --check` 发现新迁移的一处尾随空格；早先未暂存／未跟踪文件不在普通 diff 检查范围，不能把 post-2 的通过解释为完整新增文件检查。保留修正前复现的暂存检查实际输出及旧／新 SQL、manifest，只删除这一处空格并更新迁移 38 校验和，原 1～37 不变。重新构建存储、根类型／Lint／契约检查通过；最终校验和的 6/6 迁移用例通过，无取消／跳过。逐文件补充绑定确认 TypeScript、既有测试与可执行 JavaScript 不变，只有 SQL／manifest 和对应分发副本的差异；原 80/81、38/38、5/5 和历史 1/1 使用格式修正前校验和，不冒充最终字节运行。旧绑定按捕获时点保留，最终差异见 `development/dataset-ownership/normalization-final-binding.json`，最终完整／已暂存差异及其余管理检查见 post-3。

早期执行按实际保留：第一次构建的空值收窄类型检查失败；第二次类型检查通过、Lint 因 finally 可能覆盖原异常失败，并保留一项旧 readiness 产物映射；第三次补建包含最终目标冻结守卫并修正异常恢复，检查通过。第三次构建期间只增加新测试的两项用途隔离负例，运行源码不变；最终测试在这些负例已写入后开始。第一次构建没有捕获完整源码／driver 快照，只保留诊断输出，不给它补写未经捕获的精确绑定。

本轮未执行根 `pnpm check` 整条流水线、浏览器专项或真实 Linux／Docker／gVisor 联调；前轮结果不计作本轮执行。

## Scope and remaining work

迁移用例的旧接受源、PRESERVE_MIGRATE／REPLACE 请求与元数据是显式历史夹具；源闭门用例使用实际 SQLite／门／事务及明确候选／审查依赖，覆盖授权、版本、故障回滚与 ACK 恢复。它们不证明正式迭代接受已通过。INITIAL 用例经过现有正式冻结／审查准备和实际文件 SQLite Worker；人工、Git／A2A 准入、OCI／容器事实仍是明确夹具。

本增量没有实际接受数据文件适配、物理 fencing、后台写排空、真实容器／健康、Release 创建、T5 或发布。逻辑门、零在途计数、声明的 proof 字段都不替代物理事实。旧证明升级为冻结元数据已由独立历史证明用例覆盖；其中 proof 的物理 fence、容器和健康仍是显式夹具声明。

后续继续准确接受数据 journal／Runner 服务用途与归属装配、正式正向保留／替换、准备解析和安全恢复，以及 T5／发布／导出。原派发 SENT／UNKNOWN 保持原事实；成功 T5 仍需独立解决活动准备占位，不能假标 FAILED 或删除历史。企业身份与真实 Linux/gVisor 缺项保持单列，阶段门槛和产品验收未通过。
