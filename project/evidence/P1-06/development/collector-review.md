# P1-06 原报告采集开发复核

2026-11-12，同一实施 Codex 复核迁移 22、QualityCollector、Runner 原输出读取、发送前校验和原测试日志；不代表独立人员、产品或阶段验收。

## 实现与验证

- 新增可信 `prepare`／`bind`／`collect` 服务。prepare 固定部署注入的独立源码映射和 provider／toolchain 身份，全量路径及源码哈希须等于原分配 Git manifest。普通 MCP 不开放这些命令，缺 provider 默认拒绝。
- SOURCE 内容 ACK 与流水线首次 SENT 在 SQLite 顺序上互斥。首次发送还要求全部必要 producer 已绑定原 pipeline／ordinal／operation；绑定首次发出前完成且不可替换。迁移 1～21 不修改，追加 22 保存绑定。
- collect 只持有 Runner get／byOperation／output 接口，实际 HTTP 原字节读取有大小上限、原输出 SHA 和 Content-Length 校验；不执行报告脚本、不发送新 Job。原日志、报告、计算结果使用已有专用 target 和稳定 writeKey。
- 原 Job 未知、缺报告或字节不可用时保留 PREPARED 和待核实代码；已知失败及原失败数量保留。内容／终态回执丢失后复用原写入和原结果，已登记的材料可以脱离 Runner 重读。
- `collector-v5` 的类型、lint、完整构建、采集、质量存储、纯计算、存储升级、原 MCP 流水线、Runner 执行身份共 9 项检查通过，源码指纹前后相同。采集 8/8、质量存储 10/10、纯计算 25/25、存储 28/28。
- 8 条采集测试覆盖：实际认证 HTTP 原报告／日志与零额外 POST，真实原 Job 失败，未知原 operation 重复 GET／零 Job，内容和终态 ACK 丢失恢复，哈希篡改拒绝，无 provider／不可替换绑定，SOURCE 发布与 SENT 冲突不遗留半引用，以及字节预算在发送前和流式读取时的约束。

## 失败记录与证据范围

`collector-v1-failed` 保存内部调用向严格查询契约多传 requestHash 造成的 6 条失败及原源码。修正主体参数后 `collector-v2-failed` 为 5/6，通过路径已实际运行，唯一失败是测试误写 object_write_operations 的列名。列名修正并补全采集时的全量 manifest 复查后 `collector-v3` 的 9 项检查通过。新增两个竞争／预算测试的 `collector-v4` 只重跑 lint 与扩展采集 8/8，报告明确引用应用代码相同的 v3，不称为重新执行全部检查。补充必要 producer 绑定的发送前校验后 `collector-v5` 重新执行完整 9 项且通过。早期类型预检曾发现品牌 ID 和解析器参数签名错误，已在正式 v1 检查前修正，不计作通过记录。

所有记录均为提交 651cbbb 之后的开发源码指纹；没有把它们说成 651cbbb 的干净提交结果。Git／准入和独立位置映射是明确夹具；实际运行组件为 Runner SQLite、本地认证 HTTP、输出文件、PipelineCoordinator、内容库。受控后端写入原报告夹具，不执行生成业务代码。

生产可信映射工具链及 Runtime 自动组合尚待 5.1；正式 Work 完成绑定、缺陷／修复和候选冻结仍待后续任务。没有真实模型、OIDC、Linux／Docker／gVisor 验收。历史 SOURCE 无工具链证明或已发送作业的记录不回填新证明；保留历史，不能通过改旧正文或换 Job 冒充新验证。依据此范围完成子任务 2.2；P1-06 正式前置、父工作包状态与门槛不变。
