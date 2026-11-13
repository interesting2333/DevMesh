# Trusted abort consumption

父工作包P1-07，继续4.1／5.1。后台只推进用户已经持久确认的原撤销决定，不替用户创建撤销、接受或删除数据。默认无物理适配器。

## Original work and composition

私有listAcceptanceAbortWork按原project／policy／backend主体分页，只返回存在撤销决定且没有completion的原准备；已完成历史不占工作页，原准备历史保留。主体权限来自不可变DB策略，不依赖当前owner仍为成员。宿主通过acceptanceAbort可信工厂固定项目／policyHash／主体／backendRef／Runner及后端，逐项核实原策略；只要求持久存储，关闭新接受入口后仍可恢复已确认撤销。所有宿主组合成功后才启动。

有界项目、范围／页预算、最多2项目并发，每项目串行、tick合并和范围轮转。后端只接收原operationId／requestHash；RunnerAcceptanceAbortCoordinator核实清理器和finalizer的Runner／controller／主体／backendRef一致，串联原服务清理与数据／源恢复核实。不更换原阶段身份；未知已派发动作仅查询，没有充分物理事实保持ABORTING／UNKNOWN。完成仍经原writer核实永久撤权、目标闭门、原源归属／新鲜健康及未知写屏障，原子保存completion并只恢复适用原源门。目标数据保留、目标门不打开。

## Stop and authority drain

消费者stop同步关闭扫描并中止传入的信号，Runner在新清理阶段许可前后、driver最终授权、数据Worker授权、finalizer进入数据／源查询／completion之前核实停止。已开始实际调用排空后才关闭存储，后端接口不强制取消。数据Worker的超时或退出不能当作其外部authority调用已结束：父进程保留未结束RPC并排空后才结束advance／释放Worker名额。停止不将未知清理伪装完成，也不丢弃原日志；下一次恢复仍查原动作。

## Evidence and compatibility

不新增迁移或依赖，不改已有决策／completion历史。验证实际文件Worker、Runner日志、数据文件及平台启停；物理driver／永久撤权／源健康若使用协议夹具须明确记录。覆盖队列权限／终态过滤、丢ACK后重开、周期恢复、并发预算、停机最终授权、真实文件清理组合及Worker超时后外部调用排空。完整后继业务链、真实Linux／gVisor与产品验收继续独立保留，不提前完成父工作包或完整OpenSpec任务。
