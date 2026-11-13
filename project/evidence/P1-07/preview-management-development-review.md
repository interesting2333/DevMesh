# P1-07 准确候选预览管理API开发复核

2026-11-13：2.3／5.1准确候选预览管理API：可信previewPolicies启动快照选择原策略，新dataset／start默认关闭，已有历史与原键恢复保留。单writer成员投影含固定候选／数据方案、Run版本／owner能力和各1～20项独立数据／预览游标，不含路径／Runner／实例／proof。owner分别记录数据准备／启动与STOP_PREVIEW停止；UUID／Run If-Match、原预览版本／impact hash、仅USER及Release归属保护。GET不派发／刷新健康／接受。consumer 5通过，lifecycle 22通过／1次初跑失败（原样定向复跑解决）／1跳过，domain 44通过，acceptanceRetry 1通过，共72通过、1跳过；完整构建／类型／Lint／契约及370映射通过，旧SQL1～44／Runner源码和格式／依赖未改，最终输入无漂移。首轮类型检查5条诊断涉及Map推断的project品牌、默认scope推断为Run品牌、managementContext的Run品牌和optional undefined；原输出与两份源码字节／SHA保留在initial-type-failure。首轮domain契约覆盖仍断言旧50条路径（新文档56），旧implemented列表未列新6个operation；原测试字节／SHA和原因保留在contract-coverage-failure。补覆盖清单及创建需Run If-Match／停止用原preview CAS的声明验证，不因此改产品代码／OpenAPI。全部组结束后修正，最终重新完整构建并以相同全部输入重跑，不复用旧组结果。完整重跑的并行lifecycle组既有接受用例返回409而非注入丢ACK的503；独立只诊断计时复现READY依据从请求前19.346秒至结束31.735秒过期，Release为0，详细时间／响应保存readiness-timing，不计入通过数。未修改产品或测试、未放宽30秒规则；各组及诊断结束后以相同全部输入单独定向复跑原接受用例，通过记录另列，原失败保留。实际HTTP／控制Worker／业务SQLite与三种丢ACK重开；容器／OCI和上游事实、旧Release归属为明确夹具。React管理页、正向后继保留替换和干净checkout／真实身份／Linux继续；正式P1-07／OpenSpec8/13／门槛不变。

## 实施

准确Run／candidate下的preview-management提供成员workspace及dataset／preview详情、owner datasets／previews／原preview stop。可信previewPolicies在mount时固定原项目策略选择，新数据／启动默认关闭；后台消费与网关独立，配置选择不等于实际后端健康。

GET在一个同步writer调用中读取准确候选／固定数据方案、Run版本、角色／资格／未决effect能力与各1～20项独立游标（默认10）。终态历史保留；公开schema排除本地storageKey、后端／Runner／实例／端点、内部request／proof。HTTP发送前再查当前成员，GET不派发、刷新健康或接受。

创建数据保持候选原INITIAL或隔离源方案，不在此选择替换；创建启动固定原READY dataset、原镜像和60秒～24小时首次TTL。沿用原UUID／Run If-Match，旧请求同body/key/If-Match可在配置关闭、Worker重开后恢复。停止用独立STOP_PREVIEW、原preview scope／revision／impactReviewHash及固定USER；保护dataset和Release归属。历史读和停止不依赖仍开启新选择。React管理页下一增量继续，不把API视作完整工作台。

## 实际验证

- Actual HTTP defaults new dataset/start intents off, keeps current-member reads, distinguishes viewer/owner and current selected policy, pins policy map against later caller mutation and rejects absent Input API at host composition.
- Actual file-backed control Worker plus HTTP records dataset/start/stop owner intents. Each injected committed ACK loss survives Worker reopen and new-policy selection removal with the original body/key/If-Match, producing one original identity.
- Actual local application SQLite preparation and a business write compose with independently advanced controlled preview start/stop. Original stop preserves database bytes and creates no accepted Release or project pointer.
- Strict body/query schemas, Idempotency-Key, If-Match, Origin, original-body conflicts, unavailable unprepared dataset and foreign resource/candidate paths reject without extra resources.
- Three actual prepared datasets paginate one item at a time through stable original cursors; GET never starts previews. The response omits paths, backend/Runner/instance/endpoint and internal request/proof. A membership removal after the writer snapshot is caught before protected HTTP response.
- Malformed stop confirmation or stale impact hash cannot create a stop decision. An explicitly inserted legacy Release ownership projection disables stop and the writer rejects it. This projection is not T5 or successor acceptance evidence.

consumer 5通过，lifecycle 22通过／1次初跑失败（原样定向复跑解决）／1跳过，domain 44通过，acceptanceRetry 1通过，共72通过、1跳过。首轮类型检查5条诊断涉及Map推断的project品牌、默认scope推断为Run品牌、managementContext的Run品牌和optional undefined；原输出与两份源码字节／SHA保留在initial-type-failure。首轮domain契约覆盖仍断言旧50条路径（新文档56），旧implemented列表未列新6个operation；原测试字节／SHA和原因保留在contract-coverage-failure。补覆盖清单及创建需Run If-Match／停止用原preview CAS的声明验证，不因此改产品代码／OpenAPI。全部组结束后修正，最终重新完整构建并以相同全部输入重跑，不复用旧组结果。完整重跑的并行lifecycle组既有接受用例返回409而非注入丢ACK的503；独立只诊断计时复现READY依据从请求前19.346秒至结束31.735秒过期，Release为0，详细时间／响应保存readiness-timing，不计入通过数。未修改产品或测试、未放宽30秒规则；各组及诊断结束后以相同全部输入单独定向复跑原接受用例，通过记录另列，原失败保留。运行中及运行后输入无漂移，370条映射、684份输入／产物绑定。完整构建／类型／Lint／契约通过，旧控制SQL1～44、Runner源码／持久格式、依赖保持。

上游Git／OCI／候选、容器与旧Release归属为显式夹具；实际HTTP／控制Worker、应用SQLite文件及业务写入／原键重开独立留证。无新React管理页、企业身份、真实Linux／gVisor或正式后继保留替换T5；没有完整pnpm check／固定提交干净checkout。单Agent开发复核，非独立人员或产品签认。正式P1-07／OpenSpec8/13和阶段门槛保持，不归档。

原始记录：[evidence.json](./development/preview-management/evidence.json)、[final-binding.json](./development/preview-management/final-binding.json)、[manifest.json](./development/preview-management/manifest.json)。
