# 发布交接阶段组件

`RunnerReleaseRetirementBackend` 是只读接受服务的退役组件，供后续可信发布适配器组合。它没有实现完整 `ReleasePublicationBackend`，不会创建可写服务、切路由、开放控制写门或返回 PUBLISHED。平台默认入口没有自动启用它。

构造时显式提供 Runner store、控制 storage、原接受服务 controller、原策略 principal／backendRef／runnerId、支持准确 ID 移除的可信 Driver，以及 `ReleaseRetirementAuthority`；`enabled` 默认 false，两个物理依赖都配置后才可使用。Authority 须永久撤销原准备的 acquire／renew／写入，并核实已授权在途操作终止。SQLite／文件标志、APP_READ_ONLY 和关闭控制门不能代替这项物理保证。

组件自行从控制库核实已派发原发布、不可变请求和门 basis。`retire(publication, authorize)` 仅由控制面唯一派发许可持有者调用；调用方参数不能替代控制权威查询。首次 Runner 登记另外返回唯一 grant，固定原 T5、Runner 稳定 prepared proof、只读 profile、容器和网络。原准备与发布组件使用同一 controller；更换 controller 不能收编旧实例。

阶段依次为 REVOKE_PREPARATION、STOP、CONTAINER_REMOVE、NETWORK_REMOVE。每阶段独立 SENT／OBSERVED 日志，只有首次 dispatch=true 才能执行物理动作，执行前再次核实原控制授权。容器消失必须来自成功的准确 ID 查询；inspect 失败或删除命令成功不构成证明。消失观察、原服务 REMOVED、容量释放和服务历史同一 Runner writer 事务；网络移除另行核实，业务数据和原 profile／claim／proof 保留。

`inspect(publication)` 仅查询已持久登记的原步骤并保存观察，不登记新交接、申请新阶段、撤权、停止或移除。没有原 Runner 登记时明确返回 NOT_FOUND。登记 ACK 或阶段 ACK 丢失后，重复 `retire` 也只进入 inspect；核实已完成步骤不会自动派发下一未派发步骤。因此跨步骤中断可能持续未完成，需要后续显式恢复协调协议；不能据此声称完整自动发布恢复已经实现。

Runner v10 增加 `release_retirements`／`release_retirement_actions`，历史 v2～v9 SQL 不改。交接与原接受撤销互斥，原服务新事实和执行权关闭。dataset 交接占用持续保留，旧容器释放服务容量后也不能被任意 preview／acceptance 重新预留。恢复分页按原 controller 有界查询，包含容量已释放但网络尚未核实消失的记录。后继可写服务必须通过专用受控交接接管该占用；普通预留接口不能绕过。

本地验证使用实际控制／Runner SQLite Worker、正式首轮 T5、真实业务数据文件；永久物理撤权、Docker／网络和 OCI 是显式夹具。独立可写服务的容量与阶段日志、物理写门 guard、后继 fence、实际路由、Release 入口／导出及 Linux／gVisor 验收继续实施；完整 OpenSpec 4.3 尚未完成。
