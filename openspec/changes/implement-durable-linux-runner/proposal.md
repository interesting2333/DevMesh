## Why

父工作包 P0-07。控制面已经具备持久 A2A 受理和可选 Runtime；生成代码需要独立的 Linux 执行宿主，不能在控制进程调用 Shell。用户明确 Docker/gVisor 暂无，授权继续不依赖这些资源的代码与验证；本变更的真实隔离和停止验收保留待执行，不据此跳过 P0-06 或 G0。

## What Changes

- 增加独立 Runner 管理服务、客户端、严格作业 schema 与命令／镜像／工作区策略。
- 增加独立本地持久登记、原 operation 查询、容量准入、租约代际和启动恢复。
- 增加只使用 Docker + runsc 的 Provider，TERM/KILL 后查询真实容器事实，保留未知状态与归档材料；未配置时拒绝执行。
- 用真实本地 HTTP、SQLite 和进程切点验证协议与恢复；另列 Linux Docker/gVisor 实际执行专项，缺资源保持未执行。

## Capabilities

### New Capabilities

- `durable-linux-runner`: 独立的受控作业管理、幂等查询、租约停止、隔离参数和证据。

### Modified Capabilities

无。控制面同名 Runner 表不迁移为 Runner 节点的本地权威。

## Impact

新增 Runner 包、启动入口、部署配置与镜像说明、测试、项目证据。控制与 Runner 数据根和身份分开，Docker socket 只属于 Runner 管理服务。当前不提供在控制主机执行生成代码的替代路径；实际镜像 digest 和 runtime 兼容性须部署验收后登记。
