# P1-07 预览管理React页面开发复核

2026-11-13：2.3／5.1预览管理React页：准确候选受保护view／client.js与逐项审查链接，nonce CSP及发送前当前成员复核，GET不准备／派发／停止／签票据／接受。固定数据来源、独立各10项数据／预览历史及跨页原详情；分别确认，刷新／切换／错误清确认。先存每Run原UUID／正文／候选／Run If-Match或原preview CAS再POST，重进不重发、显式原键恢复；损坏存储／未知结果关闭新动作，条件拒绝先刷新后明确放弃，撤权清空UI。UI 2～1440分钟避免一分钟传输后低于后台最小TTL，后台60秒～24小时保持。browser 4通过，consumer 6通过，domain 21通过，共31通过、0跳过；受影响contracts／Input API完整重建、类型／Lint／契约及418映射通过，初次OpenAPI生成／检查早于契约构建而保留旧56路径，原JSON／SHA和两个契约失败保留；全部测试结束后从已构建58路径重新生成，最终同输入重跑全部检查与三组，不改产品源码或测试断言。其余产物源字节沿用前次全workspace构建，旧SQL1～44／Runner源码和格式／依赖未改，输入无漂移。实际Edge／HTTP／控制Worker、三种丢ACK重开与真实应用SQLite保留，分页回执／容器／上游／浏览器身份为显式夹具。管理页开发验证不等于完整工作台、后继保留替换T5／干净checkout或产品验收；正式P1-07／OpenSpec8/13／门槛保持。

## 页面行为

受保护preview-management/view与client.js沿用成员权限和准确候选API。HTML转义JSON并使用nonce CSP、禁止生成应用脚本／iframe；读取原workspace／bundle后再核实当前成员。原预览访问链接进入既有受保护view，由其独立签票据。

页面分别展示固定候选、INITIAL／已接受来源隔离方案、原数据准备状态／保留期限、原服务状态／健康观察／有效期和停止结果。REPLACE接受方案的预览仍使用来源隔离快照，替换确认留在接受入口。两个历史各10项独立游标，跨页保留选中原详情。三项分别确认；准备中、未知、已停止都保留原记录。

每Run严格sessionStorage信封先于POST保存，含UUID／准确候选／完整正文、创建原Run If-Match或停止原preview版本／impact hash。重载和GET不重发；显式核实原请求，新动作在未核实／损坏存储／未刷新时关闭。409／412／422／428须先刷新再明确放弃，其他未知结果保留。权限失效清除受保护状态；pagehide取消请求、bfcache重载、串行操作和15秒fetch边界。

## 实际验证

- Actual protected HTML/React script verifies nonce CSP/current membership, strict queries, default-off reads, no GET effects and a final membership recheck before the response.
- Actual Edge/React/HTTP and file-backed control Worker persist each strict original request before POST. Dataset/start/stop ACKs are separately lost; reload never resends and explicit recovery uses identical UUID/body/conditions after Worker reopen, with one dataset/preview.
- Actual application SQLite is prepared and receives a business write. An independently advanced controlled preview start/stop keeps database bytes unchanged; the browser distinguishes stop decision from cleanup. No Release or accepted pointer is created.
- Actual React separates three consents, clears stop consent on refresh, closes new actions on corrupt pending storage, requires refreshed state before abandoning a stale rejected request and removes protected candidate/data/history after membership loss.
- Eleven actual writer datasets/previews exercise independent cursor pages and selected original details across pages. Dataset-ready receipts and container facts in this pagination setup are explicit fixtures; real dataset bytes are covered in the first browser case.
- Unconfigured actual entry keeps new dataset/start disabled. Actual desktop/mobile screenshots, 390px overflow assertion and four zero-pageerror browser states are retained.

browser 4通过，consumer 6通过，domain 21通过，共31通过、0跳过。Edge 157.0.4341.42；桌面与移动截图已由Codex目视检查，移动390px无横向溢出，4份最终页面状态均无pageerror。初次生成器读取构建前旧契约而留下56路径，两个漂移检查失败；原JSON／SHA及日志保留于openapi-generation-order。所有组结束后从已构建契约重新生成58路径，最终同输入重跑全部检查及三组；没有改产品源码或测试断言。受影响contracts／Input API完整构建及全源码类型／Lint／契约检查通过，418条映射、690份输入／产物无漂移；其他产物保持前次完整workspace构建的源字节绑定。旧SQL1～44、Runner源码／持久格式及依赖保持。

真实HTTP／控制Worker／应用数据与显式上游／OCI／容器／浏览器身份／分页回执分开留证。没有真实Linux／gVisor、企业身份、正式后继保留替换T5、完整工作台／pnpm check或干净checkout签认。单Agent开发复核；正式P1-07、OpenSpec8/13和阶段门槛保持，不归档。

原始记录：[evidence.json](./development/preview-management-page/evidence.json)、[final-binding.json](./development/preview-management-page/final-binding.json)、[manifest.json](./development/preview-management-page/manifest.json)。截图：[桌面](./development/preview-management-page/screenshots/preview-ready-desktop.png)、[移动就绪](./development/preview-management-page/screenshots/preview-ready-mobile.png)、[移动停止](./development/preview-management-page/screenshots/preview-stopped-mobile.png)。
