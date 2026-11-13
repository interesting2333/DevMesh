# Release 独立访问：本地开发复核

新增控制迁移43，独立 RELEASE 访问策略／请求／事件、摘要票据／会话／凭据事件，显式 ReleaseGateway、RunnerReleaseHttpTransport 和平台查询／领票／iframe入口。目标固定原接受版本、完整发布证明／claim／profile／reservation／实例／网络与路由代际；发送前实际 query 原 Runner guard／fences／对象、HTTP健康与当前成员授权。GET不签票据，无隐式旧版本回退；Preview用途／票据／Cookie不能互用。共享模式使用独立注册域及r-主机，票据最长60秒、会话最长5分钟，原子单次兑换，Viewer只读。

请求体／允许头／当前门fence和revision入不可变摘要，一次持久派发后只发一次有界loopbackHTTP，无URL目标／DNS／重定向／连接池／重试。丢派发ACK不发业务请求；真实业务写成功但响应丢失保留UNKNOWN，重试不重发。响应先记账，再复核当前成员，撤权不会删除已发生事实。business_pending_writes统一PREVIEW／RELEASE的DISPATCHED／UNKNOWN写，门计数、接受就绪、T5、发布、撤销和门重开使用同一屏障，SQL触发器兜底。

最终 access 7/7；http 7/7；browser 1/1；upgrade 1/1；regression 90/90；acceptance 157/157；contract-tests 18/18，共281项通过、0项跳过。实际控制／Runner／数据文件Worker、TLS与原生HTTP、模板业务SQLite、Edge 157.0.4341.42加载真实React iframe并完成任务写入。六包构建、根类型／Lint／契约生成检查通过，182份源码映射匹配当前来源。控制迁移1～42及原manifest条目、Runner十份历史SQL不变，43失败DDL／历史写完整回滚，旧未知Preview写和原行保留。原始日志、各次前后指纹、失败相关源码及最终绑定见[清单](./development/release-access/manifest.json)。

首轮控制测试暴露嵌套事务：已提供参加现有事务的内部只读发布查询，不放宽权限或新建效果。其余修正包括未使用导入／变量、合法本地配置误判、浏览器末尾核对用了平台origin，以及旧OpenAPI路径总数／实现白名单断言。完整接受回归发现旧超时测试与Worker预算均为120秒；仅该故障注入用例显式改为10秒，生产默认不变；当前Runner检查版本的旧断言从10更新为11，历史版本断言保留。原失败保留，不计入最终通过数。v40历史夹具构造时临时提供仅Preview投影，升级前删除；生产没有旧版本回退。早期构建产物未全部留存，保存原摘要与日志；不声称所有失败产物可逐字重建。

各测试组运行期间变化及与最终输入的差异逐项见final-binding，不宣称全组同一全仓快照。较早的升级测试之后补充了Runner观察时间校验及访问夹具，后续HTTP／浏览器测试覆盖最终实现；接受套件在两处测试修正后完整重跑。应用产物以最终源码映射绑定。浏览器测试忽略本地测试TLS证书错误，原生HTTPS测试使用明确CA验证；物理Docker／OCI／guard／fences／route及身份均为显式夹具。同一Agent在修改中checkout复核，未执行根完整pnpm check、固定提交干净checkout、独立／人工产品或真实Linux／OIDC验收。

默认listener／身份／物理provider不启用；全写入口物理guard、继续协调、导出、默认平台装配、正式后继保留／替换T5及门再次换代后的原服务恢复继续。当前写访问仅接受原发布初次OPEN门版本。设计／实施／验收、OpenSpec及台账基线同步。OpenSpec仍8/13，完整4.3／5.1／5.2不勾选、不归档；正式P1-07仍NOT_STARTED／未认领，等待P1-06／G0。
