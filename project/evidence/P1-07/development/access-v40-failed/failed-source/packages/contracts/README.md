# DevMesh 核心契约

P0-02 实际产物：`@devmesh/contracts`，TypeScript + Zod 4.4.3，精确依赖见包清单与根锁文件。无 Node 内置模块或文件／网络副作用，可供后续控制面与工作台复用。

依据 [D1](../../design/01_领域模型与状态机.md)、[D2](../../design/02_Agent与协议详细设计.md)、[D3](../../design/03_API与用户流程.md)、[D4](../../design/04_执行恢复与交付.md)。结构 schema、事实比较守卫已实现；数据库、业务 handler、协议网络与 Runner 在后续工作包实现。

## 使用与维护

在调用方 package.json 声明 `"@devmesh/contracts": "workspace:*"`。库构建输出为 ESM `dist/index.js` 和 `dist/index.d.ts`：

```typescript
import { commandBodies, parseContract, assertResourceVersion } from '@devmesh/contracts';

const body = parseContract(commandBodies.ConfirmPlan, incomingJson);
// 先完成认证、ACL 和原操作去重，再为新操作执行版本守卫。
assertResourceVersion(ifMatch, currentResourceRevision);
// 后续服务在同一事务内重新核对当前业务依据及 CAS，并保存结果／事件。
```

根目录命令：

```powershell
corepack pnpm@11.28.5 build
corepack pnpm@11.28.5 contracts:generate
corepack pnpm@11.28.5 contracts:check
corepack pnpm@11.28.5 test:contracts
```

修改 schema 后先 build，再 generate；提交 [openapi.json](./openapi.json) 和样例。生成一致性与所有本地 `$ref` 解析均在检查中，递归 JSON 的 `$defs` 已定位到对应组件。新增不兼容字段使用新 schemaVersion，不改变 v1 的含义。

## 已提供的契约

| 入口 | 作用 |
| --- | --- |
| `ids`、revision／epoch／hash／timestamp | 本地 ID 分命名空间并推导名义类型；版本为安全整数；Git commit 为完整 SHA-1 40 位，内容哈希为 SHA-256 64 位 |
| `runState`、attempt／invocation／operation／job／A2A 状态 | 各自独立的状态集合；不把协议 completed、业务成功与接受合并 |
| `commandBodies`、`command` | 13 类首批命令；REST body 与服务内含版本、动作键和目标的 envelope 分开 |
| `domainEvent`、`ephemeralTokenDelta` | 18 类工作流持久事件，带当时版本和连续 seq；临时 token 无持久 seq |
| `roleOutput`、四类具体 Output | 产品有来源的需求；架构声明式计划；开发 commit／文件／交接建议；测试精确 SHA 报告与缺陷 |
| `workRevision`、`planDraft` | 受限 completionChecks 和输出槽位，最多 30 个工作；不接受 JS 判定器 |
| `workDelegation`、`invocationDelegation` | `devmesh.work.v1` 与 `devmesh.invocation.v1` 分开归属，不共享外键 |
| `inputManifest` | 不可变输入清单的字段结构；规范化排序、哈希和持久化由后续服务实现 |
| `executionOwner`、`executionPermit`、`assertPermit` | 区分两类宿主；比较当前身份、代际、activation、grant、期限和资源范围 |
| `assertResourceVersion`、`assertContentBasis` | 428 缺条件、412 资源版本冲突、409 内容依据失效 |
| `parseContract`、`ContractError.toEnvelope` | 422 结构错误，包含字段路径；统一错误 envelope 不回显整个输入 |

业务错误代码是第一批集合，未来功能随其工作包增加。`parseContract` 不做类型转换、不静默删除未知字段。输入正文、项目名与标题分别按 Unicode code point 限制 20000／80／120；不把 emoji 的两个 UTF-16 单元算成两个字符。

## 模块接口与责任

下表是后续模块的对接入口；除本包已有纯函数外，服务方法仍按相应工作包实现。

| 调用／实现模块 | 使用的契约与返回 | 必须由该模块保证 | 工作包 |
| --- | --- | --- | --- |
| API／CommandService | `commandBodies` → `OperationReceipt` 或 `ErrorEnvelope` | 认证、ACL、CSRF、256 KiB 上限；按主体＋scope＋原键去重；同键异参数 409；去重先于新请求版本检查；事务内 CAS | P1-01 |
| StorageService | 本地 ID、状态、版本、`DomainEvent` | SQLite Worker、正式迁移、外键、唯一性、终态不复活；业务事实、事件与 Outbox 同事务 | P0-03 |
| PlanService／Scheduler | `ProductOutput`／`ArchitectOutput`、`WorkRevision`、`PlanDraft` → 准入工作 | 来源可查、引用存在、需求覆盖、无环、冲突／并发／预算、计划已确认；冻结 inputManifest、许可和派发作业 | P1-02／03 |
| A2A Adapter／Delegation | `WorkDelegation` 或 `InvocationDelegation` → 独立协议 Task | 官方 SDK；主体校验、已提交注册表版本、Task/Inbox/AcceptedWork 原子持久化；同键同哈希返回原 Task | P0-05／P3-05 |
| AgentRuntime／ResultVerifier | `RoleOutput`、inputManifest、原始报告引用 | 模型输出先落库再产生工具副作用；结构解析后另查 Git／报告／输入适用性，不能仅因测试输出可解析就放行 | P0-06／P1-06 |
| ToolExecutor／Runner | `ExecutionPermit` 与稳定 operationId → 原 job／真实停止证据 | 认证服务、查询已提交 grant／当前宿主事实后调用 `assertPermit`；事务或租约防竞态；不信任外部提交的 authority；未知写操作查原事实 | P0-07／08 |
| EventService／工作台 | `DomainEvent`、快照 cursor → 有序投影 | 持久 seq；先注册缓冲再补历史；按 seq 去重／补缺口；切换上下文重新鉴权；历史模式无命令客户端 | P1-01／08 |
| DeliveryService | `TesterOutput`、候选版本／reviewHash／dataPlanHash → 接受作业 | 真实覆盖数量、必要检查零失败／跳过／缺失、SHA 一致、数据准备、用户接受；下载和 A2A completed 都不能代替接受 | P1-06／07 |
| InvocationService | invocation 专属 ID、状态、委托及 permit | 独立表组与 TaskStore；不改项目接受指针；资源仅为固定快照和专属工作区 | P3-05 |

## 许可校验边界

`assertPermit(input, authority, requestedResource, nowMs)` 的 `authority` 必须由认证后的服务读取已提交 grant 与宿主事实构造。不能复制 input 作为 authority；测试中的同值对象只是可复现的受控夹具。许可不是对外 bearer token，也不承担服务认证或数字签名验证。

workflow 包含 runId/runEpoch、workId/workEpoch、attemptId；invocation 包含 invocationId/invocationEpoch、invocationAttemptId。两者都有 grantId、activationId、notBefore、expiresAt 和资源范围。ID、代际、尝试、activation 或 grant 任一不同均拒绝；有效区间为 `[notBefore, expiresAt)`，且调用方不能延长当前授权期限。读权限不能升级为写，调用方不能注入另一个资源；Invocation 不能声明项目仓库／业务 dataset 权限或写输入快照。

本包不检查实时作业停止或撤销后的在途结果，不能作为撤销瞬间无副作用的证据；Runner 仍需登记和租约核实。撤销许可后历史日志与退出资料的保存走单独入口，不调用新副作用许可来拦截归档。

## OpenAPI 范围与样例

[OpenAPI 初版](./openapi.json) 记录首批 13 个命令的路径、body、路径／条件／幂等头、成功与错误响应及浏览器认证边界，**每个业务操作都标记 `x-implementation-status: planned`**。当前服务器实际仍仅提供基础健康接口。D3 的附件、完整 operation 查询／lookup、workspace 快照、冲突、人工检查、下载／回放、配置、维护和公共 A2A API 随后续工作包补齐；A2A 标准请求不套 REST envelope。

运行时的跨字段／当前事实限制见 OpenAPI 的 `x-runtime-constraints`。JSON Schema 不能替代这些守卫和服务事务；例如纯 schema 无法知道当前 runEpoch 或报告是否真实存在。DAG 的引用存在／无环与终态转换保护也由对应服务实现，不在这里伪造数据库行为。

[正样例](./examples/valid.json) 含所有 13 种 body、两种 permit、命令、事件、四种输出及两种内部委托；[反样例](./examples/invalid.json) 含未来版本、类型错误、未知字段、宿主混用、越界资源／路径及不同 SHA。正样例中特意包含测试失败和缺陷：结构合法的失败报告必须能保存，它不会产生业务成功结论。
