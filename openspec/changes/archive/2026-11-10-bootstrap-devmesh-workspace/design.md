## Context

父工作包 P0-01；目标见 [proposal.md](./proposal.md)。现有设计已确定 Node／TypeScript、pnpm workspace 和 Cordis 受控闭包路线，工程应独立落在本仓库。当前已有项目管理工具、设计脚本和 SQL 约束样例，尚无应用 workspace。

本机观察：Windows、Node v24.13.1、pnpm 11.22.0；实施文档要求的应用 pnpm 为 11.28.5，本机现有版本不能直接作为版本验证通过依据。OpenSpec 1.12.0 的 npm 工具包已隔离在 `tools/openspec`，不属于应用依赖闭包。

依据：[实施文档 §2.1～2.3、§4.1、§7.3](../../../../DevMesh_实施文档_V1.0.md)、[技术设计第 5 章](../../../../DevMesh_技术设计方案_V1.1.md)、[T01](../../../../design/06_验证与验收追踪.md)。

## Goals / Non-Goals

**Goals:**

- 构建一个可独立安装、构建和静态检查的最小应用工程，作为后续真实业务模块的承载基础。
- 在 Windows 和 Linux 对相同提交及锁文件留下可复查的安装、构建与启动证据。
- 将版本、依赖来源、许可证、原生构建要求和已知限制记录成工程交付材料。

**Non-Goals:**

- 不实现 P0-02 的领域／协议完整契约，不用空接口包计入契约完成。
- 不运行样例 SQL 作为正式迁移，不创建生产数据根目录或读取真实凭据。
- 不接真实模型、MCP、A2A 对外服务或 Linux Runner；这些验证属于后续工作包，G0 仍需单独联调。

## Decisions

### 1. 应用 workspace 与管理工具分开

根目录新增应用 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、公共 tsconfig 与检查配置；workspace 包含 `apps/*`、`packages/*`，并显式列入五个受控 vendor 包，不扫描 `tools/openspec`。首批创建真实可启动的 `apps/server` 和承载 Cordis 插件生命周期的最小基础模块；`contracts`、存储、Runtime 等在各自工作包落地，不批量生成空业务模块。

保留 `project/`、`.agents/`、`openspec/`、`design/` 和原型资料。根工程可提供项目管理脚本别名，但底层 `node project/*.mjs` 仍直接可用，避免应用依赖安装失败导致管理记录不可读。

另一个方案是把 OpenSpec 放进应用依赖树；现阶段使用隔离工具包，可以独立升级 CLI 并区分两类锁文件的职责。

### 2. 先验证设计版本，再冻结可重现配置

Node 24 最低 24.9.0，优先验证本机已有 24.13.1 作为候选补丁；pnpm 按设计验证 11.28.5；TypeScript 在 6.0.x 范围内选实际兼容补丁；tsdown／tsx／静态检查工具冻结精确版本。

确认包可获取、Node engines、ESM 与 peer 兼容后，写 packageManager、Node 版本文件、应用锁文件及版本清单；CI 使用同一组精确版本和 frozen-lockfile。若设计版本无法获取或兼容，则保存失败证据，修订技术基线和影响范围后再冻结，不悄悄改为本机 pnpm 11.22.0。

不使用浮动 latest 或跨仓库共享 node_modules；否则难以证明同一提交能够独立构建。版本清单注明验证日期和 OS／arch。

### 3. Cordis 作为受控依赖闭包

参考工程仅用于核对 cordis、cosmokit、include、loader、schemastery 及 peers 的实际来源与使用方式。实施核对发现相同版本的发布包与参考源码存在差异（见 vendor/manifest.json），因此选择以参考仓库 commit `ce7073d51254c26cd63b22a60835b8f948deb447` 的源码及其本地修订为基线，复制完整五包源码／许可证，并在 DevMesh 内重新生成 JS 和声明；不使用发布包的旧构建产物代替该源码。

五包作为显式 vendor workspace 成员，通过 `workspace:*`／`workspace:~` 引用，保留原包命名和接口。DevMesh 仅调整私有标记、构建配置与脚本，记录逐文件 SHA-256 和继承修订日志；第三方运行依赖与原生 optional peer 由应用锁文件固定。源码构建顺序为 cosmokit、schemastery、cordis、loader、include，之后构建应用；不保留指向参考仓库的运行时路径或 workspace 链接。

来源记录区分“仅构建需要的原生工具”和“用户运行时依赖”。无法独立安装的依赖作为本工作包缺项处理；不能复制现成 node_modules 冒充干净安装。

### 4. 最小组合根验证插件生命周期

最小 server 只装配 Cordis 基础生命周期、可校验配置和进程启动／停止，不预设业务数据库。默认监听 loopback；提供便于 CI 验证的健康／就绪检查和正常退出路径，安装失败、配置错误或端口占用返回非零退出码。

配置文件使用示例值，验证组合根无需真实用户凭据；健康检查只代表该最小进程就绪，不能显示 A2A／模型／Runner“已可用”。退出验证核实该进程及其在本工作包实际创建的资源已关闭。

### 5. 构建与验证和真实代码一起落地

提供实际可用的 `pnpm build`、`pnpm typecheck`、`pnpm lint` 与最小进程 smoke 检查。lint 与 TypeScript 的范围覆盖本次真实应用源码；不通过忽略新源码、空成功脚本或 `|| true` 绕过失败。设计样例和管理工具保留原来的独立执行方式。

CI 平台按后续真实 Git 托管接入；仓库先提供 Windows／Linux 可复用的干净安装、构建与 smoke 命令，选择的流水线配置直接调用相同命令。未配置远端时，配置文件存在不等于目标平台已跑过。

已有管理检查纳入提交检查：台账、OpenSpec 严格校验、完整设计一致性。T01 证据记录工作包对应提交、OS／arch、全部精确版本、安装与构建输出和原始报告引用。

## Risks / Trade-offs

- [设计版本与本机工具不一致] → 在应用 workspace 固定并验证版本；管理工具可继续使用，应用验证单独记录。
- [Cordis 闭包有原生 peers 或未发布修改] → 核对来源、分发及许可证，保留安装失败与目标平台构建记录；不承诺永远无需原生构建工具。
- [仅 Windows 本机可运行] → P0-01 保持待验证或阻塞，直到获得 Linux 干净构建证据；不拿 Windows 成功代替 Linux 验证。
- [CI 配置尚无真实托管平台] → 先交付平台无关命令；T01 的跨平台实测与未来流水线运行分别记录，不虚构执行结果。
- [工程初始化误覆盖文档和管理文件] → 逐项审查 Git 差异，保留已提交基线；仅新增和调整本工作包工程配置。

## Migration Plan

本工作包没有业务 schema 或文件布局迁移。使用功能分支完成新增工程文件；先验证本地，再验证 Linux／CI，在证据齐全后进入复核。

回退采用 Git revert 对本工作包工程提交逐项回退，保留已存在的设计资料、项目管理记录和验收证据。安装目录为可重建依赖，不拷贝到受控源码。远端发布、生产配置或服务暴露不属于此次工程初始化。
