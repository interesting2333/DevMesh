# 最终一致性检查（2026-11-16）

- HEAD：`c239db1`（检查开始时）
- 范围：当前候选树的构建、关键离线回归与台账／契约一致性
- 结论：以下检查通过；**不构成产品验收或门槛通过**

## 结果

| 检查 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| 全量构建 | `corepack pnpm@11.28.5 build` | 通过 | `.cache/final-build.log` |
| 关键离线回归（28 个文件） | 见下 | **78 个用例：77 通过、1 跳过、0 失败** | [consolidated.tap](./consolidated.tap) |
| workbench-live | `node --test tests/browser/workbench-live.test.mjs` | **9/9 通过** | [workbench-live.tap](./workbench-live.tap) |
| 全量类型检查 | `corepack pnpm@11.28.5 typecheck` | 通过 | [typecheck.log](./typecheck.log) |
| 契约漂移 | `corepack pnpm@11.28.5 contracts:check` | 通过 | [contracts.log](./contracts.log) |
| 台账 | `node project/manage.mjs check` | 通过 | [manage.log](./manage.log) |
| OpenSpec 严格校验 | `node project/openspec.mjs validate --all --strict --no-interactive` | **32/32** | [openspec.log](./openspec.log) |
| 设计主文一致 | `node design/生成完整方案.mjs --check` | 通过 | [design.log](./design.log) |

唯一的 1 个跳过是 `release-manifest` 写模式测试：证据文件已存在时按设计跳过，不是失败。

## 关键离线回归覆盖

Run 控制、崩溃恢复、变更提案、配置调整、Invocation、公共任务、内容 pin、归档账本、重做、历史导出、Exposure、统计／配置导出、备份快照、发布清单、存储与契约。

## 仍未执行

- 真实 DeepSeek 模型、企业 OIDC、Linux Runner／Docker／gVisor／runsc。
- `test:runner` 全套（本 Windows 主机超过 35 分钟未完成，部分 TAP 不计通过）。
- 五条完整产品路径、89 场景人工签署与 G0～G4 评审。

因此 G0～G4 仍全部 `PENDING`，各工作包正式状态不变。