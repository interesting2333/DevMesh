# Supply an operator-verified node:24.13.1 base by its immutable sha256 digest.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
RUN test "$(node --version)" = "v24.13.1" \
    && npm install --global pnpm@11.28.5 \
    && pnpm --version | grep -x '11.28.5'
WORKDIR /workspace
USER 10001:10001
# Dependencies and browser binaries for a template must be added at image build
# time. Runtime has no network; do not fall back to installing on the control host.
CMD ["node", "--version"]
