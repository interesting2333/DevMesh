# P1-07 平台预览入口与材料下载开发复核

日期：2026-11-13。实施／复核：同一 Codex Agent，复核范围为本地实现、原始输出与当前源码绑定；不是独立人员或人工验收。OpenSpec 3.2 完成，变更 7/13；正式 P1-07 仍等待 P1-06／G0。

## 当前行为

可信宿主通过 `startPlatform(config, {identityResolver, previewGateway})` 显式组合。没有身份解析器、网关、准确平台 origin 或原写门时关闭访问，不签默认身份。网关 HTTPS listener、证书／DNS 和 Runner transport 由宿主拥有，平台停止不等于远端实例停止。

平台提供当前成员预览查询、只读页面和用途票据签发。投影排除 Runner 端点／实例与宿主路径，分别显示到期、恢复、未知和未配置。页面 GET 不签票据；按钮使用准确平台 Origin 与空 JSON 签发，再跨站兑换 HttpOnly Cookie，并实际查询会话确认浏览器保留凭据后才加载 iframe。ticket 不进入 URL 或持久浏览器存储。nonce CSP 与 iframe 限制预览访问平台身份。

仅 loopback-development 允许平台为实际 loopback IP origin；预览仍使用 HTTPS 和独立 host。共享模式继续校验不同可注册域（含私有 PSL），不会接受 IP 平台例外。实际协议取 socket TLS 状态，不信任转发头。

材料下载只接受准确 Run／candidate／冻结 delivery materialKey，解析原内容库引用，核实实际字节 hash／大小，在发送前再检查当前成员。响应固定 attachment／octet-stream／nosniff／sandbox，不把生成 HTML 作为平台页面执行；Range 当前明确 416。文件打开后撤销成员仍阻止发送，finally 释放流与内容 pin。私有领域的不可见资源错误统一映射公共 404，配置缺失、暂不可用和限流有公共错误契约。没有接受、替代执行或重新生成材料的副作用。

## 实际执行

原材料保留在 [preview-entry](./development/preview-entry/retention.json)。各次报告与输出保持原字节，失败不改写为成功。

| 运行 | 实际结果 |
| --- | --- |
| entry-build-1 | contracts／gateway／input-api／platform-core 构建、模板 Vite 构建、根类型检查／Lint／OpenAPI 检查均返回 0；为修复公共错误映射之前的构建。 |
| entry-1 | 42 项：38 通过、4 失败。契约仍写死 24 路由；新夹具错误读取 projects.active_run_id；健康用例错误期待 RECOVERING 而真实状态为 UNKNOWN；下载越权私有错误未映射导致 503。原 9 项输入及 11 项 HTTPS 网关回归通过。 |
| entry-build-2 | 仅重建变化的 contracts／input-api 并生成契约；根类型检查、Lint、OpenAPI 检查均返回 0。未重复构建未变化的网关／平台／模板。 |
| entry-2 | 23 项：21 通过、2 失败。新夹具又错误读取 runs.state；真实 schema 为 phase／terminal_outcome。未配置写门及冻结材料实际下载／撤权检查通过。 |
| entry-3 | 浏览器 0/1；同一夹具字段错误，尚未进入页面操作。 |
| entry-4 | 23/23，失败／取消／跳过均 0。18 项共享契约与 5 项平台入口／实际冻结材料访问。 |
| entry-5 | 实际 Edge 157.0.4341.42：1/1，失败／取消／跳过均 0。平台页面→签发→跨站兑换／Cookie 探测→隔离 iframe→实际 React 表单→真实业务 SQLite 一条新任务。 |

每次用例自己的 `sourceFiles`、`emitted`、原命令、环境和退出码均记录；五次执行期间输入指纹均未变化。最终 entry-4 与 entry-5 的全部输入一致。entry-1 与最终相差七项；entry-2／3 仅夹具字段修复一项差异。逐项列表见 [source-comparisons](./development/preview-entry/source-comparisons.json)，不把不同源码的检查拼成同指纹全量重跑。

每份执行报告保存明确 `baseCommit` 与仅变化文件的 `source-delta`，其余输入引用该 Git 版本，均附 SHA-256。最终构建的 [source-map-binding](./development/preview-entry/entry-build-2/source-map-binding.json) 核对六个依赖包中 129 项内嵌一方 TS 全部与源码一致，同时记录 map／产物 SHA；这是对实际构建的只读绑定，不是新构建、测试或干净 checkout。

浏览器只向准确平台 origin 注入测试 Bearer，预览请求不带平台 Authorization。验证 HttpOnly／Secure／SameSite=None Cookie 仅属于预览 host、平台域无此 Cookie、父 DOM 访问被阻止；业务 POST 只有一条原请求。Node HTTPS 另独立核验临时 CA，浏览器显式忽略测试自签名证书错误，未更改系统证书库。

留存后 Lint、台账、全部 OpenSpec 严格校验及设计完整主文一致性均通过，见 [post-retention](./development/preview-entry/post-retention/report.json)。该次 diff 检查发现增量 spec 末尾多一个空行；只修正该空行后的实际检查返回 0，见 [diff-repair](./development/preview-entry/post-retention/diff-repair.json)。不重写原失败或将其计入产品测试。

下载用例通过真实冻结流程、正式质量／材料收集和实际内容库读取；查询、页面、票据及浏览器用例经过真实控制 Worker／Runner Worker、HTTPS、模板服务和业务 SQLite。源 Git 集成／准入、候选／镜像／容器与网络事实为明确夹具；身份为测试注入。它们不证明企业 OIDC、Cookie 登录、OCI 构建、实际 Docker／gVisor、物理数据排空或 T5。

## 后续边界

本增量没有启用 CLI 默认身份或共享网络写入口，没有接受或路由切换。继续实施 4.1 原接受依据与外部准备、4.2 T5、4.3 发布及导出恢复。2.3 的真实容器适配／可信装配和产品、阶段验收仍未完成，变更不归档。

源码检查点 `ec889aa72bedc247da4cf244c90ffbc4df25ef68`；[checkpoint-binding](./development/preview-entry/checkpoint-binding.json) 将 431 个最终输入、保留材料及设计／管理上下文共 572 项逐字节绑定到该提交 Git 对象。绑定是只读核对，不能代替再次执行或干净 checkout。
