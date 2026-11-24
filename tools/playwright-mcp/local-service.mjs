import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createLocalPlaywrightService({ workspace, results, settingsFile }) {
  let config = null;
  try {
    config = JSON.parse(await readFile(settingsFile, 'utf8'));
    if (config !== null && (typeof config.displayName !== 'string' || !config.displayName.trim() ||
      !['msedge', 'chrome', 'chromium'].includes(config.browser) ||
      typeof config.headless !== 'boolean' || typeof config.enabled !== 'boolean')) {
      throw new Error('Invalid local Playwright MCP settings');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let session;
  let running = false;
  let error = null;
  let operation;
  let closing = false;
  const view = () => ({ config, running, error, busy: Boolean(operation),
    toolCount: running ? session.toolCount : 0 });

  async function persist(next) {
    await mkdir(dirname(settingsFile), { recursive: true });
    const temp = settingsFile + '.' + randomUUID();
    try {
      await writeFile(temp, JSON.stringify(next) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temp, settingsFile);
      config = next;
    } finally { await rm(temp, { force: true }); }
  }

  async function stop() {
    running = false;
    await session?.close();
    session = undefined;
  }

  async function start() {
    try {
      await stop();
      const { startTaskBoardMcp } = await import('./session.mjs');
      let exited = false;
      session = await startTaskBoardMcp({ workspace, browser: config.browser, headless: config.headless,
        onExit() { exited = true; running = false; error = 'PROCESS_EXITED'; } });
      const result = await session.client.callTool({ name: 'browser_navigate', arguments: { url: session.url + '/' } },
        undefined, { timeout: 12000 });
      if (exited || result.isError || result.content.some(item => item.type === 'text' && /^### Error\b/m.test(item.text))) {
        throw new Error('Playwright browser startup failed');
      }
      running = true;
    } catch (cause) {
      console.error('Local Playwright MCP startup failed:', cause.message);
      await stop();
      if (config.enabled) await persist({ ...config, enabled: false });
      error = 'START_FAILED';
    }
  }

  async function perform(action) {
    if (closing || operation) return { ...view(), error: 'BUSY' };
    error = null;
    operation = Promise.resolve().then(action);
    try { await operation; }
    finally { operation = undefined; }
    return view();
  }

  if (config?.enabled) void perform(start).catch(cause => console.error('Local Playwright MCP restore failed:', cause.message));
  return {
    view,
    save(next) {
      return perform(async () => {
        const restart = config?.enabled && (config.browser !== next.browser || config.headless !== next.headless);
        await persist({ ...next, enabled: config?.enabled ?? false });
        if (restart) await start();
      });
    },
    setEnabled(enabled) {
      return perform(async () => {
        if (!config) { error = 'NOT_CONFIGURED'; return; }
        if (config.enabled !== enabled) await persist({ ...config, enabled });
        if (enabled && !running) await start();
        if (!enabled) await stop();
      });
    },
    remove() {
      return perform(async () => {
        await persist(null);
        await stop();
      });
    },
    check() {
      return perform(async () => {
        if (!running) { error = 'NOT_RUNNING'; return; }
        try {
          const { runTaskBoardCheck } = await import('./session.mjs');
          await runTaskBoardCheck(session, results);
        }
        catch (cause) {
          console.error('Local Playwright MCP check failed:', cause.message);
          error = 'CHECK_FAILED';
        }
      });
    },
    async close() {
      closing = true;
      try { await operation; } finally { await stop(); }
    }
  };
}
