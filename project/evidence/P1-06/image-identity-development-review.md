# 交付镜像内容身份：开发检查与同 Agent 复核

2026-11-12，Codex 实施并复核。`verifyPreviewImage` 从实际原字节计算 manifest digest、config digest、层摘要及有序未压缩 diff_ids，交叉核对准确源码和构建产物哈希。它只证明内容身份，不执行镜像，也不单独证明原构建来源或运行健康。

有界格式依据 [OCI image-spec 1.1.0 manifest](https://github.com/opencontainers/image-spec/blob/v1.1.0/manifest.md) 与 [config](https://github.com/opencontainers/image-spec/blob/v1.1.0/config.md)。本地交付格式限制为 Linux amd64／arm64、tar／gzip、最多 16 层、每层原始及解压后不超过 64 MiB、总计 256 MiB，manifest／config 各 1 MiB；没有声称支持所有 OCI 格式。未知 media type、重复 JSON 键、缺失／额外 blob、不同源码或构建标签、不同 diff_id 及解压超限均拒绝，没有下载或解包到文件系统的路径。

`development/images-v1` 的类型、lint、当前依赖构建、5 个镜像用例、contracts 18、原报告／阈值计算回归及 OpenAPI 一致性全部通过。随后只增加双层次序测试；`development/images-v2` 的 lint 和 6 个镜像用例通过，生产源码不变，类型／构建及关联回归复用 v1 原始报告，不声称再次执行。

复核了配置内容摘要与 manifest 摘要的区别、压缩层摘要与未压缩 diff_id 的区别、实际生成镜像与测试基础镜像的区别；代码不接受调用方提供的标签摘要作为 actual bytes 的替代。原 Runner 批准命令／固定工作区／Job／输出哈希的交付关联、原材料 ACK、数据方案和完整候选冻结仍待任务 4 后续实现，因此任务 4.1／4.2 不勾选。本次纯字节夹具检查不等于生成应用镜像构建、Docker 或 Linux/runsc 验收。
