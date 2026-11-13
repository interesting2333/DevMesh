# 接受准备撤销决定：本地开发复核

本次实现安全撤销的控制面决定屏障：当前 owner 按准确原请求／准备版本／强 If-Match 提交明确撤销，保存不可变原决定及已有 proofHash（无证明则 null），与 T5 共用单一 writer 事务互斥。撤销后投影 ABORTING，继续准备权／READY／迟到观察／源闭门／T5 关闭；原 SENT／UNKNOWN、数据、proof、目标 CLOSED 与项目未核实占用保留。

该增量没有物理 stop／rm、fence 解除、源写门恢复、容量释放或 ABORTED；撤销前已获许可的动作可能仍在途，须按原对象核实。后续完整安全撤销、只读准备实例的可写发布转换、正向保留／替换与实际 Linux／gVisor／配额／身份和产品验收继续。正式 P1-07 仍 NOT_STARTED、未认领，等待 P1-06／G0；本变更仍 8/13，4.1 不勾选。

验证结果：abort-01 17/17；storage-02 59/59；regression-01 48/48，均无跳过。构建六个相关包、根类型检查与 Lint 通过；150/150 已生成源码映射与当前 TypeScript 一致。旧控制库 1～39 迁移正文／manifest 与父提交逐字一致，40 为独立前向迁移。专项覆盖原键丢 ACK／重开、SENT／UNKNOWN／READY、当前 owner／撤权、hash／revision／If-Match、失效依据、在途迟到结果、每个事务边界故障回滚、T5 互斥和 SQL 反向屏障。SQLite Worker、迁移与恢复为实际执行；Runner 服务／健康／物理 fence 为明确协议夹具，不作为物理清理证据。

保留失败及修正：migration-01 复现嵌套事务，已修正命令入口复用标准 operation 事务；同时补上派发返回 ABORTING 时不再调用后端的边界及 UNKNOWN／SQL 提交守卫测试。storage-01 为58/59，唯一失败源于不完整历史候选夹具被误用于当前命令；升级用例改为直接验证实际 SQL 迁移／决定屏障，不改生产逻辑或守卫，storage-02 全59通过。原失败日志、源码前后 SHA 和源码字节均保留。

输入核对：各检查运行期间源码与已生成产物未变化。最终运行时代码来自 build-02；之后仅重新生成 OpenAPI JSON、修正独立历史迁移测试，未宣称这两份文件与原构建输入一致。abort-01 的17项复用原通过结果，之后只有该组未执行的历史迁移测试变化，其余生产源码和实际测试文件一致。storage-02／regression-01 使用最终输入，详见 final-binding.json。本轮为修改中 checkout 上的本地开发检查；固定提交干净 checkout／独立复核仍属5.2。

原始报告、输入／产物指纹、修正链、源码映射与校验脚本见 [原始证据](./development/acceptance-abort/manifest.json) 和 [绑定](./development/acceptance-abort/final-binding.json)。最终管理、OpenSpec、设计生成一致性、契约、Lint 与 diff 检查见 post-1；未进行完整根 pnpm check、真实外部环境或产品验收。
