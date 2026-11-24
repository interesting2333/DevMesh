## Context
当前 model/preparation=true、execution=false，主决策 tools=[]。复用 Provider、SQLite、ControlledGit 和恢复边界；保留专业 Run/DAG。
## Decisions
1. 独立 assistant_sessions／steps／tool_calls 绑定会话、输入版本、模式和当前授权，全部参数校验后才登记工具；不伪造专业计划确认。
2. 开始前核实目录与提交，记录受控源文件当前快照（保留未提交修改），在独立任务副本修改。文件读写使用相对路径、拒绝链接／凭据／越界、旧内容SHA和原操作证据。
3. Docker开发适配与现有严格Runner分开：固定实际镜像digest，网络关闭，源副本只读挂载，tmpfs工作目录，非root、资源和超时限制。模型只能选择批准检查；环境缺失明确阻塞。
4. 模型请求SENT未知不重发；工具未知先按原operation核实；迟到响应不能写入新输入版本。暂停先止新动作并收尾正在进行的容器。
5. 变更应用单独原请求，应用前核对原目录及各文件SHA；部分应用保留原键核实，未决应用阻止新操作／删除／迁移。
6. 结果和能力来自实际工具、文件差异、命令退出码及当前镜像就绪状态。旧用户消息／任务／工作空间和其他未提交界面变更保持。
## Validation
真实FS／Git／SQLite／HTTP、事务故障、路径／权限／模式／版本、ACK丢失与重启；真实Docker和模型样本与可控夹具分别记录。先完成指定页面修改、实际构建及应用，再记录正式Linux/gVisor仍未验收。
