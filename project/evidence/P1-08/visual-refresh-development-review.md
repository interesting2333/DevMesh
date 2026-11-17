# 工作台视觉排版开发复核

2026-11-17：按用户请求完成工作台视觉排版优化5.1。依据PRD三栏／五页签与灰白／深蓝规范，紧凑顶部状态，左224px导航／弹性对话／至少380px详情，统一图标、输入、附件、主按钮、草稿反馈和新建引导；下一目标降为紧凑次级入口。实际Edge157宽屏1440、1024、390px与暗色8张截图无页面横向溢出；相关独立用例36项通过（页面9、详情／附件11、实时／流式13、HTTP3），最终键盘／390px另复验1项，不重复计数。构建、类型、本次input-api范围Lint通过；全仓Lint被既有其他文件5处未使用声明阻断，原日志及HEAD同字节证明保留。首次恢复状态文案误改引发1项失败，已还原原文案，不改测试，实时整组复跑通过；最后仅调整详情导航间距／侧栏脚注，最终截图、HTTP、键盘及实时复验分别留证。业务API、本机日记、权限和执行规则未改；本次不代签完整T08或真实模型／OIDC／Linux验收，不推进工作包或阶段状态。

实现集中于独立workbench-styles.ts和本地SVG图标，继续使用原React／nonce CSP，无外部字体或新依赖。桌面三栏保留准确上下文，窄屏沿用项目／输入／详情区域，所有原附件、恢复及设置入口可达；样式不生成运行状态、统计或示例业务数据。

[宽屏](./development/visual-refresh/desktop-workspace.png) · [新建](./development/visual-refresh/desktop-empty.png) · [390px输入](./development/visual-refresh/mobile-input.png) · [暗色](./development/visual-refresh/desktop-dark.png) · [执行记录](./development/visual-refresh/evidence.json)。

首次实时回归12通过／1失败来自UI误改原“执行已恢复”文案；准确输入及原失败日志保留于failed-source/live-status-label，还原原语义后完整13项通过。首轮页面9／附件与计划11在文案还原及纯CSS间距微调之前执行，最终HTTP3、键盘1、实时13及8张截图在最终应用字节上执行；evidence.json逐次列出源码差异与当前产物映射，不将前轮输入说成完全未改。

全仓Lint发现storage-sqlite/domain.ts三个未用类型、release-manifest.test.mjs未用导入、run-control-coordinator.test.mjs未用参数；三文件与本轮HEAD逐字相同，本次未修改。本次input-api/src的Lint独立通过；不把全仓Lint记为通过。未执行外部模型／企业认证／Linux Runner或完整产品验收，正式工作包及门槛不变。
