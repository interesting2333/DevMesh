# 后继数据方案与替换确认顺序

父工作包P1-07，关联4.1／5.1。交付先收集原Runner作业的固定输出和规范数据方案，再冻结准确候选、逐项审查，最后由owner确认REPLACE并开始接受准备。旧实现同时要求交付阶段存在通用CHANGE决定、接受阶段存在候选／review绑定的独立决定；前一要求没有正式创建入口，阻止候选生成，与已有接受页确认顺序冲突。

## 决定

交付中的REPLACE是提案。保留原作业、实际内容hash／大小、规范JSON、准确Run／commit／需求／计划／template／checkConfig及当前sourceReleaseId校验；不创建批准决定、dataset或接受准备。冻结与审查也不执行数据替换。删除交付阶段额外的通用CHANGE决定前置，沿用已有接受域的独立确认：准确candidate revision／manifestHash／reviewHash／sourceReleaseId／dataPlanHash／decisionId、当前owner、原UUID和Run If-Match。缺确认时beginAcceptancePreparation必须拒绝；审查改变后旧确认失效。INITIAL仍不能覆盖已有来源，PRESERVE_MIGRATE仍要求同Run准备好的准确迁移artifact。

不新增批准API、模型权限、数据库迁移或默认物理后端。既有历史候选、决定与T5不改写。确认变化后的重新确认持久模型需单独复核；本次负例只证明旧确认不能授权新review，不据此声称已支持重复确认。

## 开发组合

测试复用同一个实际文件控制Worker数据库：首轮正式候选／Work评估／审查／T5及发布后，通过实际模板HTTP写入业务行，再由createInputTask创建基于已接受commit的新Run。既有显式来源／模型／Runtime准入夹具只扩展为可复用该数据库和准确新Run；归档operation、质量workspace／pipeline按新Run隔离，不插入第二个Release、candidate或接受结论。

第二轮实际原作业HTTP输出收集、内容事务、三项Work评估、冻结、审查、准确替换确认、SQLite复制或空初始化、只读服务HTTP健康、准备证明和T5使用生产组件。PRESERVE_MIGRATE验证旧业务行进入不同dataset；REPLACE验证新目标为空且来源字节保留。源控制门必须先关闭，再由显式夹具记录物理heldAt，之后才产生数据快照；原检查不放宽。原键重开恢复不重复接受，源／目标门在未发布时保持关闭。

源Git集成、模型／Runtime／调度准入、生成OCI字节、迁移artifact来源、物理fence／容器／网络／路由及审查观察仍为明确夹具。新Run使用已有内部publishPlan夹具，不宣称完整准备Agent或工作台业务流程。首轮发布真实HTTP与业务SQLite，第二轮本次止于T5／待发布；后继路由／物理交接、完整D01～D08、企业身份、真实Linux／gVisor与产品验收另验。
