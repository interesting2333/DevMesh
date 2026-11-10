import { afterEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { TaskDatabase } from '../src/server/database.js';
import { main } from '../src/server/main.js';
const children: { child: ReturnType<typeof spawn>; exited: Promise<number | null> }[] = [];
async function cli(args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, ['dist/server/main.js', ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let output = ''; child.stdout!.on('data', chunk => { output += String(chunk); }); child.stderr!.on('data', chunk => { output += String(chunk); });
  const exited = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code)); });
  children.push({ child, exited });
  return { child, exited, output: () => output };
}
afterEach(async () => { for (const { child, exited } of children.splice(0)) if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; } });
it('validates CLI configuration without accepting an implicit dataset', async () => {
  await expect(main(['serve'], {})).rejects.toThrow('APP_DATA_ROOT_REQUIRED');
  await expect(main([], { APP_DATA_ROOT: '/unused' })).rejects.toThrow('USE_INIT_OR_SERVE');
  await expect(main(['wrong'], { APP_DATA_ROOT: '/unused' })).rejects.toThrow('USE_INIT_OR_SERVE');
  await expect(main(['serve'], { APP_DATA_ROOT: '/unused', APP_READ_ONLY: 'yes' })).rejects.toThrow('INVALID_READ_ONLY');
  await expect(main(['serve'], { APP_DATA_ROOT: '/unused', APP_PORT: '0' })).rejects.toThrow('INVALID_PORT');
  const failed = await cli(['serve'], { APP_DATA_ROOT: '' });
  expect(await failed.exited).toBe(1);
  expect(failed.output()).toContain('APP_START_FAILED');
}, 120000);
it('starts the actual built CLI and stops it, releasing its Worker and dataset for restart', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-cli-'));
  const root = join(parent, 'dataset');
  let current: Awaited<ReturnType<typeof cli>> | undefined;
  try {
    await main(['init'], { APP_DATA_ROOT: root });
    const socket = createServer(); await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>(resolve => socket.close(() => resolve()));
    current = await cli(['serve'], { APP_DATA_ROOT: root, APP_PORT: String(port) });
    await expect.poll(current.output, { timeout: 60000 }).toContain('APP_READY');
    const response = await fetch(`http://127.0.0.1:${port}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('任务看板');
    // Windows exercises trusted-parent IPC; POSIX exercises the actual SIGTERM handler.
    if (process.platform === 'win32') current.child.send({ type: 'shutdown' });
    else current.child.kill('SIGTERM');
    expect(await current.exited).toBe(0);
    expect(current.output()).toContain('APP_STOPPED');
    const reopened = new TaskDatabase(root); reopened.close();
  } finally {
    if (current && current.child.exitCode === null && current.child.signalCode === null) { current.child.kill(); await current.exited; }
    rmSync(parent, { recursive: true, force: true });
  }
}, 120000);
