# DevMesh 协作约定

## 项目管理

- 当前请求及会话中已明确的用户授权优先；工具生成技能的阶段建议不撤销已有实施授权。按已授权范围完成工作，不重复征求授权。
- 开始实施先读 `project/README.md`，运行 `node project/manage.mjs next`，查看目标工作包和已有 OpenSpec 变更。不要把建立管理工具当成应用工作包已完成。
- `project/tasks.json` 是唯一工作包状态源。认领填写真实负责人和开始日期；阻塞填写原因与核实条件；复核与完成按实际证据记录。修改后运行 `node project/manage.mjs render` 和 `check`。
- 新功能、修复和设计调整关联父工作包，维护 `openspec/changes/<name>/` 的 proposal、design、tasks；行为变更补增量 specs。纯工具/文档变更使用 `skip_specs: true`。未实施的设计目标不直接写成当前能力规范。
- 真实完成、验证并复核后再归档。OpenSpec artifact 已生成、tasks 勾选、代码提交、产品验收是不同事实；未执行检查明确标记，阶段门槛单独评审。
- 基线为 PRD V10.0、技术设计 V1.1、验收场景 V10.0、实施文档 V1.0。设计变动需同步受影响文档、工作包、验收和基线记录。
- 技术设计 V1.1 的专题正文维护在 `design/01`～`06`；更新后运行 `node design/生成完整方案.mjs`，检查用 `--check`。
- `D:\yms\AI\deepseek-harness` 为参考工程，未经单独指令不修改。应用技术选型与不变量以设计和实施文档为准。
- Git 不提交密钥、真实用户会话、数据库或运行数据；本地修改和验证可直接推进，外部发布等操作遵循用户实际授权。

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "How does X reach/become Y? / trace the flow from X to Y" | `codegraph_trace` (one call = the whole path, incl. callback/React/JSX dynamic hops) |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag — check the staleness banner, don't guess a wait.** When a codegraph response starts with "⚠️ Some files referenced below were edited since the last index sync…", the listed files are pending re-index — Read those specific files for accurate content. Files NOT in that banner are fresh and codegraph is authoritative for them. `codegraph_status` also lists pending files under "Pending sync".

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
