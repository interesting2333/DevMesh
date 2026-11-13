## Scope

父工作包P1-07，衔接2.3／5.1。已有原启动／停止／到期协议和PreviewLifecycleManager；补齐startPlatform显式previewLifecycle工厂及PreviewLifecycleConsumer，让原持久预览在没有HTTP请求时继续核实健康和到期。没有真实Runner／Linux资源时依然默认关闭，不据此完成整个工作包或物理验收。

## Trusted binding

每项固定projectId／policyHash／principalId／backendRef／runnerId和已构造的PreviewExecutionBackend。新增私有getPreviewLifecycleScope按原DB策略认证service主体；普通成员不能代替后端。消费器启动时核实完整绑定，每次backend调用前检查原effect和dataset原请求的范围；固定方法而不修改调用者对象，configured继续动态读取。只需要持久存储，Input API／身份／访问网关单独装配。所有后续宿主组合成功后才启动循环，失败释放控制资源；外部资源由构造者管理。无新增持久表、迁移或公共后端注册。

## Original work

复用listPreviewLifecycles的原工作分页与不可变历史；终态且无未决effect的预览不占工作页。每轮每范围最多读取一页，游标在末页归零，范围按轮转预算扫描。最多32项目、每项目一绑定、跨项目最多2并发且单项目串行，页1～20、范围1～32，轮询1～10秒；tick合并。错误仅保留安全码，单范围故障不阻止其他范围。

PREPARED仅获取原一次许可；SENT／UNKNOWN查询原对象，成功start的原receipt不因健康刷新改写。读取API不推进。到期沿用原确定键和原停止操作，只能停止未接受且实例已核实的预览；原Release保护由控制writer及Runner再次核实。数据准备、owner决定、T5、发布、容器移除或dataset删除不在该消费者中隐式发起。

## Stop and drain

stopAdmission同步关闭全部manager，停止新范围和最终物理授权。manager在preflight后、取得原许可后／再次读取生命周期后复核关闭；暂停的预检返回后不能新派发。到期决定前同样复核关闭。已有调用真实返回后才结束consumer.stop，之后宿主关闭SQLite；没有强制取消或超时竞赛。已取得但未执行的许可仍保留SENT，不在重启中获得第二次执行。保留原运行观察／历史，不伪造退出、数据排空或物理取消。

## Validation

使用实际文件控制Worker验证身份／预算、tick合并、活跃分页／终态过滤、原许可与runtime提交丢ACK／重开恢复、预检与execute暂停后的stop、三项目最多2调用及故障隔离。真实时钟超过30秒健康窗口，再用真实周期消费者刷新；等真实TTL后验证一项目只一个原停止，另一项目的显式Release归属投影不受TTL影响，归属投影不声称T5完成。单独组合实际数据文件、Runner日志与loopback HTTP健康，停止后数据字节保留，已登记停止在owner移除后按原后端恢复。宿主验证默认关闭／错配拒绝／后续工厂失败零派发、存储释放、停机排空和重启只查询。容器／网络／OCI／上游原数据是明确夹具，真实环境和完整5.1／5.2分别验收。
