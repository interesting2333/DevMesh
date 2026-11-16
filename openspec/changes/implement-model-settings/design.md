## Context

模型接入原本只由服务器配置决定；工作台需要“更多 → 设置”入口。当前预览为单机本地运行，没有企业密钥托管。

## Goals / Non-Goals

**Goals**
- 工作台可保存 Provider／Endpoint／模型 ID／API Key，并测试连接。
- Key 只落本机 0600 文件；接口不回显；错误信息不含 Key。
- 保存后明确提示重启生效；预览启动器尝试把设置接入 Runtime。

**Non-Goals**
- 不做多用户管理员权限、密钥托管服务或密钥轮换。
- 不在运行中热切换模型；当前 Run 的模型仍由既有配置调整流程处理。
- 不宣称真实模型链路已验收。

## Decisions

1. **本地操作者边界**：设置 API 要求已认证的本机身份，不绑定项目；单机预览视为本地操作者。多租户管理员隔离后续再做。
2. **文件存储**：`<dataRoot>/settings/model.json`（非秘密）与 `model-secret.json`（0600）；目录 0700；原子写。
3. **校验**：Endpoint 必须 https，或 http 且主机为 127.0.0.1／localhost；拒绝凭据、query、hash；模型 ID 限安全字符；Key 长度 1–500。
4. **测试连接**：服务端 GET `${endpoint}/models`，Bearer Key，6 秒超时；只返回状态码与分类，不回显 Key。
5. **UI**：侧边栏底部“更多”→“设置”打开弹窗；保存与测试都有明确状态；未保存前不改变运行时。
6. **生效**：保存后提示重启；预览启动器读取 settings，构造 runtime + A2A 内置 Agent 配置，凭据解析只返回给 Provider；失败回退为无模型并记录，不伪造可用。
7. **文档**：`design/02` 增补模型接入设置与密钥边界，`design/03` 增补设置入口/API，实施文档记录离线实现与边界；三份基线更新。

## Risks / Trade-offs

- 本机文件不是密钥托管 → 依赖文件权限与单机边界，已在文档声明。
- 自动接入 Runtime 依赖 A2A 内置 manifest 与端点可用 → 失败回退并提示，不假报成功。

## Migration Plan

无数据库迁移；设置文件缺失即未配置。