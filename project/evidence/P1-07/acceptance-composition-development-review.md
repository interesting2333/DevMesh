# P1-07 接受服务组合开发复核

日期：2026-11-13；实施与复核均为同一 Codex Agent，属于本地开发复核。基于 5509c097c422002f8bf4eecb738b5119800b7f57 的本地修改执行，不是干净 checkout、独立评审或产品验收。

4.1 接受服务组合：显式 RunnerAcceptancePreparationBackend／ACCEPTANCE Docker Driver、整库只读与原对象恢复，Runner v8 保存稳定完整 proof；实际 SQLite／模板 HTTP→HELD／控制面 READY→T5 本地链路通过。service-02 16/16、regression-01 15/15、migrations-01 选中4项通过（其余测试未选择，TAP skipped=0），构建／类型／Lint和148份源码映射通过。首轮28项25通过3失败源于两处测试错误，另有未使用导入导致Lint失败，三处修正及原日志／源码指纹全部保留；最后三组输入与最终构建一致、运行期间无变化。物理容器／镜像来源／fence 为明确夹具；真实 Linux／quota／networkIsolation／物理 custody、安全撤销、OWNED／发布及正向保留／替换与完整产品验收继续。4.1不勾选，变更8/13及正式P1-07／门槛不变。

## 实现与边界

- 直接 ACCEPTANCE 请求／只读 profile，整个 /data 只读，APP_READ_ONLY=true；公共 OCI／runsc／非 root／只读根／资源／网络／端口核验供两种用途共用。Docker Driver 在缺 Linux／hard quota／networkIsolation 时关闭；物理 custody 必须显式配置。平台启动未默认装配。
- 实际数据组件、Runner 原 network/create/start 日志、原端点模板 HTTP、RELEASE_HELD 与完整 proof 显式组合；每次新动作前重新核实授权及相同原 fences。inspect 不重新 acquire／初始化或补发缺失后继，UNKNOWN 保留容量和文件。
- Runner v8 不可变 proof 固定 preparedAt、claim／custodyRevision、数据与 fences。心跳、HTTP 503、Worker 终止／重开、proof ACK 丢失都不替换原 proof。后续健康独立实际检查；历史 proof 不表示当前 READY。
- 只读模板实际读取演示数据，POST 返回403，数据／journal字节保持；控制面领域命令按冻结候选／审查准备并完成T5，Run COMPLETED、promotion意图一项、preview effects为零。候选源码／构建／OCI来源、容器及物理fence是显式夹具，未启动Docker／gVisor或验证物理排空。
- 控制存储源码／39份迁移未改。Runner v2～v7六份迁移正文与基准逐字节匹配。v7活跃服务／动作升级、故障回滚／摘要漂移关闭及旧v1～v5升级分别验证。
- 准备实例的只读挂载／环境不可变。已同步设计、实施文档及增量spec：T5或逻辑开门不使实例可写，后续发布须另行核实服务转换、准确归属、健康和写fence交接，不能改原profile／proof；该转换尚未实施。

## 原始执行与修正

| 执行 | 结果与范围 |
| --- | --- |
| build-01 | Runner build／根tsc通过；Lint因previewRepository未使用导入返回1 |
| service-01 | 28项：25通过／3失败／0取消／0跳过；Docker夹具未canonical化对象导致一项失败，fence换代错误期待抛错导致子项及父项失败；原服务／控制proof／新T5与迁移其余用例通过 |
| build-02 | 删除未使用导入、修正夹具hash及UNKNOWN断言后，build／tsc／Lint均0 |
| service-02 | 16/16，新组合整文件全部执行；包括回执丢失／回滚、只读HTTP、稳定proof、v7升级及实际文件／HTTP→控制READY→T5 |
| regression-01 | 15/15，预览容器组合／公共安全核验和v1原记录升级整文件 |
| migrations-01 | 正则只选v2／v3／v4／v5升级／历史保留，4项通过；TAP skipped=0；其余测试未选择，不称对应文件全量 |

service-01运行期间输入／产物未改。其后仅三处修正，原源码及前后摘要在 source-corrections.json，失败TS文本保留为.txt；没有覆盖原报告。最终三组与build-02的全体输入一致，各自输入／产物无运行期间变化。删除未使用导入仅改变index.mjs.map，第一轮和最终生成的运行时代码全部相同。148/148源码映射匹配只是一项绑定检查，不能代替测试。构建已有工具插件sourcemap警告原样保留，第一方map正文摘要核对全部通过。通用driver的scope描述本批开发背景，各组实际范围以上表、选中文件及正则为准。

原始材料见 [manifest](./development/acceptance-composition/manifest.json)（实际路径：`project/evidence/P1-07/development/acceptance-composition/manifest.json`）、各组report.json／stdout、[final-binding](./development/acceptance-composition/final-binding.json)及[map-binding](./development/acceptance-composition/map-binding.json)。留存不包含运行数据库或凭据；日志SHA与原输入指纹逐组保存。post-1用于保存台账／OpenSpec／设计／契约／Lint与工作区差异八项检查。

## 状态

D4／D5／D6、完整技术设计、实施文档和OpenSpec增量同步。PRD与D01～D08目标未缩减；P1-07仍NOT_STARTED并等待P1-06／G0，独立代码开发按既有授权推进，完整4.1与4.3／5.1／5.2待完成，变更8/13不归档。
