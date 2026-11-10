## Purpose

提供可独立复制和核实的任务看板应用模板，将前端操作、后端业务数据、可重复构建及检查材料连接起来。模板通过明确的数据归属、并发版本和执行边界，使固定示例应用的验证不会混淆为任意生成应用已通过隔离或产品验收。

## ADDED Requirements

### Requirement: Independent application template

模板 SHALL 包含独立运行所需的源码、精确依赖锁、能力清单、数据与检查配置。未实际构建和验证的镜像 MUST 保持待配置，不得使用虚构 digest 表示可执行。

#### Scenario: Missing execution image
- **WHEN** 模板尚没有真实镜像产物和目标环境记录
- **THEN** 能力清单明确保留待执行状态，Runner 不能据此启动未批准镜像

### Requirement: Persistent task board

应用 SHALL 支持任务新增、修改、三状态流转和确认删除，显示加载／错误反馈，并把保存成功的业务记录持久化到独立 dataset。

#### Scenario: Refresh and restart
- **WHEN** 用户保存任务后刷新页面并重启应用后端
- **THEN** 同一 dataset 中任务内容和状态保留，不依赖浏览器内存恢复

### Requirement: Bounded and versioned writes

应用 MUST 验证输入范围、幂等键与更新版本，拒绝未知字段、空标题、重复键异参数和过期修改；只读期间不得接受写入。

#### Scenario: Duplicate or stale write
- **WHEN** 相同键被复用为不同请求，或提交的记录版本已过期
- **THEN** 返回明确冲突，不重复新增、不覆盖较新记录

### Requirement: Verifiable template checks

模板 SHALL 声明并执行适用的构建、单元、覆盖与浏览器检查，原始结果和缺项可追溯。固定源码本地检查 MUST 与实际 Runner／隔离验收分开记录。

#### Scenario: Missing browser or isolation environment
- **WHEN** 浏览器依赖或实际 runsc 环境不可用
- **THEN** 对应检查保留失败或未执行，不把其余静态校验提升为该检查通过
