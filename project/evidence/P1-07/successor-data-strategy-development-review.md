# P1-07 后继数据方案与替换确认顺序开发复核

2026-11-13：4.1／5.1后继数据方案与替换确认顺序：修正REPLACE交付要求不存在通用CHANGE批准而无法先冻结候选的循环前置；交付仅收集原规范方案，沿用准确候选／审查／源／方案／owner／Run If-Match的独立确认，未确认禁止准备。复用同文件控制Worker数据库，首轮T5／发布／实际模板HTTP业务写入，createInputTask后新Run完成实际原Runner输出收集、内容、三项Work评估／冻结／审查、真实SQLite保留或替换为空、只读HTTP健康及第二轮T5；旧字节／不同dataset、闭门、外键和原键重开验证。successor 3通过，regression 55通过，合计58通过、0跳过；完整应用构建、类型／Lint／契约及449映射通过，旧SQL1～44／Runner源码与格式／依赖保持。旧构建预期失败、首轮受控physical heldAt早于真实控制关门导致两项拒绝及递归vendor循环命令失败均保留；只改夹具为先关门再acquire，未放宽产品证明或断言。最终两组顺序、输入无漂移。源／模型／Runtime准入／OCI、迁移artifact来源、物理fence／容器／网络／路由与审查观察为显式夹具；第二轮发布、变化review后的再次确认持久模型、完整D01～D08／干净checkout／真实Linux／企业身份与产品验收继续。正式P1-07／OpenSpec8/13／阶段门槛保持。

## 行为修正

交付阶段仅收集REPLACE规范原方案，保留原Runner、实际内容hash／大小、准确Run／commit／计划／需求／策略／原接受来源校验；不产生批准、数据准备或接受。冻结后由现有接受域对准确候选和审查独立确认，未确认继续拒绝准备。删除没有正式入口且早于冻结的通用CHANGE批准前置，不增加新批准API、迁移或默认物理后端。

## 实际验证

- Old compiled source is separately bound to HEAD and reproduces DELIVERY_DATA_REPLACEMENT_UNAPPROVED at original REPLACE delivery collection. Current delivery collects a canonical proposal without a generic CHANGE decision; candidate approval remains mandatory in acceptance.
- Actual same file-backed control Worker database retains first formal Work assessments, candidate, review, T5 and publication. An actual template HTTP request writes a source business row, and createInputTask creates a new Run based on the accepted code commit.
- Second original authenticated Runner output collection, content ACKs, three Work assessments, candidate freeze and review use production components. PRESERVE_MIGRATE performs an actual same-schema SQLite copy containing the business row; REPLACE prepares an actual distinct empty dataset. Both preserve source bytes.
- REPLACE without confirmation creates no second preparation. Exact owner confirmation rejects altered candidate/source/plan/review/decision, missing If-Match and a viewer; original-key confirmation returns the same decision. A changed review invalidates the old confirmation.
- Actual source control closure precedes explicit physical fence acquisition and actual file snapshot. Original read-only service performs actual HTTP health; the second T5 uses retained-content preflight, original accepted-pointer CAS and immutable first acceptance history.
- After Worker reopen, the same T5 key recovers one original second Release, while a changed original body and revoked owner are rejected. Second publication remains pending, source/target gates stay closed, and the migrated schema passes foreign-key checks.

successor 3通过，regression 55通过，合计58通过、0跳过；完整应用构建、类型／Lint／契约通过，449映射、692份输入与产物绑定。最终两组按顺序执行，源码和测试无运行中／运行后漂移，旧SQL1～44及Runner／依赖保持。

## 失败与复核

旧构建在REPLACE原输出收集时准确返回DELIVERY_DATA_REPLACEMENT_UNAPPROVED，已核实其嵌入源码与基线一致。第一次新构建用例1通过／2失败，原因是显式physical heldAt早于实际源控制写门关闭；仅重排新夹具为先关闭控制门、再生成受控物理记录，保留原快照时序校验与全部断言。两份失败夹具经原记录SHA核实保留，产品修复字节未再改。直接递归整个workspace遇到既有Cordis／loader循环，改用仓库root build脚本先按既定顺序构建vendor；原失败命令保留。

源Git、模型／Runtime／调度准入、OCI、迁移artifact来源及物理fence／容器／网络／路由／审查观察为明确夹具；实际事务／数据与夹具分别记录。第二轮本次到T5待发布，变化review后的再次确认持久模型尚需实施，完整D01～D08、干净checkout及真实环境仍待验证。单Agent开发复核，正式工作包、OpenSpec8/13及阶段门槛不据此完成。

原始记录：[evidence.json](./development/successor-data-strategy/evidence.json)、[final-binding.json](./development/successor-data-strategy/final-binding.json)、[failure-history.json](./development/successor-data-strategy/failure-history.json)、[manifest.json](./development/successor-data-strategy/manifest.json)。

补充管理检查：首次diff检查发现增量spec末尾多一个空行，原六项输出保留于management-checks-initial.json；只移除该格式空行，产品源码、测试及构建输入保持，再执行管理检查。
