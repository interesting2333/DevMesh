# T5 原子接受开发复核

日期：2026-11-13。实施与复核：Codex，同一 Agent。父工作包 P1-07，OpenSpec `implement-preview-review-and-acceptance`，起点 `8b06be8`。本轮为工作树开发验证；正式 P1-07 仍等待 P1-06／G0，不据此关闭阶段门槛或归档变更。

## Change

迁移 39 增加独立接受结论、必要人工完成覆盖层及专用发布意图，保留原准备 SENT／UNKNOWN 派发历史。已提交准备通过独立结论解除项目未决占用，已提交原准备和四类接受历史禁止覆盖／删除；历史迁移正文及原摘要不重写，旧数据不虚构接受结论。

私有 `commitReleaseAcceptance` 只允许当前 owner，固定 Run scope／强 If-Match、明确 ACCEPT_RELEASE、原准备 requestHash／revision、最新 observation sequence／proofHash、candidate revision／manifest／review／数据方案和原接受指针。T5 单一 writer 复查准确依据、完整审查、健康／持有与无未知写，原子保存 Release、项目指针 CAS、提交结论、必要人工完成／Attempt／slot／grant、Run COMPLETED、专用 promotion 意图、事件及原操作响应。旧预览 claim 可以读取历史 READY，新 T5 必须使用独立 ACCEPTANCE 服务用途。

`ReleaseAcceptor` 在事务外实际读取冻结材料，核对完整哈希集合及大小限制，再交 writer 重查当前依据。原键恢复先复核当前权限和原正文，成功后不重新要求文件、健康或非终态 Run。人工完成追加原评估与准确人工结果的关联，不改原自动质量、评估、候选清单或准备证明。发布意图固定完整原准备／proof／接受 operation；接受收据中的 PENDING 为提交时状态，普通 A2A Outbox 不消费该意图。

## Validation

最终 storage-01 40/40、t5-03 23/23 通过，无失败／跳过／取消。T5 包含人工完成与全自动完成、13 个写入边界故障后的完整回滚及原键重试、并发接受、材料／审查／指针和 UNKNOWN 拒绝、真实材料预检／依据变化、不可变历史及 Worker 重启 ACK 恢复。OpenSpec 仅勾选独立的 4.2，变更为 8/13，完整准备与发布继续。管理、严格 OpenSpec、设计生成／契约、Lint 和差异检查以同目录 post-1 实际报告为准。

post-1 的台账 render／check、全部 OpenSpec 严格校验、完整设计／契约一致性、Lint、未暂存及已暂存差异检查共 8/8 通过。final-binding 核实前 38 份迁移正文／原摘要与起点逐字节相同，并关联最终构建、两个通过测试组、143 份源码映射和两次夹具修正链。

首轮 build-01 六包构建成功，根 TypeScript 检查发现准备 operationId 的品牌类型丢失；改用已验证请求中的 ID 后，build-02 的六包构建、根类型检查和 Lint 通过，期间输入未变。143 份运行源码映射逐字匹配；构建中的插件警告原样保留。

build-01 期间 `acceptance-commit-domain.ts`、`acceptance-commit.test.mjs` 和 `storage-dataset-ownership.test.mjs` 有实际输入变化，不能作为最终源码绑定；对应报告、失败处源码前后快照及哈希校验保留。最终构建／测试均使用之后固定的产品源码。

首轮 t5-01 为 8/23 通过、15/23 失败（含父用例失败），无跳过／取消。14 个子用例从 WorkVerifier 返回包装层读取了不存在的 operationId，尚未进入待测事务。第一次夹具替换改了引用但因缩进匹配漏加局部定义；t5-02 出现 ReferenceError 后主动停止准确进程树，保留部分 TAP、原 driver report 和中止记录，不算完整执行。补齐从冻结 MANUAL_PENDING work 取 ID 的定义后，t5-03 重跑原断言；产品 TypeScript 未改变，两次修正的前后源码及 SHA 链保留。

storage-01 并行执行所有 storage 测试；其全局输入指纹会记录上述同一个 T5 测试文件变化。该文件不在存储测试选择中，存储测试及依赖、产品源码和产物没有变化；不能把整个 storage driver 的输入称为不变。最终绑定逐项核实这个唯一差异，T5 最终执行单独绑定修正后的文件。

本轮原始证据目录明确关闭 Git 换行转换，保留 Windows 中止进程快照等原始字节；提交前同时核实留存 manifest 的 SHA／大小与 Git index blob，不以工作树哈希代替实际提交字节核验。

## Scope and remaining work

本轮实际运行本地文件系统、内容权限／字节读取、正式冻结／审查、SQLite Worker／重启、迁移、并发与事务故障。Runner reservation、容器实例／HTTP 健康和物理 fence 是明确受控的基础设施事实，不能作为真实 Docker／gVisor、物理排空或产品接受证据。

T5 提交不切路由、不开新写门、不确认 RELEASE_OWNED、不导出；已接受事实与发布状态分开。实际接受服务 Driver、完整准备后端组合、安全撤销及发布／导出消费者继续实施。完整 4.1／4.3／5.1／5.2、正式工作包与门槛仍按各自证据验收。

未执行根 `pnpm check` 全流水线、浏览器专项、真实 Linux、固定提交干净 checkout、独立人员或产品验收。原始输出、命令、源码／产物指纹、失败与修正链及最终检查保存在 [development/acceptance-commit](./development/acceptance-commit/)，不包含运行数据库或真实凭据。
