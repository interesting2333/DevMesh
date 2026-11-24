# 会话项目执行（开发模式）

2026-11-23 的会话执行增量关联 P1-08 / enable-assistant-project-execution。正式 Linux/gVisor Runner、配额与阶段门槛仍按原规范验收。

## 使用

1. 从零创建 HTML 不需要 Git 目录，系统在独立任务目录中生成文件。需要修改现有代码时，在左下角绑定本地 Git 目录后新建任务；该任务保留创建时的目录身份和提交依据。
2. 执行模式可读取、搜索并修改任务副本；计划模式只读分析。上传的文本材料参与任务理解，不会被当成系统指令或权限。
3. 生成的 HTML 使用基础结构、自包含资源和内联 JavaScript 语法检查；提供受限预览及鉴权下载。检查不等同于完整浏览器／生产验收。已有代码的助手按实际代码继续调用工具；对多个文件进行修改后运行项目预先存在的 build / test / lint 检查，失败时读取真实日志继续修复。界面展示差异和退出码。
4. 在「项目操作」中展开差异与检查输出。绑定项目可点击「应用变更到项目」；应用前比较每个文件的原内容 SHA，原目录有新改动时不会直接覆盖。从零生成的 HTML 可直接预览、下载。
5. 刷新不会重新提交应用；遇到确认丢失，使用「核实原应用请求」继续相同键和内容。部分应用仍保留原请求，不另起一份应用。
6. 可在对话中补充要求，已保留的候选副本会作为后续修改起点。暂停阻止新动作并停止正在运行的容器；未知结果先核实原请求，不自动重发模型或命令。

## 本地配置

assistant 默认为关闭。顶层配置示例（本机需要先准备对应的 Linux Docker 镜像）：

```json
{"assistant":{"enabled":true,"backend":"docker-development","imageDigest":"sha256:4f696fbf39f383c1e486030ba6b289a5d9af541642fc78ab197e584a113b9c03","timeoutMs":120000}}
```

本地预览脚本为模型开启 SSE；开发任务总保留预算为 200,000 个保守计数单位，最多 20 步，保留预算超限检查，不修改正式 Runner 配额。

当前固定镜像来自 node:24.13.1-alpine。启动会探测 Linux Docker 和实际镜像 ID；不在线自动拉取镜像。可配置 backend=disabled 仅提供文件工具。需要已有模型配置并支持工具调用。

开发检查容器为非 root，关闭网络，源任务副本只读挂载，使用 128 MiB 工作 tmpfs 与 32 MiB 临时 tmpfs，限制 2 CPU / 512 MiB / 128 PID，移除 capabilities，启用 no-new-privileges。命令仅选用快照中已有的 Node package.json 检查脚本；脚本定义发生变化后拒绝执行。命令退出、超时、停止通过原容器身份与实际状态核实。

HTML 基础检查使用可信解析／编译逻辑，不执行用户脚本；预览在无同源权限的 iframe 中运行并限制网络。生成代码应对 localStorage、sessionStorage、IndexedDB 使用内存回退，预览数据仅在当前窗口有效。下载先鉴权并核对公开文件版本的 SHA，再保存原字节。

此模式不安装依赖、不联网下载、不发布、不推送 Git，也不提供正式专业 Run 的生产执行资格。依赖不在镜像中、无批准检查或项目使用其他语言工具链时，会保留变更并报告实际阻塞，不能显示检查通过。已有专业规划与 Run/DAG 入口保留；其执行仍需原严格 Runner 环境。首次任务副本最多 3000 文件 / 32 MiB，单文件读取最多 2 MiB、一次文本写入最多 64 KiB，禁止删除、越界、链接和常见凭据文件。

## 实现与恢复

迁移 59 增加 assistant_sessions / assistant_steps / assistant_tool_calls / assistant_applications。模型请求先持久化 SENT，响应先保存，再一次性验证全部工具参数。工具保留顺序和固定 operationId，已完成工具复用回执，写入通过原 SHA 与写入证明恢复。输入版本、模式、目录身份、当前 ACL 在动作前重新核实。

GET /api/v1/conversations/{id}/project-tasks 读取真实结果；POST /api/v1/conversations/{id}/project-applications 接受独立应用原请求；GET /api/v1/assistant-applications/{key}?conversationId=... 核实原应用。浏览器 IndexedDB 事务完成前不会发送应用 POST；服务端应用并发串行化，使用原文件证明恢复部分写入。

## 验证

常规检查：pnpm test:assistant。真实 Docker 检查：设置 DEVMESH_TEST_DOCKER=1 再运行该命令。桌面回归：node --test --test-concurrency=1 tests/browser/assistant-project-execution.test.mjs。开发复核记录见 project/evidence/P1-08/assistant-execution-development-review.md。

## 从零生成与实时进展（2026-11-23）

修复变更为 fix-generated-site-execution。未绑定目录的新建目标进入真实文件工具循环；已保存的写入内容及旧读取分页以摘要进入后续上下文，最新工具结果合计限制为 7 KiB，完整差异和日志仍持久化并可在界面查看。文件读取按 UTF-8 8 KiB 分页；局部修改使用 project_patch，以文件 SHA 和唯一匹配校验替换。

GET /api/v1/conversations/{id}/live 通过 SSE 提供当前输入版本的累计临时文字、工具接收活动和阶段。前端直接显示模型增量，保存后清除临时消息；重连获取累计快照，刷新不重发请求。每次投递核对会话权限与版本，连接定期重新认证，断线与超时明确显示。超过15秒无新内容展示最近真实进展时间。

GET /api/v1/conversations/{id}/project-tasks/{sessionId}/file?path=...&sha256=... 下载已公开的准确文件版本；同一路径 preview 接口仅提供受保护 HTML 预览。生成成果与正式专业 Run／release 分开，不伪造正式候选资格。

专业准备能力只在产品／架构角色支持准备技能且凭据可用时声明并启动；配置不足直接显示阻塞。旧未执行任务可通过原控制请求 RECONCILE 逐条恢复，先通过原 Run 暂停与收尾核实，再将同一输入版本转入生成目录。SQLite60保留原项目／Run的审计关系，原消息不改写。计划模式保持只读，已有执行或未知效果不得转换；不批量启动历史任务。

## 执行详情

五页签对助手执行直接读取持久目标、回复、文件／差异、检查及操作日记。协作显示本轮主助手独立执行与实际工具，不虚构多Agent角色。执行轮次可选择最近20次记录，历史输入版本明确标注；已有项目Run继续使用原专业视图。

GET /api/v1/conversations/{id}/execution-details 可选 sessionId；按当前会话权限读取，选中轮次必须属于该会话。返回至多200项模型步骤、工具与应用事实及总量，不输出模型请求、原始工具参数或本机工作区路径。结果只读，打开详情和刷新不会重新执行。生成文件预览与下载继续按session／路径／SHA保护。
