## Context

见 proposal.md。P0-06 已保存完整模型与工具步骤；P0-07 提供独立 RunnerClient／operation 查询，尚无实际 runsc 环境。依据 design/02 §6、design/04 §2、§4。用户已授权连续实施并在资源暂缺时推进代码；不以计划材料的生成要求再次等待确认。

## Goals / Non-Goals

**Goals:** 可复查的真实 MCP 调用、冻结服务能力、授权快照只读、长任务原操作查询、断线不重放写操作。

**Non-Goals:** 本变更不实现余下 docs/issues/pipeline 全部服务（P1-04），不把 tests.start 的成功登记当测试通过，不替代 Runner 隔离验收或真实模型验收。

## Decisions

1. 采用官方 `@modelcontextprotocol/sdk` 1.32.2，兼容 Node 24 与 Zod 4；固定实际安装的依赖闭包。该维护分支 API 与当前 Streamable HTTP 集成兼容；v2 拆包迁移不在此变更静默发生。仅用官方 Client/Server，经真实 loopback HTTP 联调，不将内部函数标为 source=mcp。
2. Streamable HTTP 使用无会话状态的短请求模式，按请求认证服务主体；服务端严格 Host／Origin 检查、体积限制、超时、JSON 错误投影。首版只绑定 loopback，经 TLS 代理跨机；企业认证空置不等于内部服务匿名访问。
3. 客户端 connect/listTools 后冻结协议、服务版本、工具 JSON schema 与哈希。调用只发一次；连接恢复不会重发工具。重新连接后签名变化必须阻塞。模型可见参数不包含凭据、服务地址、原 operationId 或 permit；桥接层从真实执行宿主补齐。
4. repo.list/read 仅访问操作员绑定的快照及显式文件清单，逐文件验证 SHA-256／大小。拒绝路径越界、链接、隐藏凭据路径与非清单文件；读取不执行 Git helper、模块、仓库脚本或生成应用。
5. tests.start 把稳定 operationId 映射为 Runner 作业，命令／镜像／输出清单由已批准 check 配置决定；get/stop/by-operation 检查返回作业的实际宿主。读取／停止原作业的授权与新启动授权分开，暂停后仍可核实与停止，不能因当前准入关闭而丢失收尾能力。
6. 服务端 authority 必须核实当前服务调用者、工具 allowlist、宿主、资源许可及动作类型；默认缺失即拒绝。生产 composition 后续接入控制面已提交的许可，离线夹具明确提供测试授权，不冒充动态授权已联通。
7. RuntimeTool 桥接保存 source=mcp 与连接快照；未知 start 仅调用 tests.by-operation，已知 get/stop 使用原 job，不换键重建。MCP 的成功回包只是工具事实，不升级为 Attempt、质量验证或人工接受事实。
8. DeepSeek 函数名不接受点号，桥接将 `repo.read` 映射为单一模型名 `repo_read`，原 MCP 名保存在连接元数据，碰撞拒绝。Provider 发送前拒绝不兼容／重复工具名；角色 allowlist 使用模型名。依据官方 Chat Completions 字段约束，不把两个名字计为两项能力。

## Risks / Trade-offs

- [实际隔离环境缺失] → 使用真实协议／Runner 管理 HTTP 与明确标识的容器后端验证，实际 tests 作业与 T04/T05 专项保留待执行。
- [SDK 协商／断连行为变化] → 冻结精确版本，核对实际 SDK 源码、真实 HTTP 断线测试及 schema 变更测试。
- [快照内容变动或越界] → 显式绑定清单、逐项哈希、无跟随链接读取，变更报错而不自动采纳新内容。
- [控制面尚未组合完整服务授权] → 默认连接不启用；authority 回查是必需依赖，不提供 permit 自证或匿名回退。

## Migration Plan

新增可选包与配置，不修改已有业务迁移；依赖锁文件更新。先完成官方协议、repo 和 tests 后端，再组合 RuntimeTool 并验证。回滚时关闭 MCP 连接，保留已登记 Runner job 和工具操作；未知作业继续按原操作核实，不从队列重放。
