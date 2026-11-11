## Why

父工作包 P1-05（关联 P1-03、P1-04、P0-09）。当前已有固定模板 Git 起点、repo MCP 原操作与候选 CAS，但工作区目录／独占租约仍由部署者注入，缺少受控项目仓库、开发结果接收、分叉合并、冲突归档和回收 ACK。不能据临时 checkout 中存在 commit 就宣布源码已保存。

## What Changes

- 增加受控 Git Provider 和 Worker 持久工作区／集成／源码归档记录，绑定项目、Run、Attempt 与精确起点 SHA。
- 控制面项目仓库和 Runner checkout 使用不同可写目录，通过显式本地 Git 传输适配器验证传入对象与受控保留 ref；为跨节点授权传输保留接口。
- 增加独占工作区／项目资源准入，Runner 作业仍活动或结果未知时拒绝写操作及回收；与 repo MCP 的受信任租约接口组合。
- 校验开发结果的原宿主、base、父链及 Work 写范围后串行生成候选集成 commit；保留精确 base／ours／theirs 和冲突文件材料，不自动覆盖冲突。
- 固定候选 SHA 创建只读验证起点；提交已入受控仓库并被保留、归档清单已获持久 ACK 后才允许回收工作区。候选集成不更新接受指针。
- 原操作恢复先查对象、ref、材料和 ACK；网络或数据库响应未知时保留原 checkout 与操作记录。

## Capabilities

### New Capabilities

- `managed-code-workspaces`: 精确起点工作区、受控代码接收、串行候选集成、冲突材料、源码保留与回收确认。

### Modified Capabilities

无；不提前改写尚未完成的质量验证、候选接受或跨节点运行能力。

## Impact

依据 D4 §3、D5 §7.2～7.3、实施 P1-05 与 T05/T23。预计涉及新的 Git Provider 包、storage-sqlite 向前迁移、repo MCP／Runner 工作区边界、真实临时 Git 仓库测试及台账。保持 Node／TS、固定 A2A／MCP SDK，不改参考工程。真实 Linux Runner、远程 Git 身份与完整产品质量验收仍需目标环境；本地真实 Git 证据单独记录。正式前置及 G0 未通过时父工作包保持 NOT_STARTED，本变更按连续授权推进独立代码。
