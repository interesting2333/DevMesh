## 1. Protocol and policy

- [x] 1.1 实现独立 Runner 配置、作业／宿主 schema、客户端与服务身份；用真实本地 HTTP 验证越权、同键同请求、冲突与失联查询。
- [x] 1.2 实现固定镜像、受控命令、资源／工作区校验和 authority 接口；验证任意命令、挂载、越界链接及混合宿主拒绝。

## 2. Durable jobs

- [x] 2.1 实现独立 SQLite Worker 登记、原 operation 查询和原子容量准入；验证并发去重、配额、外键、终态不回退与事务回滚。
- [x] 2.2 实现先登记再启动、租约／代际与停止状态机；用可控后端验证响应丢失、旧续租、未知停止和原 job 核实，注明不是 gVisor 验收。
- [x] 2.3 实现原容器恢复和日志／输出保留；用真实管理进程退出验证登记可恢复、不重放和材料未 ACK 不清理。

## 3. Provider and delivery

- [x] 3.1 实现 Linux Docker/runsc Provider、启动入口和固定镜像构建描述；验证参数、未配置拒绝和容器事实映射，不填虚构 digest。
- [ ] 3.2 在目标环境验证真实容器／后代退出、资源／网络／密钥隔离和丢响应恢复；当前用户明确暂无资源，保持未执行。
- [x] 3.3 运行适用离线回归，保存源版本、实际日志与技术复核，更新文档／台账；真实专项具备后方可完成整个工作包与归档。

2026-11-16：勾选3.1。Linux Docker/runsc Provider、启动入口与固定镜像构建描述均在（`packages/runner/src/docker.ts`、`main.ts`、`packages/runner/image/Dockerfile`），不填虚构 digest。在WSL2 Linux（kernel 6.18.40.1，Node 24.22.3，偏离冻结24.13.1但仍在engines范围）执行`tests/runner.test.mjs`：12/12通过、0失败，覆盖参数边界、未配置拒绝、原标签校验及停止后的容器事实映射。真实Docker/runsc、硬配额、网络／密钥隔离与目标环境仍属3.2，保持未执行；正式P0-07／G0不变。证据：`project/evidence/P0-07/wsl-2026-11-16/`。
