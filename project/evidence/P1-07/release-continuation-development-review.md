# 原发布跨阶段继续：本地开发复核

ReleasePublisher 恢复 SENT／UNKNOWN 时先 inspect；显式后端提供 resume 且当前 continuation 核验通过，才继续同一原发布。原 verifyReleasePublication 仍只授权 SENT，全局 publish 不重派。当前接受指针、原请求／basis、关闭门及所有用途未定写屏障重核；Runner 每阶段领取唯一持久许可，已派发阶段仅查询原结果，前驱不确定即停止。登记、预留、profile、归属与 proof 的本地事务恢复保持原身份；并发协调者通过唯一动作许可和观察 CAS 收敛，CAS 冲突可由下一次原作业协调继续。

Runner v12 增加 PROFILE_PREPARE 和不可变配额准备模式。新 profile 同事务标 EXECUTE_ONCE，唯一许可后 prepare 前再次授权，prepared 只查准确原目录／上限。旧 profile 标 INSPECT_ONLY，保留旧动作／容量／proof，不伪造完成，不重新 enforce 配额。许可丢失但物理状态未发生或无法核实时保留 UNKNOWN、占用和关闭门。控制面43份迁移及 manifest 不变；Runner十份历史SQL正文不变，新增v12前向迁移。

最终 continuation 27/27；runner 120/121（跳过1）；acceptance 157/157；regression 90/90；access 7/7；http 7/7；browser 1/1；upgrade 1/1；contract-tests 18/18，共428项通过、1项跳过。新 continuation 专项27项实际执行控制／Runner／数据 Worker、首轮正式 INITIAL T5、模板业务 SQLite 与 HTTP：11个物理响应断点、6个本地事务ACK断点、全局许可ACK在Runner登记前丢失、2个许可后无物理结果、当前已记录fence／接受指针改变、不确定查询、配置变化、4协调者并发，以及v11原行／历史保留、v12失败完整回滚和摘要漂移。物理容器、quota、fences、guard、route与身份均为显式夹具。浏览器回归使用真实Edge／React与本地测试TLS；不代表真实企业身份或Linux隔离。

六包构建、根类型／Lint／契约生成检查通过；183份映射的来源均存在，嵌入源码逐字等于当前来源，执行产物摘要一并绑定。各组测试均保存运行前后输入指纹、原始stdout／stderr和终态；与最终输入的差异见[最终绑定](./development/release-continuation/final-binding.json)。原始材料及字节校验见[清单](./development/release-continuation/manifest.json)。较早构建之后只修改MJS测试与文档，最终应用源码仍由映射精确绑定；不宣称早期构建和最终测试使用全仓同一输入。

首次 continuation 测试因查询 helper 给严格 getReleasePublication 多传 requestHash，前5个物理子项失败后主动终止该测试进程（TAP计6失败含文件包装），原日志和修正前源码保留。第二次完整测试24通过／1失败：负例在原ARM proof尚未持久观察前改变夹具fence，合法后继可作为首次观察，原UNKNOWN预期不成立；修正为先inspect固定原proof再改变当前物理事实。另将尚未执行到的控制负例改为接受指针变化，避免直接违反闭门触发器。补充并发与配置两项后，最终27/27。第二次失败运行期间更新了七个旧版本断言文件，逐项指纹差异保留；这些不是该失败原因。失败次数不计入最终通过数，未修改应用代码以迎合测试。

此次为同一Agent在修改中checkout开发复核；未执行根完整pnpm check、固定提交干净checkout、独立／人工产品验收或真实Linux Docker／gVisor／全写guard、OIDC、模型联调。默认listener／物理provider不启用；正式后继保留／替换T5、门换代后的原物理源恢复、默认平台组合及独立导出继续实施。独立导出重试不得重跑接受、数据准备、迁移或发布，完整4.3、4.1、5.1、5.2仍未勾选，OpenSpec仍8/13；正式P1-07仍NOT_STARTED／未认领并等待P1-06／G0，G0～G4未提升。
