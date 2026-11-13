# 接受数据撤销日志与原归属证明：本地开发复核

本轮实现显式RunnerAcceptanceDatasetAbortBackend与AcceptanceDatasetAbortAuthority接口、严格证明核验及独立有界文件Worker。后端从控制库读取原决定，从Runner SQLite读取原服务／网络清理，调用者不能提交任意决定或成功标志。原目标目录的abort-operation.json独占刷新后只有一次物理abort机会；已有或不完整日志只查询原结果。原准备Worker看到该日志即关闭继续执行，abort-receipt.json排他保存原日志字节SHA及稳定证明。

适配器契约要求永久封禁原准备的迟到acquire／写入、核实在途工作、目标继续CLOSED、按原持有与严格递增generation恢复准确源release归属。无本地fences文件也须查询适配器自身的原记录。源只标CONTROL_CLOSED；原数据、journal、fences和准备receipt不改写。文件Worker超时不释放尚未结束的物理后端调用名额，实例maximumWorkers同时限制未返回的后端调用；原调用真正结束才恢复名额。

最终abort-02 24/24；service-02 34/34；datasets-02 27/27，合计85项测试通过，无失败／跳过。六包构建、根类型检查、Lint及157/157源码映射通过；旧Runner v2～v9的8份迁移正文，以及全部40份控制库迁移／manifest与父提交一致，无数据库升级。测试实际执行排他文件／fsync、并发Worker、超时与原查询、Runner／控制面SQLite、真实业务数据字节保留；物理永久撤权／容器／源归属均为明确夹具，不是Linux物理证据。

覆盖INITIAL、保留快照与明确REPLACE，原source／target字节与准备证据保留；丢物理ACK／丢本地receipt／最后授权失效后不重派；缺本地fences但已acquire、错误generation／原hold／决定／源release、部分日志／链接／孤立文件和未完成原服务均关闭。实际控制组合先按真实verifyAcceptancePreparation授权物化数据，再由owner保存撤销决定；Runner原记录与数据恢复证明绑定，控制面仍ABORTING／目标CLOSED、没有Release。

首轮abort-01为21/23，同一个符号链接子用例错误码断言导致该子项及父分组各计一次失败。safePath已拒绝链接，Worker将StorageError统一映射为后端失败；修正测试为核实拒绝、零物理调用和原文件SHA不变，没有放宽路径守卫。同时补齐超时后的未完成物理调用名额限制及用例；原失败、修正前源码与SHA全部保留。首轮service-01 34/34、datasets-01 27/27也保留，最终两组已重跑。

输入绑定：build-01通过后追加独立并发／超时／替换测试，build-02通过；失败修正及物理调用名额代码来自build-03。随后仅调整独立MJS实际控制测试的执行顺序，改为真实授权物化后再撤销；没有生产代码或产物变化，不宣称该测试与build-03输入相同。全部最终测试使用同一最终输入／已生成产物，运行期间无变化。详见final-binding.json的两段修正链及postBuildTestChange。

尚未提供真实物理Authority实现或默认平台装配，缺配置继续关闭。控制面完整撤销结论、源门准确关闭记录／原未知写核实、源服务恢复、项目占用释放与ABORTED继续实施；可写发布、正向迭代和真实Linux／gVisor／配额／身份及产品验收仍需原范围证据。正式P1-07保持NOT_STARTED、未认领并等待P1-06／G0；OpenSpec8/13、完整4.1不勾选，不归档。

原输出／指纹／修正源码／检查脚本见[清单](./development/acceptance-data-abort/manifest.json)和[绑定](./development/acceptance-data-abort/final-binding.json)。post-1保存最终台账、OpenSpec、设计生成、契约、Lint及diff检查。本轮是修改中checkout的本地开发复核，未执行完整根pnpm check、固定提交干净checkout、真实物理恢复或独立／产品验收。
