# P1-07 独立交付导出开发复核

本轮实现已验收 Release 的独立持久导出：原版本 snapshot、实际检查配置/角色提示词/需求计划/用户输入与协作材料索引、受控 Git 原提交、内容引用保留、确定性 ZIP32、原作业 claim/失败/重试/下载。打包与重试不调用验收/开发/迁移/发布。API 仅排队及读状态，显式宿主运行 ReleaseExporter；默认调度/UI 仍待组合。接入和限制见 [EXPORTS.md](../../../packages/result-verifier/EXPORTS.md)。

## 验证结果

| 组 | TAP通过 | 说明 |
| --- | --- | --- |
| export | 8/8 | 最终源码执行 |
| regression | 114/114 | 最终源码执行 |
| acceptance | 157/157 | 复用本轮已执行的未变调用路径，详见下文 |
| workspace | 18/18 | 复用本轮已执行的未变调用路径，详见下文 |

共 297 个 TAP 测试通过、0 跳过；五个改动包构建、类型、Lint、契约检查通过。139 条源码映射逐字节匹配当前源码；迁移1～43 SQL/manifest前缀未变，44追加；Runner代码/迁移未修改。实际文件 SQLite Worker、CAS、Git、外部 tar 读取 ZIP 和本地 HTTP 已执行；源码准入/集成、原OCI/Runner物理事实与人工审查是明确夹具，不等于真实Linux或产品验收。

export/regression/build/type/lint/contracts 的最终记录绑定最终输入。acceptance 的157项及 workspace 的18项复用本轮先前运行：期间独立 contracts 测试修订，之后只在 export capture、专用 redactor 及其独立测试/夹具补充配置和输入索引。这些旧场景不调用 export capture/redactor，也不导入 export 测试/夹具；工厂和其余调用路径字节不变。原编译源码保存于 reused-source，并核实其 hash 匹配原运行输入，binding列明实际变化；不宣称所有组都在完全相同的最终checkout字节上运行。

覆盖确定性清单/逐项hash、原源码/记录截止点、提示词和检查配置正文、私有字段净化、当前成员撤销、GET无副作用、并发/过期claim、注册/准备丢ACK、Worker终止/重开、缺失材料原字节恢复、坏源码拒绝、GC引用、创建事务回滚、路径冲突及43→44 DDL/历史失败完整回滚。

## 失败与修正

原始日志保留：首轮模块从根目录解析express失败，改用input-api依赖入口；第二轮2项失败为重启后夹具仍指向旧Worker、恢复文件未按CAS显式重新登记；首次regression有1项旧OpenAPI路径数断言失败，更新路径/实现标识/显式retry契约后最终整组114项通过。早期控制字符regex触发Lint的console尝试未保存原始日志，不算完整pnpm check通过；已用最终Lint记录验证修正。各轮指纹是实际输入，未把早期失败改为成功，也不声称保留了所有失败版本的完整源码副本。

## 状态及范围

同一Codex Agent执行本地开发复核；没有独立人员或真实用户验收。P1-07正式前置P1-06/G0仍未满足，状态不认领；OpenSpec仍8/13，完整4.3/5.1/5.2不勾选、不归档。默认平台/导出调度/UI、正式后继保留/替换T5、换代源恢复及模型/OIDC/Linux/gVisor真实联调继续。交付包不包含业务数据或平台运行权限，也不是通用回放/导入或任意项目内容秘密扫描器。

原始记录、完整范围和源码绑定见 [evidence.json](./development/release-export/evidence.json)、[final-binding.json](./development/release-export/final-binding.json) 和 [manifest.json](./development/release-export/manifest.json)。
