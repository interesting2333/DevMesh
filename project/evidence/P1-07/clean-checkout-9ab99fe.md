# P1-07 干净 checkout 回归记录（5.2）

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-preview-review-and-acceptance`（父工作包 P1-07）
- 任务：5.2 在固定提交干净 checkout 执行适用回归，保存原日志／SHA／源码指纹、部署与恢复说明，同步 OpenSpec 和父工作包台账，单列企业身份／真实 Linux／容器／迁移验收条件
- 结论：在固定提交 `9ab99fe` 的干净克隆中完成冻结安装、构建、类型、Lint、契约及预览／审查／验收适用回归；两次失败（模板依赖缺失、冷启动超时）原样保留，最终套件全绿。**不宣称真实 OIDC／Linux／容器／迁移或产品验收通过**

## 源码指纹

| 项目 | 值 |
| --- | --- |
| commit | `9ab99fe1359e95320ceb1c9385ca0bc5cc0ca634` |
| tree | `f0d011dd0a7689cbfce8c05a06d9a0587a63bd81` |
| pnpm-lock SHA-256 | `e70b0d3f367bbddb20ed55985625bd29a42d11b970fec1f47424419c2867af1f` |
| Node | v24.13.1 |
| 克隆位置 | `.cache/p1-07-clean-9ab99fe`（gitignored 缓存，日志已复制入本目录） |

## 运行与结果

| 步骤 | 结果 | 日志 |
| --- | --- | --- |
| `git clone` + `pnpm install --frozen-lockfile` | 退出 0 | [install.log](./clean-checkout-9ab99fe/install.log) |
| `npm ci --prefix tools/openspec` | 退出 0 | 同上 |
| `pnpm build` | 退出 0 | [build.log](./clean-checkout-9ab99fe/build.log) |
| 模板 `pnpm install --frozen-lockfile` + `pnpm build` | 退出 0 | [template-install.log](./clean-checkout-9ab99fe/template-install.log)、[template-build.log](./clean-checkout-9ab99fe/template-build.log) |
| `pnpm typecheck` | 退出 0 | [typecheck.log](./clean-checkout-9ab99fe/typecheck.log) |
| `pnpm lint` | `Found 0 warnings and 0 errors` | [lint.log](./clean-checkout-9ab99fe/lint.log) |
| `pnpm contracts:check` | `OpenAPI matches the executable contracts` | [contracts.log](./clean-checkout-9ab99fe/contracts.log) |
| `pnpm test:acceptance` | 321/321 通过，0 失败 | [acceptance.log](./clean-checkout-9ab99fe/acceptance.log) |
| `pnpm test:review-browser` | 4/4 通过 | [review-browser.log](./clean-checkout-9ab99fe/review-browser.log) |
| `pnpm test:preview-browser` | 首次 0/3（模板依赖缺失）、二次 5/6（首个 iframe 标题 30 秒超时）、最终 6/6 通过 | [preview-browser.log](./clean-checkout-9ab99fe/preview-browser.log)、[rerun](./clean-checkout-9ab99fe/preview-browser-rerun.log)、[final](./clean-checkout-9ab99fe/preview-browser-rerun2.log) |

## 失败与修正（原样保留）

1. **首次 preview／review 浏览器测试**：`MODULE_NOT_FOUND`，干净克隆中 `templates/web-crud-v1` 不在根 workspace 内，未安装模板依赖。处理：在模板目录执行冻结安装。
2. **二次 preview**：模板 `dist` 缺失导致 iframe 业务页不加载。处理：在模板目录执行 `pnpm build`。
3. **三次 preview**：首个用例 `getByRole('heading')` 30 秒超时，宿主满载冷启动；未改产品和断言，原样保留后复跑 6/6 通过。
4. 上述发现说明根 `pnpm build` 不覆盖独立模板工作区；干净环境需额外执行模板安装与构建。

## 部署与恢复说明

- [packages/preview-gateway/RELEASE.md](../../../packages/preview-gateway/RELEASE.md)
- [packages/result-verifier/EXPORTS.md](../../../packages/result-verifier/EXPORTS.md)
- [packages/storage-sqlite/ACCEPTANCE.md](../../../packages/storage-sqlite/ACCEPTANCE.md)
- [packages/storage-sqlite/PREVIEW-ACCESS.md](../../../packages/storage-sqlite/PREVIEW-ACCESS.md)
- [packages/runner/PREVIEWS.md](../../../packages/runner/PREVIEWS.md)、[packages/runner/RELEASE-PUBLICATION.md](../../../packages/runner/RELEASE-PUBLICATION.md)

## 单独列出的未验收条件

- 企业身份／OIDC：未配置、未执行。
- 真实 Linux Runner／Docker／gVisor／runsc：未配置、未执行。
- 真实容器、网络、TLS 证书、物理 fencing／guard：夹具或本地替代。
- 正式迁移执行、默认平台装配与产品验收：未执行。
- 2.3／4.1／4.3／5.1 仍保持未勾选；正式 P1-07 与 G0～G4 不变。
