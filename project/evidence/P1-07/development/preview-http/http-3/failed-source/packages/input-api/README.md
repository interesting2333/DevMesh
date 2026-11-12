# 项目输入 API

`@devmesh/input-api` 是 `/api/v1` 的持久输入边界，独立于模型和 Runner。默认关闭，平台配置显式启用后还必须由宿主注入可信 `IdentityResolver`；没有 resolver 时受保护请求返回 503。当前 CLI 不接入企业 OIDC/OAuth，不签发默认用户、匿名会话或测试 bearer。测试中的身份解析器只存在于测试文件。

平台配置中的 `inputApi` 接收 `enabled`、可信绝对 `repositoryRoot`、固定 40 位 `commit` 和可选 `templatePath`。启动时用 Git 核实确切提交并读取该提交的模板清单，随后冻结版本与基线；请求不能传入主体、代码 SHA、存储目录或执行状态。该步骤仅核实模板来源，项目仓库准备随后续 bootstrap 实施。

公开接口包括逐文件 `POST /attachments`、附件元数据／内容读取与逻辑移除、项目创建／列表、已有项目新任务、Run 消息、workspace、项目 Run 事件，以及 operation 按 ID／原键核实。写入使用 UUID `Idempotency-Key`；条件写入使用强 ETag `If-Match: "r17"`。API 检查 socket loopback、精确 Host、同 Origin、歧义头和 JSON 大小，不信任客户端自报身份。Cookie 认证当前明确拒绝，企业浏览器登录与 CSRF 待对应接入。

正文按 Unicode code point 限制 20,000，保存原始空白；首次允许纯附件输入，空正文与空白正文不会被改写成系统摘要。每次输入最多三个独立附件。上传为一个 `file` part 加一个 `clientAttachmentId` 字段，支持非空 UTF-8 `.md/.markdown/.txt`，每文件最多 2 MiB；名称仅为展示元数据。Busboy 固定 1.6.0，类型固定 1.5.5；其源码实际为每 part 16 KiB header／2,000 header pairs 的硬上限，不能用更小的 headerPairs 参数冒充已生效。另有总字节、part、field、30 秒期限及并发上限。

上传先提交原键与 claim、再写随机 staging；完整字段／字节通过后冻结请求 hash，复用内容库发布，最后把 READY 附件与原操作结果提交。并发不会接管原 claim，失败或中断必须查询原键，不自动创建新请求。重启在内容恢复之后核实 intake，只有完全匹配的已发布附件可被恢复为 READY。残缺接收保留 INTERRUPTED。staging、附件或失败记录均不触发自动 GC。

创建 T1 在一个 SQLite Worker 事务中完成 owner 成员、Task、唯一活动 Run、原文 artifact/message、附件绑定、独立 WAITING 理解 operation、Outbox 和事件。文件／Git／网络均不进入事务。创建成功表示输入已保存；没有模型也不会伪造理解结果。当前成员权限先于原键返回，原键先于新操作 CAS；暂停时补充消息保持暂停，消息意图不会直接修改实施计划。

workspace 在单个读事务中冻结元数据、材料引用与 eventCursor，随后读取不可变正文，再复核当前成员权限；事件可从该 cursor 补取，默认 50、最多 200 条。历史 Run 只读，项目列表按更新时间和 ID 分页。现有项目新任务必须从当前人工接受 release 的固定代码提交开始，且项目没有其他活动 Run。

企业身份、真实模型、完整工作台、WebSocket 和真实 Runner 均不由本模块的离线测试宣称验收。运行 `pnpm test:input` 查看实际 HTTP、真实 Worker、迁移和进程 SIGKILL 恢复检查；原始结果随父工作包保存。
