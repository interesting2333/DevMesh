## Context

P0-02，前置 P0-01 已 DONE。依据 D1 §1/3/6/7/10、D2 §4/5.2/9、D3 §1/2/4、D4 §2；数据层由 P0-03 实现，本变更交付可导入的纯契约。

## Goals / Non-Goals

契约需在 TypeScript、未知 JSON 输入和 OpenAPI 中共用来源，明确版本及错误语义。执行校验从已认证、服务端读取的事实获得 expected owner 与当前 epoch，客户端输入不构成授权。数据库事务、签名／grant 查询、网络服务与完整调度器在其后续工作包实现。

## Decisions

1. 选用已验证可获取的 MIT Zod 4.4.3；strictObject 拒绝未知字段，不做隐式类型转换。使用内置 JSON Schema 导出生成 OpenAPI 3.1.0，生成器不吞掉无法表达的类型；跨字段约束另有运行时测试和文档说明。继续使用现有 Node test runner，避免为纯契约另建测试框架。
2. ID 采用与设计例子一致的命名空间前缀和不透明后缀；外部 A2A Task ID 另为不透明字符串，不转为本地业务 ID。版本、epoch 和序列限安全整数；公开 schemaVersion 用固定字面量，变更不兼容字段须新版本。
3. permit 按 ownerKind 严格判别联合；workflow 与 invocation 字段、宿主 ID、epoch、activation、grant、期限及资源权限必须与受信任事实匹配。Invocation 资源仅允许快照与专属工作区。此处提供结构和事实比较，不发行／认证 token，未来服务仍须服务认证、ACL 和已提交 grant 校验。
4. If-Match 缺失／旧版分别 428／412，内容依据已失效 409；仅接受强 ETag `"rN"`。服务必须先认证授权并查原操作去重，命中时返回原结果，然后才调用新操作版本守卫；不能先校验当前版本破坏幂等重发。
5. 命令 body 与内部 envelope 分开：HTTP body 不需要重复 URL 里的 ID；OpenAPI 路径、参数、状态与 body schema 从路由目录及共享 schema 生成。所有业务路径 planned，不为它们挂成功占位路由；A2A 标准协议层不套业务 REST envelope。
6. 四角色输出、WorkRevision 和 planDraft 均为受限数据；完成检查没有可执行 JS。事件 type 决定 payload，持久事件与临时 token 消息不同。结构通过不代表 DAG 语义校验、事实验证、人工接受或可执行许可。

## Risks / Trade-offs

- [JSON Schema 无法描述所有事实关系] → 输出文档列出运行时限制，测试旧依据、跨宿主、代际及期限，未来事务内重复核验。
- [初版被当成所有 API 已实现] → OpenAPI 文档及每个业务操作标记 planned，模块表对应后续工作包；本轮限定首批核心命令及事件，后续按能力增量扩展。
- [Zod 版本与在线文档变动] → 精确冻结版本，用本地包实测 API、Unicode 和生成行为，不依赖浮动 latest。

## Migration Plan

无生产数据迁移。安装新锁文件，构建 contracts 后导出 OpenAPI；检查生成结果未漂移。回退本次源码、依赖及锁文件即可，已有健康服务不依赖新增业务路径。Windows／Linux 使用同一代码提交构建和执行基础回归与契约反例；原 P0-01 证据保留。
