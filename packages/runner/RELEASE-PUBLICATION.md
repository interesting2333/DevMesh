# 发布交接阶段组件

`RunnerReleaseRetirementBackend` 是只读接受服务的退役组件，供后续可信发布适配器组合。它没有实现完整 `ReleasePublicationBackend`，不会创建可写服务、切路由、开放控制写门或返回 PUBLISHED。平台默认入口没有自动启用它。

构造时显式提供 Runner store、控制 storage、原接受服务 controller、原策略 principal／backendRef／runnerId、支持准确 ID 移除的可信 Driver，以及 `ReleaseRetirementAuthority`；`enabled` 默认 false，两个物理依赖都配置后才可使用。Authority 须永久撤销原准备的 acquire／renew／写入，并核实已授权在途操作终止。SQLite／文件标志、APP_READ_ONLY 和关闭控制门不能代替这项物理保证。

组件自行从控制库核实已派发原发布、不可变请求和门 basis。`retire(publication, authorize)` 仅由控制面唯一派发许可持有者调用；调用方参数不能替代控制权威查询。首次 Runner 登记另外返回唯一 grant，固定原 T5、Runner 稳定 prepared proof、只读 profile、容器和网络。原准备与发布组件使用同一 controller；更换 controller 不能收编旧实例。

阶段依次为 REVOKE_PREPARATION、STOP、CONTAINER_REMOVE、NETWORK_REMOVE。每阶段独立 SENT／OBSERVED 日志，只有首次 dispatch=true 才能执行物理动作，执行前再次核实原控制授权。容器消失必须来自成功的准确 ID 查询；inspect 失败或删除命令成功不构成证明。消失观察、原服务 REMOVED、容量释放和服务历史同一 Runner writer 事务；网络移除另行核实，业务数据和原 profile／claim／proof 保留。

`inspect(publication)` 仅查询已持久登记的原步骤并保存观察，不登记新交接、申请新阶段、撤权、停止或移除。没有原 Runner 登记时明确返回 NOT_FOUND。登记 ACK 或阶段 ACK 丢失后，重复 `retire` 也只进入 inspect；核实已完成步骤不会自动派发下一未派发步骤。跨步骤中断由下面新增的显式 resume 协调；查询不会隐式进入该路径。

Runner v10 增加 `release_retirements`／`release_retirement_actions`，历史 v2～v9 SQL 不改。交接与原接受撤销互斥，原服务新事实和执行权关闭。dataset 交接占用持续保留，旧容器释放服务容量后也不能被任意 preview／acceptance 重新预留。恢复分页按原 controller 有界查询，包含容量已释放但网络尚未核实消失的记录。后继可写服务必须通过专用受控交接接管该占用；普通预留接口不能绕过。

本地验证使用实际控制／Runner SQLite Worker、正式首轮 T5、真实业务数据文件；永久物理撤权、Docker／网络和 OCI 是显式夹具。独立可写服务的容量、阶段日志及显式组合见下一节，独立访问见网关说明；真实物理 guard／fence／路由、导出及 Linux／gVisor 验收继续实施，完整 OpenSpec 4.3 尚未完成。

## 独立可写服务组件

显式 RunnerReleaseServiceBackend 组合原 retirement、ReleaseServiceAuthority、DockerReleaseServiceDriver 和 ReleaseServiceRoutes，实现 ReleasePublicationBackend。所有物理依赖须显式配置；enabled 默认 false，平台启动不自动安装。此组件和下面的本地验证不等于生产发布能力或完整 4.3。

原只读服务／网络退役后，Runner v11 持久登记 release_service_handoffs；ARM_FENCES 只能把原 HELD 的同 fenceId 提升到严格更高 generation，previousHoldHash 固定原 proof。目标 ARMED／CONTROL_CLOSED、源 RETIRED／CLOSED、永久撤权 proof 一并绑定。后继必须准确匹配本地原可写 service／route／claim；外部或缺本地原证明的源暂时关闭。每个源只有一个后继，拒绝重复收编。

迭代先 SOURCE_STOP→SOURCE_CONTAINER_REMOVE→SOURCE_NETWORK_REMOVE。准确容器消失、旧 release reservation REMOVED、释放容量和历史同一 writer 事务；未知或失败继续占用。网络清理后才预留新的 purpose=RELEASE 容量和独立 profile，job／preview／acceptance／release 共用槽位、CPU 和内存预算，永久 dataset 交接屏障不因服务容量释放而消失。

PROFILE_PREPARE→GUARD_ENFORCE→NETWORK_CREATE→CREATE→START→准确 HTTP 健康→内部生成 RELEASE_OWNED claim→ROUTE_BIND。Guard 必须覆盖所有业务数据写入，包括后台和直接文件写入，同时受物理代和当前控制门约束；APP_READ_ONLY／代理标志不代替这个保证。实际可写创建／启动前 Driver 再查 guard、原 OCI、配额、完整容器／网络 profile 和末次授权，旧源停止／清理只查完整原 profile，不要求已经退役的 guard 重新准入。

新容器业务目录可写而 operation.json／receipt.json／dataset.json 单独只读。固定 APP_RUNTIME_ROOT=/tmp/devmesh-runtime 把进程运行锁留在临时盘；该锁只避免同一运行根重复打开，跨实例写入排他仍由物理 fence／guard 保证。模板只读连接不创建锁，发布连接启动和健康不切 SQLite 日志模式；首次获准写请求才切换 WAL 并开始事务，不以 init／migration 启动发布服务。

稳定发布 proof 只从原日志派生一次，后续健康不改写它。返回观察前新查原 service／HTTP、guard、fence、route，以及只读实例／网络和旧可写源的准确消失结果。控制发布 writer 最终原子保存 proof／route、数据状态、目标开门和事件；Runner 不自行开控制门。

Guard 的后续写准入须读取同一个控制事务视图：项目接受指针仍为该 release、原 publication 已 PUBLISHED、当前 route 的 release／hash／generation 与原 proof 相符，claim 的 reservation／profile／serviceRequestHash／实例和物理代准确匹配，dataset 为 READY，写门为 OPEN。初次开门的 fence／revision 为固定 targetGate basis 各加一，datasetOperationId／datasetRequestHash 保持原身份，close 字段清空；后续关闭或修订即拒绝旧准入，重新开门须另有已验证协议，不因名称相同继续放行。已进入的写动作也必须由物理 Authority 排空后才能移交，逐次逻辑查询不能代替这个保证。

Routes.bind 登记的是受控制准入约束的准备路由；控制发布成功前不得激活公开业务入口。路由 provider 必须按控制库当前原子路由视图决定可见性，不能先切公开流量再补数据库记录。路由观察 BOUND 证明原准备绑定，不单独证明已对外开放；显式 Release 访问入口见 `packages/preview-gateway/RELEASE.md`，真实物理路由仍须独立验收。

每阶段只有唯一持久 SENT grant 能执行动作。inspect 不登记、预留、准备配额、接管、安装 guard、创建／启动、切路由或获得新 fence；仅查询已派发原步骤并保存观察，已有 claim／route 完整时可派生稳定 proof。回执丢失可核实原步骤；显式 resume 才允许申请后继未派发阶段的唯一许可。独立导出、默认装配、正式后继 T5 与真实物理 Authority／guard／route、Linux／gVisor 仍继续实施与验收。

Runner v12 增加持久 PROFILE_PREPARE 阶段；新 profile 同事务记录 EXECUTE_ONCE。唯一动作许可后调用 `driver.prepare(profile, request, authorize)`，结果由 `driver.prepared(profile, request)` 只读核实。丢许可或结果 ACK 后不能重复 prepare，配额尚不可核实则停止推进。v11 既有 profile 标记 INSPECT_ONLY，只能核实准确原目录与上限，不在升级中回填完成或恢复时重新应用配额；旧动作／proof／容量和历史 SQL 保留，迁移失败回滚。

## 可信装配入口

下面是供平台维护代码调用的 JavaScript 装配函数。`identity` 仅含 `runnerId`、`controllerId`、`backendRef` 和 `principalId`：其中 `runnerId`／`backendRef` 沿用原接受策略，`principalId` 对应策略的 `backendPrincipalId`，`controllerId` 沿用原接受服务控制器。退役与发布传入完全相同的 store／control 对象和身份。`releaseDriver` 由部署方显式构造，实际启用要求 Linux Docker／gVisor、quota、networkIsolation 和全写 guard 均已配置；当前仓库不提供默认物理 Authority／guard／route provider。

```js
import { RunnerReleaseRetirementBackend, RunnerReleaseServiceBackend } from '@devmesh/runner';
import { ReleasePublisher } from '@devmesh/platform-core';

export function createReleasePublisher({
  store, control, readonlyDriver, revocationAuthority, handoffAuthority,
  releaseDriver, routes, identity, repository, capacity, resourceLimits,
  enabled = false,
}) {
  const options = { ...identity, enabled };
  const retirement = new RunnerReleaseRetirementBackend(
    store, control, readonlyDriver, revocationAuthority, options,
  );
  const backend = new RunnerReleaseServiceBackend(
    store, control, retirement, handoffAuthority, releaseDriver, routes,
    { ...options, repository, capacity, resourceLimits },
  );
  return new ReleasePublisher(control, identity.principalId, backend);
}
```

创建后由可信调用方执行 `publisher.advance(releaseId)`，它从原 PENDING 领取一次控制许可。`recoverPage({ projectId, policyHash, afterSequence, limit })` 有界扫描原控制发布作业。对 SENT／UNKNOWN，advance 先 inspect；后端显式提供 resume 时，再经 `verifyReleasePublicationContinuation` 核实同一原请求／basis、当前接受指针、准确关闭门及无未决写，才协调逐阶段许可。原 `verifyReleasePublication` 仍只授权 SENT，publish 不重派。已派发阶段只查询，前驱未核实便停止，不创建替代服务。多个协调器仍由每阶段 Runner 单 writer 的唯一许可互斥。store／control 的打开、身份配置和关闭由宿主负责，这个函数没有安装平台 HTTP 路由或后台恢复循环。

分页上限约束记录数；它不对任意注入的 provider Promise 安装统一超时或取消。宿主须为物理查询／调用配置截止和在途操作管理；超时不证明动作未执行，不释放占用或恢复原许可。Native Docker CLI 和 HTTP 的已有时限不等于所有自定义 provider 都已取得同样保障。
