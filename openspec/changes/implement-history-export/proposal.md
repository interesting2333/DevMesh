## Why

父工作包 P3-02 的历史回放与导入导出。当前只能逐页读取，没有截止快照导出，也不会提示资料不完整。G1 未通过，本变更作提前开发增量；正式 P3-02 仍 `NOT_STARTED`。

## What Changes

- `exportProjectHistory`：按截止时间导出项目 Run／消息／工件／Release 的只读摘要，并返回 `complete` 与 `missing` 原因。
- 截止前没有 Run、或存在未终态 Run 时明确标记不完整，不补造数据。
- 不做导入、回放 UI 或 Git／会话正文打包。

## Capabilities

### New Capabilities

- `history-export`: 截止快照导出与不完整提示。

### Modified Capabilities

复用现有表；不新增写入路径。

## Impact

影响 `packages/storage-sqlite`（只读命令）、后续 API 与测试。正式 P3-02、G0～G4 不变。