# P0-06 本机模型接入设置（2026-11-16）

- 变更：`implement-model-settings`（父工作包 P0-06）
- 结论：工作台“更多 → 设置”可保存模型接入并测试连接；密钥只落本机 0600 文件、不回显。正式 P0-06 仍 `IN_PROGRESS`。

## 实现

| 项 | 内容 |
| --- | --- |
| 存储 | `<dataRoot>/settings/model.json`（Provider／Endpoint／模型／更新时间）与 `model-secret.json`（0600） |
| API | `GET /api/v1/settings/model`、`PUT /api/v1/settings/model`、`POST /api/v1/settings/model:test` |
| 校验 | Endpoint 必须 https，仅 loopback 允许 http；拒绝 URL 凭据／query／hash；Provider／模型 ID 限安全字符 |
| 密钥 | 首次保存必须提供；后续留空保持；响应只有 `hasApiKey`；错误与日志不含密钥 |
| 测试连接 | 服务端 `GET {endpoint}/models`，Bearer Key，6 秒超时，只返回状态分类 |
| UI | 侧边栏底部“更多”→“设置”弹窗；保存、测试连接、重启提示 |
| 启动接入 | 预览启动器读取设置，构造 Runtime + 内置 Agent manifest；Key 仅交给凭据解析；失败回退无模型并记录 |

## 测试

```powershell
node --test --test-reporter=spec tests/model-settings-http.test.mjs
node --test --test-reporter=spec --test-name-pattern="more menu opens model settings" tests/browser/workbench-live.test.mjs
```

结果：HTTP 2/2、浏览器 1/1；日志见 [model-settings-http.txt](./model-settings-http.txt) 与 [model-settings-browser.txt](./model-settings-browser.txt)。

覆盖：未配置初始态、非 loopback http 拒绝、密钥不回声、留空保留、真实 stub Provider 连接成功、未配置测试拒绝、弹窗保存后显示已配置。

## 边界

- 这是单机本地操作者设置，不是企业密钥托管；多用户管理员隔离与轮换未实现。
- 保存后需重启；自动接入 Runtime 依赖内置 A2A manifest 与 Provider 可用性，失败回退不伪造可用。
- 未用真实 DeepSeek Key 执行模型调用；真实模型样本与 G0 联调仍未完成。
- 正式 P0-06／G0～G4 状态不变。