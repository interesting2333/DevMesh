## Context

P3-03 要求协作统计与配置导出。先实现不依赖外部资源、无密钥的只读投影。

## Goals / Non-Goals

**Goals**
- 项目统计准确、只读。
- 配置导出只包含成员角色与 Registry 绑定，不含凭据／地址。
- 项目不存在时明确拒绝。

**Non-Goals**
- 不做导入、时间序列、图表或 UI。
- 不导出凭据、endpoint 地址、cardHash 或任何秘密。
- 不实现 T16／T17 产品验收。

## Decisions

1. **统计口径**：runs 总数／活动／终态；messages 数；artifacts 数；releases 数；members 数；全部按 project_id。
2. **配置导出**：项目名与成员角色；Registry 仅 generationId／manifestRevision／role 绑定；不含 address／credentialRef／cardHash。
3. **只读**：两个命令不写库、不发事件。
4. **权限**：存储层只校验项目存在；成员权限由 API 层执行。

## Risks / Trade-offs

- 统计为瞬时快照 → 调用方以具体资源读取为准。
- 导出不含地址 → 可能不足以恢复环境，但安全优先；完整恢复由备份流程负责。

## Migration Plan

无迁移；回退删除命令即可。