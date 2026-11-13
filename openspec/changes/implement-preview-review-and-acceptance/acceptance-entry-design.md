## Context

本增量继续父工作包P1-07及4.1／4.2／5.1：将已实施的准确接受领域、材料预检接入私有Input API。正式前置和门槛保持原状态；不凭API入口完成物理准备、完整工作台或产品验收。

## Decisions

- 可信宿主显式传入projectId→policyHash快照，DB中必须存在原登记策略且匹配冻结方案；HTTP不登记策略、不接受主体／路径／目标dataset／健康或proof正文。默认无配置时新准备和新接受关闭，读取历史仍按当前成员授权。
- GET准确候选接受依据，包含SHA、manifest／review／dataPlan hash、方案中原接受指针与当前指针、资源revision、替换确认及项目未决准备阻塞。另按候选有界分页查询原准备。GET只读，不驱动后端、不刷新健康或签收。
- POST准备原意图、独立REPLACE确认、未派发关闭、已派发撤销决定，统一原UUID／If-Match和owner权限。原操作恢复先于当前配置／版本检查，仍由领域核对原正文和当前权限；重复提交不重新申请后端动作。
- 原 `/api/v1/candidates/{candidateId}:accept` 由早期三字段契约升级为准确两阶段正文，新增runId、manifest、原准备operation／requestHash／revision、观察sequence／proofHash、原接受指针和明确ACCEPT_RELEASE。它必须调用可信ReleaseAcceptor实际核对冻结内容字节后执行T5，不能直调领域命令绕过预检。原接受成功回执与当前发布状态分开，提交后仍为PENDING。
- HTTP只投影允许的准备状态／依据／ready标识和hash，移除storageKey、端点、Runner／后端主体、原proof／claim、数据文件路径与原后端错误细节。资源与原Run／candidate绑定；跨候选、撤权统一404。撤销响应仅确认决定已保存，不声称物理清理或ABORTED。
- startPlatform仅在显式策略配置时组合既有ReleaseAcceptor；策略登记与后端准备／恢复器仍须可信宿主另行装配，不创建默认身份或模拟Linux后端。本轮提供HTTP协议／Worker／真实材料预检验证，准备物理事实明确使用夹具。

## Validation

覆盖无配置／未登记策略、权限与伪造字段、缺失／陈旧If-Match、同键恢复及换正文冲突、Worker重启、跨候选／撤权、分页、原未派发关闭和已派发撤销、不泄露内部字段；准确预检材料后通过HTTP执行T5，原材料缺失拒绝、丢回执恢复不重读新材料、接受事实／发布Outbox不重复。既有准备、T5、撤销、输入组合与契约回归随实际结果保存；不把fixture物理证明当作容器／围栏验收。
