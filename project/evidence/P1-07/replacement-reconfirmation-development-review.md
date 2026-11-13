# P1-07 替换再次确认开发复核

2026-11-14：4.1／5.1替换再次确认：固定decisionId保留首次决定，45版前向迁移新增acceptance_data_confirmations追加历史并逐字段复制旧行；当前review完整依据匹配准备准入。再次明确确认使用新原UUID／当前Run条件；并发旧条件另一请求412，刷新条件下重复当前审查409，原键恢复原回执且复核当前owner。多owner在原冻结依据仍有效时逐人明确确认，decisionId／reviewHash／actorId去重，不借用其他actor批准；原冻结主体撤权继续使候选陈旧，不宣称完整owner交接。确认／operation原子回滚、旧决定和历史不可改；44→45在复制前后失败完整回滚。真实同库后继替换／只读HTTP健康／第二轮T5、新review绑定、旧字节保留、重开原键与撤权验证。reconfirmation 3通过，regression 13通过，storage 47通过，合计63项次通过、0跳过；完整应用构建、类型／Lint／契约及449映射通过，旧SQL1～44／Runner实现格式／依赖保持，新增45校验和匹配；最终各组顺序且全部输入无漂移。旧构建两次唯一键失败及首次新构建2通过／1失败保留：成功确认推进Run导致并发旧If-Match正确412，测试改为准确412并另加最新条件下409，产品未因此改动、未放宽版本检查。追加owner用例前三次因原冻结主体撤权而正确陈旧，诊断后保留原资格规则；第四次在冻结依据有效时复现首actor锚点拒绝，再修正actor历史绑定，全部原日志／输入保留。历史升级为明确旧行夹具，源／模型／Runtime准入／OCI与物理围栏／容器／网络／路由仍为明确夹具；第二轮发布、完整D01～D08／干净checkout／真实身份和Linux／产品验收继续。正式P1-07／OpenSpec8/13／门槛保持。

## 实际验证

- First immutable anchor and append-only per-owner review confirmations are written in the same original operation transaction; preparation uses the exact current review basis.
- Concurrent new requests admit one and reject the other stale Run version with 412; a fresh precondition duplicate returns explicit 409. Original-key recovery preserves its receipt without replacing current qualification.
- Insertion failure rolls back the confirmation, original operation and Run/event effects. Missing/stale conditions, wrong data plan, changed original body and revoked owner are rejected. History UPDATE/DELETE are rejected.
- Actual same-control-database successor replacement prepares a distinct empty SQLite target, retains source bytes, performs read-only HTTP health and commits the exact current review in the second T5. Worker reopen retains both acceptance commits, first anchor and two confirmations.
- Version 44 historical row fixtures copy verbatim to version 45; failures before copy and after DDL/history roll back schema, version, migration history and original facts. Cross-anchor inserts and history mutation are rejected.

reconfirmation 3通过，regression 13通过，storage 47通过，合计63通过、0跳过。构建、类型／Lint／契约、449映射、696份源码与产物绑定通过。控制迁移1～44字节不变，45版SQL与清单一致；Runner实现／持久格式及依赖保持。

## 失败与范围

旧构建两次复现再次确认撞首次决定唯一键，第二次打印准确底层拒绝；首次日志、旧编译产物嵌入源码及两份测试字节均保留。首次新构建2通过／1失败，原因是成功确认推进Run版本，竞争请求正确拒绝旧If-Match。保留产品版本校验，测试改为准确412，再独立增加刷新条件后409断言；所有原历史、原子回滚和实际T5断言保留。最终完整重建后各组顺序执行，最终输入无运行中／运行后漂移。

owner补充：前三次追加测试因原冻结主体降为viewer或operator而正确陈旧，原候选资格检查保持；第四次保留有效冻结依据后准确复现首actor锚点拒绝。仅修正固定锚点的actor限制并按actor去重，仍禁止借用其他人确认；撤权继续使候选陈旧。四次原日志／源码绑定保存。计数为测试执行项次，升级用例也包含在存储全量中。

首次确认／当前审查历史、真实SQLite与T5使用生产事务；升级历史行和物理事实等夹具边界见evidence.json。后继发布、完整产品链、干净checkout及真实身份／Linux继续，正式工作包和8/13任务不据此完成。

原始记录：[evidence.json](./development/replacement-reconfirmation/evidence.json)、[final-binding.json](./development/replacement-reconfirmation/final-binding.json)、[failure-history.json](./development/replacement-reconfirmation/failure-history.json)、[manifest.json](./development/replacement-reconfirmation/manifest.json)。
