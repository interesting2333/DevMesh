# P4-04 发布事实清单准备（1.1／1.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-release-manifest`（父工作包 P4-04）
- 任务：1.1 清单生成器与测试；1.2 生成证据并同步记录
- 结论：发布事实清单可重复生成并与仓库文件一致；**不包含“可发布／已验收”结论**；正式 P4-04 仍 `NOT_STARTED`

## 实现

`project/release-manifest.mjs` 从仓库真实文件生成：

| 字段 | 来源 |
| --- | --- |
| `gitHead` | `git rev-parse HEAD` |
| `rootPackage`／`packages` | 根与各 workspace 的 `package.json` |
| `databaseSchemaVersion` | 迁移 manifest 最后一项 |
| `migrations.digest` | 迁移 manifest 文件 SHA-256 |
| `openapi.digest`／`pathCount` | `packages/contracts/openapi.json` |
| `gates` | `project/tasks.json` 原样 |
| `workPackages` | 工作包状态计数 |
| `changes` | 各 OpenSpec 变更的任务完成数／总数 |

`--write` 写入 `project/evidence/P4-04/release-manifest.json`；不带参数输出到 stdout。

**明确没有** `releasable`、`accepted`、`passed`、`ready` 字段。

## 测试

```powershell
node --test --test-reporter=spec tests/release-manifest.test.mjs
```

结果：2/2 通过；日志见 [release-manifest-test.txt](./release-manifest-test.txt)。

覆盖：schema 版本、迁移／OpenAPI 摘要、门槛原样、工作包计数、变更进度、无通过声明、`--write` 与 stdout 一致。

## 未完成与边界

- 不打包制品、不签名、不上传，不生成开放范围结论。
- 发布清单是瞬时事实，不替代 G4 人工评审与真实验收。
- 正式 P4-04／G1～G4 不变。