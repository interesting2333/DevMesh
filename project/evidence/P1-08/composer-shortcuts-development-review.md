# 对话输入快捷键开发复核

2026-11-23，P1-08 / refine-desktop-conversation-ui DU-16，Codex 实施并进行同人开发自查，正式工作包及阶段门槛不变。

新旧 Composer 共用输入处理：Enter 发送、Shift+Enter 换行，兼容 Ctrl／Cmd+Enter。通过实际提交按钮复用所有可用性判断，空输入、发送中、附件异常和只读等状态仍按按钮限制；组字、isComposing、keyCode 229、repeat 不触发发送。提示在输入框聚焦时显示，并通过 aria-describedby 关联。

input-api 构建、类型及相关 Lint 通过，4 个不同的实际 Edge／HTTP／SQLite／IndexedDB 检查通过。覆盖原生多行正文准确持久化、一次发送、空输入零操作、输入法确认、长按、发送中保留正在编辑的下一条、Ctrl／Cmd兼容、新旧入口及既有桌面布局。初次检查因测试未聚焦输入框而错误期待提示可见，修正测试后单项复验通过；其余3项已通过。测试仅使用独立夹具，不在真实用户对话发送消息。

结构化记录见 development/composer-shortcuts/report.json 与 manifest.json；原始输出见本机 .cache/composer-shortcuts-tests.log、composer-enter-ime-test.log。已同步 PRD、D3、D6、验收和实施文档。
