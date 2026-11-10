## Context

依据 design/03 §1～4、design/05 §3、T1 和内容写入顺序，以及 PRD §5.2.1～5.2.2。当前 `createProjectWithRun` 已保存单次事务与去重，但只有 owner 字段，未把附件、独立理解作业和公开授权读操作接到 API；内容库已有有界 staging／hash／发布及附件索引。见 proposal.md。

## Goals / Non-Goals

**Goals:** 交付实际 HTTP→Worker→内容库的输入路径，在真实临时数据库中验证重复、回滚、权限和快照，并保持原始正文及材料来源。

**Non-Goals:** 当前不接企业登录环境、不做匿名降级；不以持久提交冒充真实模型处理、完整工作台或 U01～U04 产品验收。WebSocket 订阅与浏览器草稿在 P1-08 实施，本次提供可补发的有界事件读取。

## Decisions

1. 新增输入 API 模块，以代码注入的 `IdentityResolver` 为可信入口，默认未配置。测试使用显式 loopback 测试身份，忽略请求中的 principalId／身份头。主体在事务前解析，事务内检查当前 project_members；不能仅依赖旧权限缓存。预留持久 auth_sessions（token digest、期限、撤销），不制造 OIDC 登录成功或静态默认用户。Cookie 接入必须同时约束 Origin／CSRF；本次不提供匿名 Cookie 签发接口。
2. 合约沿用 `/api/v1`、256 KiB JSON、UUID Idempotency-Key、If-Match 与 error envelope。正文用 code point 计数，验证是否空白与存储原文分离；首次仅附件输入保存真实空正文和独立附件引用。名称可自动生成，客户端不能指定内部主体、代码 SHA、存储路径或执行状态。可信模板描述提供实际固定源码 SHA／版本，文件和 Git 检查在事务前进行。
3. Multipart 使用独立流解析器，固定 Busboy 1.6.0／类型 1.5.5，设置 files=1、字段／part 上限、文件 2 MiB 与总请求上限、30 秒期限和最多 4 个并发上传（可配 1～8）。按锁定源码核实，每 part header 为 16 KiB／2,000 pairs 的硬限制，较小 headerPairs 配置实际上无效，不能冒充已执行；fileSize／parts 达到阈值即通知，因此借助额外一字节／第三 part 通知和应用计数准确允许 2 MiB 与两个合法 part。依据其[官方流接口](https://github.com/mscdex/busboy)。不使用整请求 JSON/base64 或无限内存缓存；Node 24 适用性由实际构建及 HTTP 回归验证。
4. 流接收前保存带主体、原键和 claim token 的 intake／保护记录，文件名仅为展示元数据。流式写同卷随机 staging，累计字节、SHA-256 与 fatal UTF-8 校验；结束且字段完整后比较规范请求 hash，交给现有内容发布流程，再事务保存 READY 附件和 operation 结果。并发原键不同时写同一文件；未完成请求返回可核实的处理中／中断状态。断开或错误只终结该 intake；重启核实原记录，不将残缺文件转为 READY。原键重传先核实原状态，完整请求同键异字节／名称／clientAttachmentId 拒绝。解析字段缺失时记录输入操作失败，无需伪造有效附件。
5. 附件读取按 owner 或已授权的项目引用，不能开放按 hash 下载。逻辑移除不立即删除内容；已绑定 Run 的材料不能被移除接口破坏。一次项目输入最多三个去重后的 READY 引用，任何失败／不属于主体的引用都使本次创建整体失败。成功附件不会被失败 intake 撤销。
6. 将 T1 同步事实写入抽为同一事务内步骤，与现有存储 API 共用约束；公开输入新增 owner 成员、附件绑定及独立理解 operation。创建 operation 为保存输入的确定结果，理解 operation 单独 ACCEPTED／WAITING，不因模型配置缺失伪造成功。正文／manifest／附件字节先由内容库发布，事务只检查 READY 索引并建引用；失败可留下受保护且可重试的上传内容，不能留下可调度半项目。
7. project_members 支持 owner/operator/viewer；迁移为已有项目回填 owner，保留旧主键及外键。新增输入／附件关联、upload_intakes、auth_sessions 及必要索引。Worker 继续白名单类型化领域方法，公开查询另带 principal 和作用域，不能把现有内部 `getOperation/getRun` 无鉴权地暴露为 REST。迭代任务严格核实当前接受指针和无活动 Run；不把未接受成果当起点。
8. append message 的认证、权限、原键去重、版本 CAS、原文／附件／解释意图／事件同事务；暂停时可保存但不开放执行门。查询解释和实施变更分开。相同原键在版本已推进后仍返回原结果。
9. workspace 用一个有界读事务冻结元数据、来源引用和最后 seq，随后从内容库按不可变引用读取正文；读取期间权限撤销则拒绝，不返回越权片段。current/history 与 allowedActions 由结构化状态产生。项目列表按更新时间和 ID 稳定分页，事件默认 50、最多 200；不能以 cursor 作为授权。实际实时推送随后续工作包复用这些事实。

## Risks / Trade-offs

- [流尚未完整，无法比较最终请求 hash] → 独立 intake 状态、原键占用和 claim fencing，完整校验后才返回保存成功；并发和重启均查原记录。
- [索引已引用但正文未发布] → 内容发布在前、READY 引用事务在后；缺失或损坏阻塞读取，不补空正文。
- [权限变更与旧页面重试] → 当前权限在去重返回前校验；保存结果不可作为新的读凭据。
- [框架错误泄露路径或密钥] → 公共 error envelope 和 requestId，原始诊断只进受控日志，不回显堆栈、绝对路径或身份凭据。

## Migration Plan

在当前 version 6 后新增版本化迁移，升级前沿用一致性备份与 checksum 校验；回填项目 owner 成员，不重写原内容或历史事件。失败批次整体回滚，旧版本程序拒绝打开未知新版本。用旧库保留、迁移失败、FK 检查、真实 HTTP、实际子进程断点及原键恢复验证后保存固定源证据；企业 OIDC 和真实模型联调保持未执行。
