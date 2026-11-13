# P1-07 接受HTTP入口开发复核

准确候选新增接受依据与原准备分页／单条读取，显式准备意图、独立替换确认、从未派发关闭和已派发撤销决定入口。原AcceptCandidate由早期三字段计划契约升级为完整两阶段正文，经过既有ReleaseAcceptor实际复核冻结内容字节后执行T5；它返回原ACCEPTED及当时PENDING，不自动发布。startPlatform的显式acceptancePolicies组合真实预检器，缺省关闭新准备／接受。

## 权限和原操作

可信宿主冻结projectId→已登记policyHash，DB策略仍须匹配原模板／数据方案；HTTP没有后端登记、健康回执或路径／proof正文入口。当前成员可读取，owner独立命令再校验Run／candidate／原operation范围、UUID／原正文、If-Match、准备版本及观察序号；原成功恢复先于新版本／配置检查，降权或撤权继续拒绝。公开投影仅返回摘要、原hash及适用能力，省略storageKey、Runner／后端主体、端点与proof／claim正文。GET无派发或刷新健康副作用，能力只是当前观察，writer始终再次校验。

撤销回执decisionState=RECORDED只确认原决定，不宣称ABORTED或物理清理。T5回执links.preparation指向当前成员可GET的准确原准备；通用InputOperation仍只处理其已登记的输入类操作，没有为这些新动作返回失效的通用操作链接。原准备／接受提交未知时重放原UUID／正文，不能发新键替代。

## 实际验证

最终HTTP接口5/5、准备／T5／撤销回归51/51、输入组合／人工审查／契约22/22、实际Edge原审查入口4/4，共82通过、0跳过；构建／类型／Lint／OpenAPI一致性通过，252条源码映射（含TSX／第三方）逐字节匹配，绑定651份源码／产物，旧迁移1～44和Runner未改。

实际文件型SQLite Worker和HTTP验证无配置／未登记策略关闭、只读GET、伪造主体字段拒绝、viewer禁止写、缺／旧If-Match拒绝、原准备重启／关闭新配置后只一对象、换正文冲突、跨候选与撤权404、21项20／1游标分页及游标边界。原未派发关闭可重放；已派发只能请求准确撤销，决定追加后仍未ABORTED、dataset保留。新接受路径先以损坏的实际读取字节拒绝且无Release，再通过真实内容存储预检执行T5；原自动质量评估正文不变、必要人工覆盖完成、接受指针／Run终态和发布Outbox同事务。

丢ACK由测试在真实ReleaseAcceptor提交成功后注入异常，HTTP503，重开真实Worker并挂载关闭新接受配置的入口后，同UUID／正文只找回一个Release／Outbox，明确禁止新材料读取仍能恢复。它验证应用应答丢失恢复，不声称切断物理网络。上游源码、镜像、Runner／fences／健康及人工观察为明确协议夹具；新测试没有实际准备数据副本／容器或完整后继业务链路。

## 失败、输入和复核边界

首轮类型检查有两处品牌ID不一致：策略Map误推导为品牌键、领域公开投影返回普通string。修正为已验证字符串Map，并对领域投影执行共享契约解析；同时补宿主不启用Input API时拒绝acceptancePolicies的组合断言。首轮各测试虽通过，最终已全部重建和重跑，不复用修正前测试作为最终证据。两份原生产源和原组合测试快照与首轮type记录指纹一致；原失败完整输出保留，不声称保留完整旧checkout。所有最终组运行及结束核对无输入改变；未执行完整pnpm check。

同一Codex Agent开发复核，非独立人员或真实用户签认。直接HTTP装配真实ReleaseAcceptor，startPlatform工厂装配及其准入已检查；未据此声明通过startPlatform启动完整接受代际。默认无企业身份、接受策略或真实准备／恢复消费装配；新HTTP不自动驱动后端。模型、OIDC／Cookie登录、Linux／gVisor、实际物理清理／发布、正向后继保留／替换、完整工作台和产品验收继续。P1-07正式前置P1-06／G0未满足，未认领，完整4.1／4.3／5.1／5.2和OpenSpec8/13、G0～G4保持原状态，不归档。已同步计划契约表、设计专题、实施、验收核对及台账。

原始材料见 [evidence.json](./development/acceptance-entry/evidence.json)、[final-binding.json](./development/acceptance-entry/final-binding.json)、[manifest.json](./development/acceptance-entry/manifest.json)。
