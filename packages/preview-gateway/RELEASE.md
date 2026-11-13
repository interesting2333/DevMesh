# Release 访问组件

`ReleaseGateway` 与 `RunnerReleaseHttpTransport` 为显式组合组件。默认服务不创建 Release listener，不启用模型、企业身份或物理 Runner。宿主必须传入同一 Runner 的 `RunnerReleaseServiceBackend`、控制存储、当前成员身份解析器、TLS 配置和独立应用域名。

```ts
import { createServer } from 'node:https';
import { ReleaseGateway } from '@devmesh/preview-gateway';
import { RunnerReleaseHttpTransport } from '@devmesh/runner';
import { mountInputApi } from '@devmesh/input-api';

const gateway = new ReleaseGateway(control, new RunnerReleaseHttpTransport(backend), {
  enabled: false, // 物理 provider、TLS、身份与域名验收后由宿主明确启用。
  mode: 'shared',
  gatewayId: 'release.gateway.primary',
  principalId: 'release.gateway.service',
  platformOrigin: 'https://control.example.com',
  releaseBaseOrigin: 'https://apps.example.net',
});
// 由已认证项目 owner 注册 gateway.policy；不接受请求正文声明的 principal。
await control.request('registerReleaseAccessPolicy', {
  principalId: ownerId, projectId, policy: gateway.policy,
});
const listener = createServer(tlsOptions, gateway.handle);
listener.on('upgrade', (_req, socket) => socket.destroy());
listener.on('connect', (_req, socket) => socket.destroy());
listener.requestTimeout = 30000;
listener.headersTimeout = 10000;
mountInputApi(app, content, {
  enabled: true, baseline, identityResolver, releaseGateway: gateway,
});
// 宿主负责 listen、TLS 轮换、关闭 listener、gateway.close() 和 store 生命周期。
```

策略绑定的配置摘要包含 `enabled`、域名和限额，注册后不可修改。示例展示关闭状态；正式启用时先构造最终配置的网关，再由 owner 注册对应 policy。已注册配置需要变更时，使用新的 `gatewayId` 注册新策略，旧票据与会话不迁移到新配置。

平台路由为 `/api/v1/runs/:runId/releases/:releaseId`、`/view` 和 `POST /access`。GET 只核实当前成员、接受指针、原发布证明／路由以及原 Runner 当前 guard／fences／实例／HTTP 健康，不签票据。未发布、正在恢复、非当前版本或未配置时显示对应状态，不回退到旧 Release。POST 要求准确平台 Origin、空 JSON 和当前成员；平台身份不传给业务应用。

票据最多 60 秒，会话最多 5 分钟；`dmr_ticket`／`dmr_session` 使用 256 位随机值，数据库只保存摘要。票据事务内单次兑换。独立 `__Host-devmesh-release` Cookie 使用 Secure／HttpOnly／SameSite=None，主机为 `r-<Release ID SHA 前40位>.<应用域名>`；与预览 p- 主机和 dmp 凭据不互用。共享模式要求平台和应用处于不同的可识别注册域。浏览器先兑换，再核实 Cookie，再加载受限 iframe。

每次业务请求核实原会话及当前成员、准确原发布代际和实例；Viewer 只读，写入还要求原门版本仍 OPEN。先持久准备与一次 DISPATCHED 许可，再核实 Runner 原对象及权限，最后只发一次有界 loopback HTTP。没有客户端目标地址、DNS、重定向、连接池或自动重试；上游 Cookie、Location、凭据和危险响应头不透传。响应先记账，再检查当前成员。授权丢失不清除已发生业务事实。

控制迁移43引入独立 Release 请求／票据／会话历史及 `business_pending_writes`，统一计数 PREVIEW／RELEASE 的 DISPATCHED／UNKNOWN 写。验收就绪、T5、发布及撤销完成／重开门使用同一屏障。丢派发 ACK 不调用业务 transport；请求已构造后的不完整响应保留 UNKNOWN，不能重发或把超时当未执行。私有查询和原请求观察用于恢复，当前没有自动判断业务 UNKNOWN 结局的协调器。

发布中断的继续由显式组合的 `ReleasePublisher.advance/recoverPage` 与原 `RunnerReleaseServiceBackend.resume` 承担；网关 GET 仍只查询，不触发恢复。恢复先核实原阶段结果，每个尚未派发阶段再领取唯一许可，并复核当前接受指针、闭门、未定写屏障及原 fence／guard。Runner v12 将配额准备纳入动作日志，旧 profile 只查询已有配额事实。具体装配和限制见 [Runner 发布说明](../runner/RELEASE-PUBLICATION.md)。

物理 ALL_DATASET_WRITES guard、默认平台装配、导出和正式后继保留／替换 T5 仍需各自实现及验收。当前开放门要求与原发布证明的初次 OPEN 版本一致；后继准备撤销后若门再次换代，须完成原物理服务／fence 恢复和明确重新授权协议，不能沿用旧会话直接放开写。应用宿主不可通过删除原记录、修改策略、重开旧门或重建实例绕过恢复条件。
