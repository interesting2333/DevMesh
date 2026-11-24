import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const require = createRequire(import.meta.url);
const requiredTools = ['browser_navigate', 'browser_click', 'browser_type', 'browser_wait_for',
  'browser_snapshot', 'browser_take_screenshot'];

export async function startTaskBoardMcp({ workspace, browser, headless, onExit }) {
  const program = require.resolve('@playwright/mcp/package.json');
  const packageVersion = require(program).version;
  const working = await mkdtemp(join(tmpdir(), 'devmesh-playwright-'));
  const client = new Client({ name: 'devmesh-task-board-check', version: '1.0.0' });
  let service;
  let closing = false;
  async function close() {
    closing = true;
    try { await client.close(); }
    finally {
      try { await service?.close(); }
      finally { await rm(working, { recursive: true, force: true }); }
    }
  }

  try {
    const { TaskDatabase } = await import(pathToFileURL(join(workspace, 'dist/server/database.js')));
    const { startService } = await import(pathToFileURL(join(workspace, 'dist/server/service.js')));
    const root = join(working, 'dataset');
    TaskDatabase.initialize(root);
    service = await startService({ root, port: 0, webRoot: join(workspace, 'dist/web') });
    const args = [join(dirname(program), 'cli.js'), '--browser', browser,
      ...(headless ? ['--headless'] : []), '--isolated', '--allowed-origins', service.url,
      '--output-dir', working, '--viewport-size', '1280x800'];
    const transport = new StdioClientTransport({
      command: process.execPath, args, cwd: working, stderr: 'inherit',
      ...(process.env.PLAYWRIGHT_BROWSERS_PATH ? { env: { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } } : {})
    });
    client.onclose = () => { if (!closing) onExit?.(); };
    await client.connect(transport, { timeout: 10000 });
    const server = client.getServerVersion();
    assert.ok(server?.name && server.version, 'Missing Playwright MCP server identity');
    const { tools } = await client.listTools({}, { timeout: 10000 });
    assert.ok(requiredTools.every(name => tools.some(tool => tool.name === name)), 'Playwright MCP tools are missing');
    return { client, close, server, packageVersion, toolCount: tools.length, url: service.url, working };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runTaskBoardCheck(session, output) {
  const steps = [];
  async function call(name, args = {}) {
    const result = await session.client.callTool({ name, arguments: args }, undefined, { timeout: 8000 });
    const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    assert.ok(!result.isError && !/^### Error\b/m.test(text), name + ' failed: ' + text.slice(0, 600));
    steps.push(name);
    return text;
  }

  const title = 'Playwright MCP 验收任务 ' + randomUUID().slice(0, 8);
  const evidence = ['board.png', 'board-snapshot.txt'];
  await call('browser_navigate', { url: session.url + '/' });
  try {
    await call('browser_click', { target: 'button:has-text("新建任务")' });
    await call('browser_type', { target: 'label:has-text("标题") input', text: title });
    await call('browser_click', { target: 'button:has-text("保存任务")' });
    await call('browser_wait_for', { text: title });
    await call('browser_navigate', { url: session.url + '/' });
    await call('browser_wait_for', { text: title });
    const snapshot = await call('browser_snapshot');
    assert.ok(snapshot.includes(title), 'Task missing after reload');
    const filename = randomUUID() + '.png';
    try {
      await call('browser_take_screenshot', { type: 'png', filename, fullPage: true });
      const screenshot = await readFile(join(session.working, filename));
      assert.equal(screenshot.subarray(1, 4).toString('ascii'), 'PNG');
      await mkdir(output, { recursive: true });
      const info = await lstat(output);
      assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Invalid evidence directory');
      const pending = await mkdtemp(join(output, '.pending-'));
      try {
        const report = { status: 'PASSED', server: session.server, packageVersion: session.packageVersion,
          transport: 'stdio', scenario: 'task-board-create-and-reload', evidence, steps };
        await writeFile(join(pending, 'board.png'), screenshot);
        await writeFile(join(pending, 'board-snapshot.txt'), snapshot + '\n');
        await writeFile(join(pending, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        for (const name of [...evidence, 'report.json']) await rename(join(pending, name), join(output, name));
      } finally { await rm(pending, { recursive: true, force: true }); }
    } finally { await rm(join(session.working, filename), { force: true }); }
  } finally {
    const response = await fetch(session.url + '/api/tasks', { signal: AbortSignal.timeout(3000) });
    assert.ok(response.ok, 'Failed to read temporary tasks');
    const { tasks } = await response.json();
    const task = tasks.find(item => item.title === title);
    if (task) {
      const deleted = await fetch(session.url + '/api/tasks/' + task.id, { method: 'DELETE',
        headers: { 'idempotency-key': randomUUID(), 'if-match': '"' + task.revision + '"' }, signal: AbortSignal.timeout(3000) });
      assert.ok(deleted.ok, 'Failed to remove temporary check task');
      await deleted.body?.cancel();
    }
  }
}
