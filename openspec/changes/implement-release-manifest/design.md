## Context

P4-04 要求发布包、版本清单、运维交接与开放范围复核。人工汇总容易与仓库状态漂移；先提供事实清单生成器。

## Goals / Non-Goals

**Goals**
- 从仓库真实文件生成发布事实清单。
- 明确显示门槛与工作包的真实状态，便于发现未完成项。
- 输出可重复、可测试。

**Non-Goals**
- 不判断“可发布”，不生成开放范围结论，不替代人工评审。
- 不打包制品、不签名、不上传。

## Decisions

1. **事实来源**：`project/tasks.json`、`packages/storage-sqlite/migrations/manifest.json`、`packages/contracts/openapi.json`、根 `package.json`、`git rev-parse HEAD`。
2. **schema 版本**：取迁移 manifest 最后一项的 version。
3. **摘要**：对迁移 manifest 与 OpenAPI 文件计算 SHA-256。
4. **门槛**：原样输出 G0～G4 状态，不改变。
5. **变更进度**：统计每个 OpenSpec 变更的已勾选／总任务数。
6. **无结论字段**：不输出 `releasable`、`accepted` 或类似声明。

## Risks / Trade-offs

- 清单是瞬时快照 → 记录 generatedAt 与 HEAD。
- 不包含构建产物 → 发布包仍需人工构建与复核。

## Migration Plan

无迁移；删除脚本与测试即可回退。