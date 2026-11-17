# 模型选择开发与复核记录

日期：2026-11-17。执行／复核：Codex（同一 Agent），Windows、Node v24.13.1、pnpm 11.28.5、Edge 157.0.4341.60。

## 结果

- 设置弹窗提供模型下拉框、“获取模型列表”／“刷新列表”和手动输入；保留当前模型，选择后需明确保存并重启。
- 已配置接入打开时读取只读模型元数据；未保存的 Provider／Endpoint／Key 可用于获取列表，不先写文件。更改接入信息或关闭弹窗会中止请求并使迟到结果失效。
- `POST /api/v1/settings/model:models` 经过既有本机身份校验；无新Key时仅同Provider及规范化Endpoint可复用已有Key。6秒超时、1 MiB响应上限、最多1000个去重有效ID、禁止重定向，不回显Key或上游错误正文。
- 列表与保存共用现有 Runtime 的 `opaqueKey` 模型ID规则，未扩大运行时命名格式或模型能力；无数据库迁移。现有符合运行时规则的设置仍可读取、选择和保存。
- `test:input` 加入模型设置HTTP用例；README与部署指南补充选择步骤。设计专题、技术整合文档和实施文档同步，基线哈希按实际文件更新。

## 验证

| 命令 / 范围 | 结果 |
| --- | --- |
| `corepack pnpm@11.28.5 --filter @devmesh/input-api build` | 通过，含真实工作台前端bundle |
| `corepack pnpm@11.28.5 typecheck` | 通过 |
| 本次input-api源码及3个相关测试文件的Oxlint `--deny-warnings` | 通过 |
| `node --test tests/model-settings-http.test.mjs tests/browser/model-settings-selection.test.mjs` | 7/7：HTTP4、浏览器3 |
| `node --test tests/browser/workbench-live.test.mjs tests/browser/workbench-page.test.mjs` | 19/19：实时／控制／既有设置保存及页面、导航、草稿、权限和窄屏回归 |
| 台账／OpenSpec／设计整合／`git diff --check` | 台账结构与基线一致；OpenSpec全量严格校验35/35；技术设计专题与完整主文一致；差异格式检查通过 |

新增功能相关7项最终运行输出：[tests.txt](./development/model-selection/tests.txt)。

HTTP覆盖未保存Key获取、同接入复用、Provider/Endpoint变更拒绝且不上游、非法Endpoint、按Runtime规则过滤去重、Key不回显、发现不落盘、401、无效JSON／结构、超大列表、空列表、重定向拒绝和6秒超时。浏览器通过真实React页面、本机Input API、文件存储和本机HTTP模型服务夹具，验证下拉选择后明确保存、保存后重新打开自动获取、未回显Key、404手动回退，以及接入变化／关闭时迟到结果失效。

初次浏览器夹具沿用需要Bearer的默认身份配置，页面未获认证，3项因找不到入口超时；已将浏览器夹具改为显式本机受信身份。修正后浏览器3/3通过；最终按Runtime模型ID规则调整后，相关7项完整复跑通过。初次构建发现新增JSX事件括号缺失，已修正，最终构建与类型检查通过。

## 视觉复核

已检查实际页面截图：

- [1440px 模型下拉与刷新](./development/model-selection/settings-1440.png)
- [390px 模型下拉与刷新](./development/model-selection/settings-390.png)

模型选择与按钮对齐；390px弹窗保持可操作且无页面横向溢出，当前配置以独立底栏显示。

## 范围

仅使用合成凭据与本机HTTP服务夹具，未读取或调用用户真实模型接入。未重新执行全仓测试或全仓Lint；本次相关范围验证通过，不覆盖此前全仓其他文件的5处既有Lint告警。未进行真实模型能力、企业认证、Linux Runner或G0～G4验收，P0-06保持IN_PROGRESS。
