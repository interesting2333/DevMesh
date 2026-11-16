# P1-08 键盘、窄屏与事件连续性验证记录

- 日期：2026-11-16（Asia/Shanghai）
- 变更：`implement-workbench-first-path`（父工作包 P1-08）
- 任务：3.3 完成 IME／重复键保护、Ctrl／Cmd+Enter、页签方向键和窄屏导航／详情；真实 Edge 键盘、390px 布局和事件期间焦点／选择验证并保存截图
- 结论：3.3 的既有实现通过实际 Edge 浏览器验证，页面测试 1/1、实时事件测试 6/6，零失败／跳过／取消；本轮无生产代码改动，仅执行并记录验证
- 边界：身份 resolver、模型、Runner、传输故障均为明确夹具；不代签真实 OIDC、模型、Linux 或产品验收；P1-08 正式状态与 G0～G4 不变

## 环境

| 项目 | 值 |
| --- | --- |
| 操作系统 | Windows（本机） |
| Node | v24.13.1 |
| 浏览器 | Edge 157.0.4341.42，headless，Playwright 1.65.0 |
| 承载 | 受保护 React 入口、CSP、原生 IndexedDB、原生 WebSocket、文件 SQLite Worker、Input API fixture HTTP 宿主 |

## 命令与结果

### 1. 页面键盘与窄屏

```powershell
node --test --test-reporter=spec --test-name-pattern="IME and repeated shortcuts" tests/browser/workbench-page.test.mjs
```

结果：1 个测试通过，0 失败／0 跳过／0 取消（duration 4059 ms）。

实际断言覆盖：

- 普通 Enter 只插入换行，不提交；
- IME `compositionstart` 期间与 `repeat=true` 的 Ctrl+Enter 均不产生 POST；
- 任务／协作／记录页签的 ArrowRight、End、Home 焦点移动正确；
- 视口切换为 390×844 后输入与详情面板可见、切换面板保留正文、`scrollWidth <= innerWidth`；
- 截图保存；随后 Ctrl+Enter 单次提交，POST 数为 1、消息数为 2。

### 2. 事件期间焦点与选择

```powershell
node --test --test-reporter=spec tests/browser/workbench-live.test.mjs
```

结果：6 个测试全部通过，0 失败／0 跳过／0 取消（duration 34 558 ms）。

实际断言覆盖：

- 快照订阅缺口后收到进展，草稿身份与选区（`focus:true,start:1,end:4`）保持不变；
- 真实 TCP 断线触发受保护重快照与重连，页签、草稿、焦点、选区不重置且零额外 POST；
- 乱序／重复的真实服务端帧按持久事件各应用一次，编辑状态不丢失；
- 服务端缓冲溢出的重快照保留编辑；
- 空闲撤权清除受保护 UI 且不提交本地草稿；
- 有界重快照预算耗尽后停止，明确重试可恢复。

## 截图

- 路径：[workbench-390.png](./development/event-continuity/screenshots/workbench-390.png)
- SHA-256：`01787A9DD4D3D7A09F9015CE617124C623718F3E985290522DC4B076F1146D7D`
- 来源：上述页面测试的 390×844 实际 Edge 截图，本轮测试运行时重新生成后复制入证据目录；未做视觉结论以外的能力推断。

## 未执行与后续

- 4.1 全链路回归／构建／类型／Lint／契约：本轮未执行。
- 4.2 设计专题、验收、实施文档、基线、OpenSpec 与 P1-08 台账同步：未执行。
- 4.3 真实模型／OIDC／Linux 下的完整产品路径一与 T08：资源缺失，保持未执行。
- P1-08 在 `project/tasks.json` 中仍为 `NOT_STARTED`，G0～G4 仍为 `PENDING`；本记录只说明 3.3 的验证事实。
