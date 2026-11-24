FROM node:24.13.1-bookworm
WORKDIR /opt/devmesh/playwright-mcp
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/devmesh/browsers
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts --no-audit --no-fund
RUN sed -i 's|http://deb.debian.org/|https://deb.debian.org/|g' /etc/apt/sources.list.d/debian.sources \
    && echo 'Acquire::Retries "3";' >/etc/apt/apt.conf.d/80-retries \
    && node node_modules/playwright/cli.js install-deps chromium \
    && rm -rf /var/lib/apt/lists/*
RUN node node_modules/playwright/cli.js install --no-shell chromium
COPY task-board.mjs session.mjs ./
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/node", "/opt/devmesh/playwright-mcp/task-board.mjs"]
