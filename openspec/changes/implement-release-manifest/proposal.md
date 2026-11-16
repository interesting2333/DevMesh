## Why

父工作包 P4-04 的发布交付与开放范围复核。完整发布需要人工评审与真实验收；离线可做的是生成一份只陈述事实的发布清单，避免手工汇总漂移。G1 未通过，本变更只作提前准备。

## What Changes

- 新增 `project/release-manifest.mjs`：汇总 git HEAD、包版本、schema 版本、迁移清单摘要、OpenAPI 摘要、门槛状态、工作包状态计数与各变更任务数。
- 只输出可核对事实；**不输出“可发布／已验收”结论**。
- `--write` 写入 `project/evidence/P4-04/release-manifest.json`。
- 测试校验清单与源文件一致、门槛保持真实状态、且不含通过声明。

## Capabilities

### New Capabilities

- `release-manifest`: 发布事实清单生成器。

### Modified Capabilities

不改产品代码、schema 或门槛。

## Impact

影响 `project/` 工具、测试与证据目录。正式 P4-04、G0～G4 不变。