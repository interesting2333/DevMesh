# P1-07 React 交付入口开发复核

原 Release 页新增“查看交付包”，独立 React 18 页显示原接受版本、准确 SHA、历史标识、作业及校验信息，并连接原导出 API。固定本地脚本也鉴权，nonce CSP／转义 Bootstrap JSON，不使用 CDN。入口由现有 tsdown 构建；完整工作台仍按 React／Vite 实施。

创建先保存当前标签的原 UUID；响应未知或重载后只由用户点击核实原请求，GET 不创建／重试。每页20条游标，当前任务固定展示，可见活跃任务每2秒 GET；后台暂停、单在途／15秒合作取消、离开取消和 BFCache 恢复重载。canRetry 由服务端基于当前成员、原创建者和原失败／过期状态计算，重试使用准确generation；无法核实时关闭动作／隐藏下载，撤权清空作业。

## 实际验证

接口2/2、实际Edge3/3、既有宿主9/9、导出／内容／原预览与Release入口／迁移／契约／foundation回归69通过、1项Windows不适用POSIX SIGTERM跳过，合计83通过、1跳过。构建／类型／Lint／OpenAPI一致性通过；199条生成源码映射匹配原字节，包含TSX与浏览器第三方，控制迁移1～44及Runner代码／迁移未改。

实际本地Worker／CAS／Git／HTTP／React／Edge执行：两次同原键提交但只有一个持久任务，刷新后找回已提交丢回执原作业；实际ZIP下载hash和文件名准确；原失败任务重试、恶意错误文本不执行、21条按20／1翻页返回、撤权清空作业。原接受／发布／指针事实逐项不变。已目视检查桌面和390px截图，无覆盖或横向溢出。

## 失败及输入绑定

首轮构建漏导出releaseExportEntryView，补契约入口后构建通过；早期两次构建清单未含TSX，只有最后构建及后续清单用于最终验证。接口首轮1/2因测试成员缺created_at，补夹具后完整2/2。浏览器首轮2/3，下载取消；真实请求观察确认下载没有Playwright注入的认证头，服务端返回401，路由注入和extraHTTPHeaders均不能覆盖该请求。最终浏览器明确使用本地可信身份夹具，原生产身份／Cookie拒绝边界未改，真实企业登录未实现。诊断不计入产品测试。

最终entry/browser/type/lint/contracts输入与最终源码一致。此前build/scheduler/regression只有三份新入口测试／夹具发生后续修正，均不在此前构建或这些回归的选择／导入路径；生产、原共享夹具及被选测试字节一致。regression执行时只改过未选中的新接口测试。差异逐项记录；原浏览器测试为修改前复制，另两份原字节通过逆转夹具修正重建，并与早期指纹SHA-256完全匹配。不能理解为所有组同一完整checkout重跑；未执行完整pnpm check，亦不声称保留所有早期失败源快照。

## 边界和状态

同一Codex Agent开发复核，非独立人员或真实用户签认。上游T5／准入／OCI／物理事实及浏览器身份是明确夹具；本轮不验证模型、OIDC／Cookie登录、Linux／gVisor、完整工作台、完整正式后继保留／替换或门换代源恢复。P1-07正式前置P1-06／G0未满足，工作包不认领、OpenSpec8/13及G0～G4不变，不归档。已同步接口、技术设计、实施与验收核对及任务台账。

原始材料与绑定见 [evidence.json](./development/release-export-entry/evidence.json)、[final-binding.json](./development/release-export-entry/final-binding.json) 和 [manifest.json](./development/release-export-entry/manifest.json)。
