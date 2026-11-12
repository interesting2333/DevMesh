# P1-07 独立预览 HTTPS／会话开发复核

日期：2026-11-13；实施／复核：同一 Codex Agent。OpenSpec 3.1 的本地实现及真实 HTTP 验证完成，变更为 6/13；正式 P1-07 仍等待 P1-06／G0。没有归档变更或认定产品、人工及阶段验收通过。

## 本地实现

新增 `@devmesh/preview-gateway`，默认关闭。每个预览使用确定的独立 host，平台与预览使用不同可注册域；共享模式校验公共及私有后缀。HTTPS、准确 Host、固定原目标及用途隔离共同约束访问。`issueForMember` 仅供可信平台身份组合调用，不接受 HTTP 请求自报 principal；当前尚未自动装配到 `startPlatform`，没有开放身份签发入口。

前向迁移 35 保存 ticket／session 摘要、原项目／成员／gateway／配置／目标／origin／期限及不可变事件。ticket 最长 60 秒，只能事务性消费一次；session 最长 5 分钟，均不超过原预览到期。原消费丢 ACK 仅允许准确原内部结果恢复，换 session 不可重用 ticket。每次使用重查当前成员与原目标，撤销和到期关闭访问，注销不释放 UNKNOWN 写计数。每项目／成员限制活跃 ticket 和 session 数量。

平台凭一次性 ticket 在准确预览 origin 交换 host-only `__Host-` Cookie；Cookie 为 Secure／HttpOnly／SameSite=None，无 Domain，响应不返回 session 原文。交换只允许准确平台 Origin 的 JSON／CORS 请求，业务写必须来自准确预览 Origin。主平台 Cookie、Authorization、Origin、Referer、转发头和应用 Set-Cookie／Location 不进入另一信任域。CSP 与 iframe 限制父页面、导航、弹窗和 Service Worker。

业务写 key 按当前主体、预览及 gateway 配置隔离，绑定实际发送的头、方法、路径及正文摘要。重复原写返回持久原状态，不重新转发。Runner 在真正构造本地 HTTP 请求前，核对原 journal、reservation、lifecycle、实例、端点及实时健康，再执行最后授权；直接连接原 loopback 端点，不跟随重定向或自动重试。准确未发送为 NOT_SENT，已构造请求但未收到完整响应为 UNKNOWN，完整错误响应也记录 FINISHED；成员撤销后可以记账，但不再返回内容。

模板客户端保留网关已记录或原意图冲突的写 key。上次结果未知时，恢复遇到认证／权限拒绝不能证明原写未执行，因此仍保留 key 并阻止新意图；首次明确拒绝的写仍可清除。该边界由客户端独立测试验证。

## 实际执行与失败记录

原材料位于 [development/preview-http](./development/preview-http/retention.json)。保留后的报告与原输出均保持字节，不将失败报告改写成成功。

| 运行 | 实际结果与范围 |
| --- | --- |
| sessions-1 | 8/9；到期 ticket 先检查健康导致错误拒绝码；修正检查次序，原失败保留。 |
| sessions-2 | 9/9；真实控制 SQLite／Worker、并发消费、丢 ACK／重开、到期／成员／purpose／容量及撤销保留未知写。 |
| http-1 | 1/8；七项在 dataset 夹具 original remoteKey 不一致处失败；修正夹具，不放宽实际校验。该次构建也不作为最新 Runner 生命周期检查的证明。 |
| http-2 | 筛选单例 1/1；实际 HTTPS／交换／Cookie／用途检查。 |
| http-3 | 34/37；HTTP 与会话／访问项通过，三项存储测试仍把最新版本写死为 34。修正历史升级测试，旧迁移不改。 |
| http-4 | 40/40，失败／取消／跳过均 0；11 HTTP、9 会话、15 访问及 5 存储用例。 |
| browser-1 | 1/1；实际 Edge 157.0.4341.42、平台／预览 HTTPS、跨站 Cookie／CORS／iframe 与实际 SQLite 写入。 |
| http-checks-1 | 模板类型检查与契约生成检查通过；这是客户端恢复补丁之前的原执行。 |
| template-api-1 | 4/4；原先增加已记录请求保护后的实际 Vitest 结果及两份源码留存。 |
| session-storage-1 | 33/33，失败／取消／跳过均 0；所有历史版本升级、备份、崩溃恢复、完整性及新迁移回滚。 |
| template-api-2 | 6/6；实际 Vitest 验证原写 key、冲突原意图及重载后认证／权限拒绝的恢复保护；模板类型检查通过。 |

不同运行有重叠用例，不能把表格直接相加为独立用例数。名称筛选通过不表示未匹配用例被执行。

HTTP 用例实际经过 TLS server、控制 SQLite Worker、Runner SQLite Worker、原模板 Express 服务和实际业务 SQLite；包含真实 CRUD、重复写不重发、SQL 提交后断线、丢派发 ACK 不发送、在途撤销后扣留内容、错误原实例及最后授权拒绝、真实墙钟到期与当前成员撤销。上游候选／构建资格、镜像和容器／网络身份由明确合法夹具提供，没有执行 OCI 构建或 Docker／gVisor。

浏览器使用安装的 Edge，测试显式绕过自签名证书信任，未修改系统证书库；Node HTTPS 用例独立核验证书 CA 和预览 hostname。浏览器确认 host-only Cookie 不进入平台、脚本读不到 HttpOnly Cookie、父 DOM／storage／顶层导航／弹窗受限，以及 `worker-src` 实际阻断 Service Worker。浏览器身份签发由私有测试组合完成，不是企业身份或公开入口联调。

## 构建与证据边界

[source-map-binding](./development/preview-http/source-map-binding.json) 对已经执行的 storage／Runner／gateway 构建做只读比对：105 项内嵌 TS 与当时当前源码逐 SHA 一致。它不是新构建或干净 checkout。[historical-migration-binding](./development/preview-http/historical-migration-binding.json) 核对历史 1～34 SQL 及 manifest 前缀与上个 Git 提交一致，新增迁移为 35。

根 frozen install、类型检查、Lint、storage 构建及最终 Runner／gateway 构建均实际返回 0；这些早先工具输出未另存原始文件，不能冒充具有本地原日志的运行。后续保留检查单列原命令与实际输出。各份运行自己的 source／emitted 指纹以及不同运行间变化另见保留材料，客户端补丁后的结果不覆盖此前源码的失败或成功。

[source-comparisons](./development/preview-http/source-comparisons.json) 核对最终 HTTP／存储各自 426 个源码输入，仅客户端 `api.ts` 和 `api.test.ts` 后续发生变化，已用 template-api-2 独立验证。浏览器运行的四项既有文件变化及当前未涵盖的一项输入逐项列出，不声称全部输入相同或整套同指纹重跑；早期会话运行只采集十项选定输入，未采集项不表示当时文件不存在。

保留后实际执行的 Lint、台账检查、全部 OpenSpec 严格校验、设计主文一致性及 diff 检查均通过，原命令、输出及 SHA 见 [post-retention](./development/preview-http/post-retention/report.json)。

## 继续实施

3.2 的可信平台查询／签发入口、实际页面 iframe 装配、下载只读边界尚未完成。实际物理只读／排空、T5、发布 Outbox 和接受后的恢复继续实施。未配置的企业 OIDC、模型及 Linux／Docker／gVisor 联调保持缺项，不用本地 HTTP、受控容器身份、FINISHED 或零在途计数代替这些证据。

源码检查点 `2b1cb5419f98b7f3cae7f2c5a347ef27ff241d41`；[checkpoint-binding](./development/preview-http/checkpoint-binding.json) 将 426 个当前输入和 910 份已保留材料逐项绑定到该提交的 Git 对象。只读绑定不等同再次运行测试、干净 checkout 或产品验收。
