# 接受后的发布控制：本地开发复核

已实现迁移42、私有原后端发布writer与显式ReleasePublisher。T5同事务登记独立PENDING／首条历史，原接受回执与promotion Outbox不可变；PENDING→SENT只发一次许可。丢派发ACK、SENT或UNKNOWN只查询原操作，禁止重新初始化／迁移、创建替代服务或重新切路由。未配置可信后端保持关闭，未默认安装物理发布后端。

派发基准固定目标门、原准备关闭的源门和原项目路由release／hash／generation。稳定proof绑定原准备、接受、镜像、数据、原只读服务及网络消失、永久撤权、严格后继物理fence及不同reservation／profile／instance／network的可写服务。所有写入口要求CONTROL_GATE_FENCED；目标提交前ARMED／CONTROL_CLOSED，旧源RETIRED／CLOSED。恢复另查询30秒内原服务／路由／fence，原proof不重签。原后端权限来自原不可变策略，普通成员只读，成员移除不改变原后端恢复身份。

观察、proof、路由CAS、目标数据READY／源数据RETIRED、目标门及门历史、发布状态／历史、终态Run资源版本及事件同一writer事务。源门保持原CLOSED与历史。接受指针改变、数据缺失、原写DISPATCHED／UNKNOWN、错误服务／路由／fence都阻止提交。原PUBLISHED和准确观察重放只表示历史事实；不会据此保证当前健康或重新切换路由。

最终publication-05 69/69；transaction-05 74/74；acceptance-05 68/68，合计211项通过，无失败／跳过／取消。六包构建、根类型检查与Lint通过，164/164源码映射一致；三个最终测试组的输入与产物逐项匹配build-05且运行中不变。根test:acceptance已纳入发布测试，contracts生成检查和项目检查另留post记录；未执行整个根pnpm check。

测试实际使用控制SQLite Worker和正式初次候选／审查／T5，新增T5发布登记／历史故障点验证整笔接受回滚。发布测试覆盖唯一派发／并发／重启、后端和成员授权、错误绑定／只读或无物理guard声明、逐点事务故障、superseded指针、UNKNOWN原查询、丢派发／发布／控制ACK及有界扫描。实际等待31秒后旧观察失效，保持原proof并补新鲜查询才可提交。源分支使用明确的后继接受元数据夹具，验证旧门保持关闭、路由generation递增和源数据retirement；没有执行第二轮正式冻结／保留迁移／替换／T5。

控制原1～41迁移正文和manifest条目逐字节不变，仅新增42；Runner原8份迁移SQL不变。41→42实际SQLite验证只回填PENDING、保留原Outbox／接受／撤销／未知写／门，DDL或历史写失败回滚旧结构及外键。历史Outbox样本由正式T5内容在全新v41结构中显式装载：装载期间临时移除后精确恢复原触发器，外键始终启用；这不是运行旧应用T5或生产降级。另一原UNKNOWN写／撤销样本经实际40→41→42升级。

首轮build成功而typecheck两处失败，修正可空SQL参数与联合类型收窄，Lint当时未执行。publication-01为47/51，错误为回执字段、成员不可见错误码和共享endpoint夹具。publication-02的源夹具缺candidate_freezes外键记录，随后清理未退出；publication-03业务用例通过但父清理因嵌套临时目录的Windows EBUSY失败，两次均明确终止本次测试子进程，原日志及运行时输入变化保留。publication-04为65/67，structuredClone保留共享引用导致endpoint拒绝码仍错误；改为JSON隔离后最终通过，无产品校验放宽。source-03误用了迁移名称过滤器，没有选中覆盖，明确排除统计。失败源码按原输入SHA保存，未变文件绑定父提交；初始SQL由差异反推并校验原SHA，不能与后续成功源码混用。

设计专题及生成完整方案、实施、验收、OpenSpec与台账基线已同步。证据限修改中checkout的同一Agent本地开发复核；物理撤权／容器／可写服务／路由均为显式协议声明。实际Runner独立可写容量与阶段日志、物理guard／网络／撤权、实际Release访问及导出、平台可信装配、固定提交干净checkout、独立／人工产品与Linux／gVisor验收仍待完成。完整4.3／5.1／5.2不勾选，OpenSpec仍8/13、不归档，正式P1-07保持NOT_STARTED／未认领，等待P1-06／G0。

原输出及文件SHA见[清单](./development/release-publication/manifest.json)，源码／产物／历史迁移和失败解释见[绑定](./development/release-publication/final-binding.json)。
