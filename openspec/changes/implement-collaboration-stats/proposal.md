## Why

父工作包 P3-03 的协作统计与配置导出。当前只能逐表查询，没有项目级统计，也没有不含密钥的配置导出。G1 未通过，本变更作为提前开发增量；正式 P3-03 仍 `NOT_STARTED`。

## What Changes

- `getProjectStats`：只读返回项目成员数、Run 总数／活动／终态、消息数、工件数、Release 数。
- `getProjectConfigExport`：返回项目名、成员角色、当前 Registry generation／manifest revision 与角色绑定；**不包含凭据、地址或密钥**。
- 不做导入；真实统计口径与产品展示留给后续任务。

## Capabilities

### New Capabilities

- `collaboration-stats`: 项目级只读统计与安全配置导出。

### Modified Capabilities

复用现有表与 Registry 投影；不新增写入路径。

## Impact

影响 `packages/storage-sqlite`（只读命令）、后续 API 与测试。正式 P3-03、G0～G4 不变。
