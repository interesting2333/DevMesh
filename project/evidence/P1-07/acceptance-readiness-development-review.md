# P1-07 接受准备证明与当前观察开发复核

日期：2026-11-13。实施／复核均为同一 Codex Agent，对本地实现与原始材料复核；不是独立人员、人工产品或阶段验收。当前 OpenSpec 仍 7/13，4.1 保持未勾选；正式 P1-07 等待 P1-06／G0。

## 实现及边界

迁移 37 保存不可变原准备证明和只追加观察，原 PREPARED／SENT／UNKNOWN／FAILED 派发事实保持独立。证明固定原 request／候选／reviewHash／数据方案、release／Runner／backend，准确数据身份／存储键／schema／来源／快照／完整性／迁移／journal，源逻辑关门及物理 fence、目标关闭 fence，以及准确 reservation／profile／服务实例和 RELEASE_HELD claim。首次保存后不能替换原数据、fence、claim 或服务。

每次 READY 观察绑定原 fence 当前持有、目标写门关闭、同一 claim／实例／镜像／端点的当前健康与 custodyRevision。年龄只接受 0～30 秒；时间／归属版本不能回退，UNKNOWN 不重置归属高水位。观察 sequence 和核实开始时的 preparationRevision 双 CAS 防止迟到响应；原准备后续 UNKNOWN 用持久版本关闭旧 READY，不以毫秒时间推断提交顺序。重复旧 ACK 只返回当前状态，不能复活旧 READY。证明、观察、Run 资源版本和事件在一个事务中保存或回滚。依据失效显示 STALE。

AcceptancePreparer 只通过显式可信后端组合。缺后端保持未派发；preflight 后只有唯一 dispatch=true 调用 prepare，SENT／UNKNOWN、许可 ACK 丢失或重开后只 inspect 原对象。每个新外部动作前须最后授权，已保存原证明后关闭新的动作授权。没有默认具体外部准备后端、公共 HTTP／MCP 健康回执或 T5 命令。准备 READY 不创建 dataset 行／文件、Release、接受指针或 Run 终态；数据执行属于后续实际适配器。

控制面只核验准确配置主体的声明及原逻辑记录，不能从 JSON 字段本身证明物理 fence／Runner／容器健康。测试后端显式构造这些声明，仅用于协议；不是实际物理隔离、数据迁移或健康验收。INITIAL 是本批正向准备依据；保留／替换的正向用例及源逻辑关门查询分支仍待后续验证，源物理关闭组合也未验收，不据此完成 4.1。

## 实际验证

原命令、环境、原输出、源输入／delta、构建输出和 SHA 见 [retention](./development/acceptance-readiness/retention.json)。各执行的源码差异见 [source-comparisons](./development/acceptance-readiness/source-comparisons.json)。

| 执行 | 实际结果 |
| --- | --- |
| readiness-1 | 37/38，仅端点负例因测试对象别名失败；其余 4 项新准备证明／控制器、5 项原意图、18 项契约、2 项迁移及 8 项实际质量收集通过。 |
| readiness-4 | 5/5，拆开测试健康端点对象后仅重跑受影响的 5 项新准备证明／控制器，失败／取消／跳过 0；未重跑未受影响的原意图／契约／质量组。 |
| readiness-2 | 35/35，存储全量；实际文件 SQLite／Worker、历史升级、事务与锁、备份／重开及迁移故障回滚。 |
| readiness-3 | 33/33，原 Runner 归属／到期／清理回归；真实本地 Worker／文件／计时，容器 Driver 事实为显式夹具。 |
| readiness-build-3 | storage／platform 重建、根类型检查、Lint、契约一致性返回 0；contracts／Runner 在 build-1 实际构建。最终 134/134 项一方 TS 与内嵌源码一致。 |

修正后五项新用例实际使用文件数据库和单写 Worker：原证明跨重开／原 ACK，实际等待 31.05 秒观察过期并按原证明刷新；UNKNOWN 前后 custody 高水位；原准备版本变化关闭旧 READY 并拒绝旧版本观察；主体／hash／数据／claim／fence／未来时间等绑定；证明替换拒绝；准备证明／观察／事件故障完整回滚；迟到 CAS、唯一派发与并发控制器；派发许可 ACK 丢失不执行 prepare；观察提交丢 ACK 后查询原对象恢复。没有新建 Release、dataset 行或完成 Run。

原准备版本用例验证后续 UNKNOWN 关闭旧 READY 和拒绝旧 preparationRevision；没有强制模拟同一毫秒的两个提交。同毫秒顺序由实现中的持久 revision 判断，不把未观测到的时钟条件称为实际测试场景。

迁移测试分别从 v35 和 v36 实际文件开始。旧 v36 测试重试明确截止 v36，避免把后续编号当作旧测试事实；新 v37 故障验证新表和版本标记全部回滚，v36 策略／旧迁移历史原样保留，再按原 SQL 成功重试至 v37。SQL 1～36 未改。

首次 build-1 类型检查失败，根因是接线误删 Results 的 RepoFileResults 继承项及新增 never 守卫没有类型收窄；两份错误源码和原输出保留。build-1 的 storage 产物还早于 fence 当前持有补充，预检 134 项中 2 项映射不一致，原产物／map 保留。修复后 build-2 静态检查返回 0，其产物早于持久 preparationRevision／双 CAS 补充；再以 build-3 重建受影响包并完成最终检查，最终 map 才是当前源码绑定。早期构建不冒充最终版本。

综合组端点负例原本通过 structuredClone 复制共享对象，fixture 的 health.endpoint 与 proof.service.endpoint 仍为同一对象，修改一个端口同时修改两处，未构造出声称的端点不一致。独立诊断确认该别名，修正仅在测试夹具复制健康端点，不改变 Worker 校验。随后实际重跑受影响五项并通过；原完整综合失败及其余未受影响组结果仍按原样保留。四组执行期间各自输入不变，最终 focused 与早期三组唯一输入差异为该测试夹具，不称同指纹全量重跑。

留存后首次 Lint 扫描到了归档 `typecheck-source` 下那份旧失败 TS，因原未使用导入返回 1，原输出保留于 `post-retention`。将两份旧源码按已有 `failed-source` 约定归档，逐文件核对 SHA 未变，未改 Lint 规则或原源码；路径映射和初始清单一并保留。`post-layout-correction` 的 Lint、台账、全部 OpenSpec strict、完整方案一致性及 diff 检查均返回 0。根类型检查输入仅为 apps／packages／tests 源码，归档不属于这些输入。

源码提交为 `7cc116aa5e231466b55ac2c54c1e74883bd29803`。[提交绑定](./development/acceptance-readiness/checkpoint-binding.json)核对 685 项 Git 对象；最终专项 444 个源码输入全部匹配。此只读绑定不新增测试或把较早三组改称同输入重跑。

## 未完成范围

继续实际接受数据准备／原 journal、物理 fence／排空／迁移、准确 Runner 装配、正向保留／替换、T5 原子提交和独立发布／导出。现有 datasets 策略与写门准备外键仍指向 preview 专用记录；实际接受数据／服务须先完成明确的共用归属和 Runner purpose，不能伪造预览策略／effect 来绕过约束，已关闭旧门的安全恢复也须独立核实。企业身份、真实模型、Linux Docker／gVisor、硬配额和产品／门槛验收仍按真实条件保留。当前上游人工／Git／A2A 准入／镜像／容器事实及新后端证明为明确夹具；实际 SQLite／Worker／质量文件与 HTTP 不替代这些事实。没有干净 checkout、全 Foundation 或远程 CI 的执行声明，不归档本变更。
