# P1-08临时模型输出与中断显示开发复核

2026-11-16：完成3.2临时模型输出与中断显示，变更累计9/13。DeepSeek显式responseMode:sse按实际HTTP协议增量解析，默认JSON及旧配置hash保持；只读content片段独立streamId/index，无领域seq或历史重放，最终响应落盘后才显示已保存及执行工具。WS逐帧复核权限并有界排队；浏览器断线／截断显示中断，保留草稿、页签和焦点，刷新只读取已保存结果。最终协议18、Runtime／Preparation28、契约18、WS13、既有实时浏览器6及新实际平台浏览器3，共86通过，零失败／跳过／取消；构建／类型／Lint／OpenAPI通过。初次类型错误和浏览器旧依据草稿预期错误的准确输入／原日志保留，修复后验证通过。实际本地SSE／官方A2A／平台／文件Worker／Edge不代签真实模型、OIDC、Linux或完整产品验收。按用户指令完成本项后统一提交并暂停，不执行3.3或下一项；正式P1-08、P0-06及G0～G4不变。

显式SSE模式通过真实HTTP读增量UTF-8／SSE，校验准确模型和请求身份、结束原因、DONE、用量、大小／超时和完整工具参数。reasoning及工具参数不向显示端发布，未知／截断不自动重试。Runtime与Preparation均先持久最终响应，响应落盘失败不会标为已保存或执行工具。参考[DeepSeek官方协议](https://api-docs.deepseek.com/api/create-chat-completion/)。

临时帧仅通过受信宿主内部publisher发送；准确项目／Run订阅，逐帧重新授权，共享256KiB发送预算和既有有界唤醒限制。客户端最多4个流、各64KiB文本；缺片段、溢出、断线、补快照均明确中断，不恢复未保存片段、不推进持久cursor。显示以React转义纯文本；最终理解仍由原API／持久事件读取。

新浏览器检查使用实际startPlatform组合、四角色官方A2A端点、Preparation消费者、HTTP SSE、SQLite文件Worker、Edge157原生WS和IndexedDB。模型正文、密钥可用开关与可信身份resolver是明确本地夹具；TCP销毁和缺DONE是故障注入。覆盖首片段时模型步仍SENT、片段不增加eventSeq、持续编辑及焦点／选区保留、最终真实响应存储、实际重连／刷新后读取理解、不自动发业务POST、HTML转义和未知调用不重试。原6项实时浏览器／13项WS及28项Provider／Runtime／Preparation回归通过。

[执行摘要](./development/model-stream/evidence.json)、[原始记录索引](./development/model-stream/manifest.json)、[源码／产物绑定](./development/model-stream/source-binding.json)。原失败记录和failed-source按准确输入保留；成功检查后的非编译输入差异逐项列明。SQL1～45、Runner及依赖未改。本次同一Agent复核不构成独立评审；3.3、4.1～4.3保持未勾选。按用户要求提交后暂停。
