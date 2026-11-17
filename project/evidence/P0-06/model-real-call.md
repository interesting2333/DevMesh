# P0-06 真实模型调用验证（2026-11-17）

- 目标：验证“设置 → Runtime 接入 → 一次真实模型调用”
- 结论：**Runtime 已用保存的模型设置接入，真实模型调用成功**；但完整产品理解链路尚未触发模型，正式 P0-06 仍 `IN_PROGRESS`

## 配置

| 项 | 值 |
| --- | --- |
| Provider | `deepseek` |
| Endpoint | `https://token.yyrd.com/v1`（用户提供的企业访问代理） |
| 模型 | `MiniMax-M2.7`（代理允许列表内） |
| 密钥 | 仅存本机 0600 文件，本文不记录 |

`GET /api/v1/settings/model:test` 返回 HTTP 200。

## Runtime 接入

启动日志出现：

```json
{"event":"model-runtime-attached","providerId":"deepseek","model":"MiniMax-M2.7"}
{"event":"preview-ready","url":"http://127.0.0.1:3210/api/v1/workbench/view"}
```

日志见 [runtime-attach.txt](./runtime-attach.txt)。

## 最小真实模型调用

`scripts/model-smoke.mjs` 使用保存的设置构造 `DeepSeekProvider`（与 Runtime 相同的 Provider 代码路径），发送一条最小对话：

```json
{
  "ok": true,
  "providerId": "deepseek",
  "endpoint": "https://token.yyrd.com/v1",
  "model": "MiniMax-M2.7",
  "content": "\n2+2等于4。",
  "finishReason": "stop",
  "usage": { "inputTokens": 40, "outputTokens": 63, "source": "provider" },
  "requestId": "074af961ccab105302fc7cc1ccff0dde",
  "elapsedMs": 2280
}
```

日志见 [model-real-call.txt](./model-real-call.txt)。未记录密钥。

## 过程中发现的真实限制

1. 代理访问规则不允许 `deepseek-chat`：返回 403 `access_rule_model_forbidden`，允许列表包含 `MiniMax-M2.7`、`MiniMax-M3`、`deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-v4.1-flash`、`glm-5.1/5.2/5.3` 等。
2. `deepseek-v4.1-flash` 可用，但响应模型名为版本化 ID（`deepseek-v4-1-flash-261017`），而 Provider 要求响应模型与配置完全一致，触发 `MODEL_ID_MISMATCH`；因此改用会回显原模型名的 `MiniMax-M2.7`。
3. 推理型模型在小 `max_tokens` 下只返回 reasoning、`content` 为空且 `finish_reason=length`；本次使用 2048 输出预算，`finish_reason=stop`。

## 产品路径现状

创建项目后 Run 进入 `UNDERSTANDING`，但 6 秒内没有产生 requirement／plan，也没有模型进度事件。原因是当前 Runtime 配置没有 `preparation` Agent（内置 manifest 只有 `devmesh.work.*`，没有 `devmesh.prepare.*`），PreparationConsumer 没有可消费端点。因此：

- “设置 → Runtime 接入”与“Provider 真实调用”已验证；
- “工作台输入 → 模型理解 → 计划”还没有接线，不能算跑通产品路径。

## 边界

- 未执行 P0-06 要求的三组真实模型样本与质量/用量评估。
- 未验证工具调用循环、四角色配置与真实长任务。
- 正式 P0-06 仍 `IN_PROGRESS`，G0～G4 不变。