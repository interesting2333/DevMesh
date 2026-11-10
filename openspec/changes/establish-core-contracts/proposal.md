## Why

父工作包 **P0-02**。P0-01 已完成，后续存储、A2A、Runtime 与 Runner 尚无共享的可执行契约。仅有设计示例不能阻止非法载荷、混用宿主许可或旧版本确认。

依据实施文档 P0-02、D1 §1/3/6/7/10、D2 §4/5.2/9、D3 §1/2/4 与 D4 §2，交付 T08/T12 的契约基础。

## What Changes

- 新建 `@devmesh/contracts`：ID、状态、版本、业务命令／事件、四角色输出及两种执行宿主许可的运行时 schema 和推导类型。
- 提供统一错误、If-Match／内容版本守卫及许可归属／代际／范围／有效期校验。
- 从相同 schema 生成 OpenAPI 3.1 初版，提供正反 JSON 样例、模块接口表及失败测试。
- 扩展现有构建、检查与跨平台验证入口，记录实际证据并更新台账。

## Capabilities

### New Capabilities

- `core-contracts`：共享契约解析、版本／宿主校验及可复现 OpenAPI 生成。

### Modified Capabilities

无。

## Impact

新增 packages/contracts、契约生成脚本和测试；精确固定 Zod 4.4.3 及锁文件。服务继续只提供已有健康路由，OpenAPI 的业务路径显式标记 planned。无业务数据库／文件布局迁移；不把纯解析校验视为真实授权、A2A 接收、Runner 隔离或 T08/T12 全项通过。
