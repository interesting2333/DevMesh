# DevMesh Cordis 受控源码

这五个包完整继承参考工程 `deepseek-ai/deepseek-harness` commit `ce7073d51254c26cd63b22a60835b8f948deb447` 的源码和 MIT 许可证。源代码在本仓库内构建；应用不引用参考目录的源码、node_modules 或构建产物。

| 目录 | 包名 | 基线版本 |
| --- | --- | --- |
| cordis | @deepseek-ai/cordis | 4.0.6-alpha.1 |
| cosmokit | @deepseek-ai/cosmokit | 1.8.7-alpha.1 |
| include | @deepseek-ai/cordis-plugin-include | 1.0.11-alpha.1 |
| loader | @deepseek-ai/cordis-plugin-loader | 1.0.7-alpha.1 |
| schemastery | @deepseek-ai/schemastery | 3.18.6-alpha.1 |

上游仓库、各包来源 commit、继承的修订和原生依赖说明见 [继承修订日志](./upstream-modifications.md)。[manifest.json](./manifest.json) 保存参考 commit、发布包校验值、发布源码与参考源码的比较、DevMesh 的配置调整和逐文件 SHA-256；发布制品只用于来源比较，没有直接作为运行时实现。

初始核对发现相同版本的发布包与参考源码有差异：cordis 的 9 个已发布 TS 源文件中 6 个不同，include 的 1 个不同，loader 的 9 个中 4 个不同。cosmokit 和 schemastery 对比一致。由于这些差异包含参考工程维护的框架行为，选择复制参考源码并重新构建，不把同名版本视为相同实现。

## 本地调整与构建

- `src/` 和许可证保持参考源码，继承其生命周期与配置修订；未为 DevMesh 再修改框架行为。
- 各包设为 private，移除 publishConfig；tsconfig 改为继承仓库独立配置，保留依赖项目引用和上游的类型严格度设置。
- pnpm workspace 显式纳入这五个包，包间沿用 workspace 引用。HTTP 宿主根清单提供完整 peer 集合；cordis/include 的 peer 循环是原始元数据关系，构建按实际源码依赖顺序执行。
- `pnpm build:vendor` 先通过 TypeScript 编译及类型检查，再用 tsdown 构建 ESM；schemastery 按原导出契约同时构建 CJS。输出在各包 `lib/`，由本机重建，不提交 Git。
- `pnpm vendor:verify` 检查源文件集合、许可证和字节哈希。生成的 lib、node_modules 与 tsbuildinfo 不作为源码校验输入。

第三方依赖 `@standard-schema/spec@1.1.0`、`js-yaml@4.1.1` 和 `node-addon-require-builtin@0.1.9` 的传递闭包由应用锁文件固定。Loader 的原生 optional peer 及其 custom-loader 依赖使用 npm 分发的目标平台预构建包；Windows x64、Linux x64 glibc 的实际加载随 P0-01 记录验证。没有在本工作包开发机编译这些原生模块，源码重建仍可能需要 C++／Python 工具链；不据此承诺其他 OS／arch 或 Electron 可用。

## 后续升级

升级需选定明确来源 commit，复制变更源码和许可证、检查继承修订、更新配置及 manifest，并重新执行两个平台的干净构建和 smoke。修改源码后不能只刷新哈希而跳过影响分析。应用精确版本与实际验证见 [工程说明](../docs/engineering.md)。
