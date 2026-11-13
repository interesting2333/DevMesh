# P1-07 导出宿主消费开发复核

平台通过显式 releaseExports.enabled 配置组合持久导出消费者，要求storage，默认关闭。私有扫描QUEUED和原租约过期PACKING，按原创建者／当前成员和generation CAS恢复，最多两并发及有界轮次；普通FAILED需显式retry。默认源读取器固定控制根下原bare Git，不执行验收／发布／迁移。平台关闭先停API准入，再取消并等待原打包后关闭SQLite。接入、恢复和合作取消边界见 [EXPORTS.md](../../../packages/result-verifier/EXPORTS.md)。

## 验证及输入

专项scheduler 9/9；导出／内容／迁移／foundation／Input组合回归39通过、1项Windows不适用POSIX SIGTERM跳过，合计48通过、1跳过。构建、类型、Lint及OpenAPI一致性通过；153条生成源码映射匹配当前源文件，控制迁移1～44及Runner迁移／代码未改，新增依赖只有两条workspace link。

实际执行本地Worker／CAS／Git、两个消费者竞争、受控源读取等待、时钟租约过期、Worker terminate/reopen、计时循环、成员撤销、协作取消后等调用返回、真实平台HTTP下载以及开／关／重启消费者。原版本／snapshot／接受与发布事实保持。最终scheduler/type/lint/contracts运行时无输入变化且匹配最终源码。build/regression之后只在独立scheduler测试的hostedFixture补齐原计划CAS字节；该文件不参与build，也不被旧regression导入／选择，生产及共享夹具字节完全一致。先前测试原字节已留存且匹配两组输入hash，不声称所有组checkout完全同字节。

## 失败和修正

首轮scheduler 8/9，一项宿主启动失败：完整性检查发现一个未物化对象。实际诊断扫描确认其hash准确等于canonical(f.draft)，是原领域夹具只登记计划hash但未落盘。仅在新宿主测试中通过CAS写回已知原字节，未绕过完整性、改READY或弱化产品逻辑；完整专项再跑9/9。诊断1项只用于定位，不计入产品验证。失败日志、原测试字节及诊断均保留；原早期build的源码差异在指纹中如实可见，没有宣称保留每个早期完整checkout。未执行完整pnpm check。

## 状态和限制

同一Codex Agent本地复核，不是独立人员或真实用户验收。宿主layout及上游T5／准入／镜像／物理声明为明确协议夹具；此测试不验证备份还原、实际生成镜像／Linux／OIDC／模型或产品全链路。90秒为协作取消期限，未实测等足90秒，也不把未返回底层调用视为已终止。公开UI、完整后继保留／替换T5及换代源恢复和实际物理验收继续。P1-07正式前置P1-06／G0未满足，工作包不认领、OpenSpec 8/13及G0～G4不变，不归档。

原始材料及绑定见 [evidence.json](./development/release-export-host/evidence.json)、[final-binding.json](./development/release-export-host/final-binding.json) 与 [manifest.json](./development/release-export-host/manifest.json)。
