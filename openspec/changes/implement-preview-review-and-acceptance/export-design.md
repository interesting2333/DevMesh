# Accepted Release 独立导出

父工作包 P1-07，延续 tasks 4.3；不改变 T5、发布 outbox 或任何物理部署操作。完整运行回放及导入仍属 P3。本增量实现已验收 Release 的交付包，不把它称为可直接恢复平台运行的备份。

## 固定材料与权限

POST `/api/v1/releases/:releaseId/exports` 的幂等键在同一控制 writer 事务内登记 job、原候选/提交/验收回执、当前记录截止 seq、实际 requirement/plan、实际 attempt role snapshots、截至该时点的事件/会话消息及已登记工具/A2A 操作摘要。原候选交付物、质量材料、work evidence/output、会话公开消息的内容引用独立持久保存并通过外键阻止 GC；源码绑定原候选集成 manifest、受控 bare 仓库身份和原 commit，不读当前工作目录或 HEAD。读取消息不包含模型 request/response、推理字段或运行权限。平台元数据递归去除凭据、权限/票据字段；原项目源码/构建/镜像作为用户交付内容保留准确字节，并在 manifest 明示这不是任意项目内容的秘密扫描器。业务数据不进入包。

创建/查询/下载每次验证当前项目成员；打包、内容写入和材料读取还要求原创建者及当前 claim。公共 job 视图不暴露仓库物理路径、snapshot 或原运行权限。内部 pack context 不能作为新的执行授权。公开 GET 不调度、重试或改变验收。

## 作业与恢复

状态 QUEUED→PACKING→READY/FAILED；claim 最长两分钟，generation/token 用于拒绝过期打包者，显式 retry 仅接受失败或超时作业并保持原 snapshot、cutoff 和材料。纯打包可重做，绝不执行开发、构建、迁移、部署或发布。首次准备 archive hash/size/manifest 后这些字段不可改变，重试仍发布相同内容。内容写入引用提交与 READY 同事务；丢 ACK 查询原 job / 原写记录。失败仅改变 export job。缺失/坏 hash/越界材料明确 FAILED，不生成宣称完整的空包。

ZIP 使用无压缩 ZIP32、固定时间和 UTF-8 文件名，逐项 CRC32；拒绝绝对/父级/Windows 设备名/大小写及 Unicode 规范化冲突，最多 20,000 项、单项 64 MiB、总包 200 MiB。文件在内存中有总量上限，不解压不执行。manifest 列出 scope、精确版本、cutoff、count、每项 byteSize/hash、原始 hash 与处理方式及有意排除项。源码 executable mode 保留，拒绝软链接和子模块；完整性表示本交付 scope 完整，不代表平台回放或物理部署验收。

显式 ReleaseExporter 可由可信宿主运行排队任务；输入 API 仅提供排队/查询/显式 retry/下载，默认不自动装配外部身份或物理后端。下载只读 READY 内容，每次重新鉴权，校验 hash/size，以 attachment/nosniff/sandbox 返回，Range 明确拒绝。

## 宿主持久队列消费

平台以显式 `releaseExports.enabled: true` 启用本地消费者，必须有持久 storage；默认关闭，不依赖模型、A2A Runtime、企业身份或 Runner。可信宿主使用私有 Worker 分页扫描 QUEUED 和租约已过期的 PACKING，返回最小原创建者/作业/代际，不开放公共 HTTP 扫描；只列当前仍在项目内的原创建者。作业执行时原权限及 claim 仍逐次复核。活跃 PACKING、READY、普通 FAILED 不自动重跑；失败须创建者显式 retry，成员撤销不提升为服务主体权限。

消费者一轮有最大作业数、最多两个并发和轮询间隔；同一实例不重叠轮次，跨实例继续依靠 DB claim。崩溃遗留 PACKING 仅在原两分钟租约过期后用 expectedGeneration CAS 重新排队，纯打包使用原 snapshot；不重新接受或执行迁移。默认源读取器固定控制面根目录下原 bare Git。停止先关闭 API 准入，再取消并等待当前打包退出，最后关闭 SQLite；正在打包任务接收停止信号，已提交 READY 保留。单作业有90秒协作取消期限，底层调用未返回不提前释放实例并发或伪称已停止；硬进程退出留下的原租约由后续启动恢复。

## 验证

真实 SQLite Worker、CAS 文件、受控 Git、ZIP 解包与 HTTP 检查：固定历史版本、幂等与当前成员撤销、并发 claim、超时与 stale worker、写 ACK 丢失/进程重开、缺失损坏材料、路径/大小上限、迁移回滚及原验收/发布/业务库不变。通过这些不代表 OIDC、Linux/gVisor 或完整 P1-07 验收。

## React 交付入口

已接受版本页链接到 `/api/v1/releases/:releaseId/exports/view`。此入口采用与模板一致的 React/ReactDOM 18.3.1 和类型版本，以现有 tsdown 单独打包浏览器资产，不替换主工作台的 Vite 方案。资产经同一可信身份和当前成员鉴权，不从 CDN 加载；页面使用 nonce CSP、固定同源地址、无任意路径，初始数据转义嵌入。历史已接受版本也可导出；页面展示准确源码 SHA、接受时间、任务状态和可下载文件大小／hash。它不要求已发布应用网关健康。

GET 页面、资产与轮询只读取。创建必须用户点击，先在当前 tab 的 sessionStorage 持久保存原 release 的幂等键；丢响应或刷新后，用户明确核实原请求仍使用同一键，不自动新建或隐式 POST。浏览器不能保存该键时阻止新建并给出说明。失败和过期任务的 retry 能力由服务端根据原创建者、当前成员、状态和租约计算，发送准确 expectedGeneration；失去权限或状态变化仍由 writer 拒绝。READY 显示原 download 链接，每次实际下载重新鉴权。

列表按原 API 游标翻页，一页20项，活跃任务有界轮询，标签页隐藏或卸载停止轮询；请求不重叠、超时或撤权后关闭可操作内容并显示明确状态。创建成功的任务单独置顶并读原任务，避免随机ID排序使它落在当前页之外。未知创建只保留原键，不把请求超时视为未提交。错误展示固定用户说明，不渲染后台错误文本或用 innerHTML。实际浏览器验证创建／ACK丢失后刷新恢复／重试／下载／撤权、翻页和XSS；上游 T5／物理事实的夹具范围继续单列。
