import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, startPlatform } from '../packages/platform-core/dist/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const entry = resolve(root, 'apps/server/dist/main.mjs');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('DEVMESH_')));

function launch(t, env = {}, args = []) {
  const child = spawn(process.execPath, [entry, ...args], { cwd: root, env: { ...cleanEnv, DEVMESH_PORT: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const events = [];
  let stdout = '';
  let stderr = '';
  let buffer = '';
  const ready = Promise.withResolvers();
  ready.promise.catch(() => {});
  child.stdout.on('data', chunk => {
    stdout += chunk;
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try { const event = JSON.parse(line); events.push(event); if (event.event === 'ready') ready.resolve(event); } catch { /* Non-JSON third-party diagnostic. */ }
    }
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { ready.reject(new Error(`Exited before ready: ${stderr}`)); resolve({ code, signal, stdout, stderr, events }); });
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
  });
  return { child, ready: ready.promise, exited };
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

test('configuration defaults, JSON file and environment precedence', t => {
  assert.deepEqual(loadConfig({}), { host: '127.0.0.1', port: 3210, shutdownTimeoutMs: 5000 });
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-config-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'server.json');
  writeFileSync(path, JSON.stringify({ host: '127.0.0.1', port: 4567, shutdownTimeoutMs: 1000 }));
  assert.equal(loadConfig({}, path).port, 4567);
  assert.equal(loadConfig({ DEVMESH_PORT: '0' }, path).port, 0);
  assert.ok(Object.isFrozen(loadConfig({})));
  writeFileSync(path, JSON.stringify({ porrt: 123 }));
  assert.throws(() => loadConfig({}, path), /Unknown server configuration field/);
  writeFileSync(path, 'null');
  assert.throws(() => loadConfig({}, path), /JSON object/);
  writeFileSync(path, '{broken');
  assert.throws(() => loadConfig({}, path), /Cannot read or parse/);
});

test('invalid ports, timeouts and public bind addresses are rejected', () => {
  for (const port of ['', 'NaN', '1.5', '-1', '65536', '0x10']) assert.throws(() => loadConfig({ DEVMESH_PORT: port }), /port must be an integer/);
  assert.throws(() => loadConfig({ DEVMESH_HOST: '0.0.0.0' }), /loopback/);
  assert.throws(() => loadConfig({ DEVMESH_SHUTDOWN_TIMEOUT_MS: '99' }), /shutdownTimeoutMs/);
});

test('real Cordis plugin serves health/readiness and disposes its listener', { timeout: 15000 }, async t => {
  const platform = await startPlatform(loadConfig({ DEVMESH_PORT: '0' }));
  t.after(() => platform.stop());
  const origin = `http://127.0.0.1:${platform.address.port}`;
  assert.equal(platform.address.address, '127.0.0.1');
  const health = await fetch(`${origin}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', component: 'devmesh-server', scope: 'platform-foundation' });
  assert.equal((await fetch(`${origin}/readyz`)).status, 200);
  assert.equal((await fetch(`${origin}/missing`)).status, 404);
  const first = platform.stop();
  assert.equal(platform.stop(), first);
  await first;
  await assert.rejects(fetch(`${origin}/healthz`));
});

test('shutdown closes an unfinished TCP connection within its configured deadline', { timeout: 15000 }, async t => {
  const platform = await startPlatform(loadConfig({ DEVMESH_PORT: '0', DEVMESH_SHUTDOWN_TIMEOUT_MS: '100' }));
  t.after(() => platform.stop());
  const socket = connect(platform.address.port, '127.0.0.1');
  t.after(() => socket.destroy());
  socket.on('error', error => { assert.equal(error.code, 'ECONNRESET'); });
  await once(socket, 'connect');
  socket.write('GET /healthz HTTP/1.1\r\nHost: localhost\r\n');
  const closed = new Promise(resolve => { socket.once('close', resolve); });
  await platform.stop();
  await closed;
  assert.equal(socket.destroyed, true);
});

test('occupied port rejects startup without closing the existing listener', { timeout: 15000 }, async t => {
  const existing = createServer(socket => socket.end());
  const port = await listen(existing);
  t.after(() => new Promise(resolve => existing.close(resolve)));
  await assert.rejects(startPlatform(loadConfig({ DEVMESH_PORT: String(port) })), { code: 'EADDRINUSE' });
  assert.equal(existing.listening, true);
});

test('built CLI reaches ready and exits after verified Cordis disposal over IPC', { timeout: 15000 }, async t => {
  const running = launch(t, {}, ['--config', 'config/server.example.json']);
  const ready = await running.ready;
  assert.equal((await fetch(`http://127.0.0.1:${ready.port}/readyz`)).status, 200);
  running.child.send({ type: 'shutdown' });
  const result = await running.exited;
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.events.some(event => event.event === 'stopped' && event.reason === 'ipc'));
  assert.throws(() => process.kill(ready.pid, 0), { code: 'ESRCH' });
  await assert.rejects(fetch(`http://127.0.0.1:${ready.port}/healthz`));
});

test('CLI startup failures have nonzero exit codes and never report ready', { timeout: 15000 }, async t => {
  for (const [env, args, expected] of [
    [{ DEVMESH_PORT: 'bad' }, [], 'CONFIG_INVALID'],
    [{}, ['--config', 'missing-configuration.json'], 'CONFIG_INVALID'],
    [{}, ['--unknown'], 'CONFIG_INVALID'],
  ]) {
    const result = await launch(t, env, args).exited;
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, new RegExp(expected));
    assert.equal(result.events.some(event => event.event === 'ready'), false);
  }
});

test('CLI propagates EADDRINUSE as a nonzero startup failure', { timeout: 15000 }, async t => {
  const existing = createServer(socket => socket.end());
  const port = await listen(existing);
  t.after(() => new Promise(resolve => existing.close(resolve)));
  const result = await launch(t, { DEVMESH_PORT: String(port) }).exited;
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /EADDRINUSE/);
  assert.equal(existing.listening, true);
});

test('CLI shuts down on POSIX SIGTERM', { timeout: 15000, skip: process.platform === 'win32' }, async t => {
  const running = launch(t);
  await running.ready;
  running.child.kill('SIGTERM');
  const result = await running.exited;
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.events.some(event => event.event === 'stopped' && event.reason === 'SIGTERM'));
});

test('all five built vendor modules resolve inside this independent repository', async () => {
  const require = createRequire(new URL('../packages/platform-core/package.json', import.meta.url));
  for (const name of ['@deepseek-ai/cordis', '@deepseek-ai/cosmokit', '@deepseek-ai/cordis-plugin-loader', '@deepseek-ai/cordis-plugin-include', '@deepseek-ai/schemastery']) {
    const entry = require.resolve(name);
    assert.ok(entry.startsWith(resolve(root, 'vendor') + sep), `${name}: ${entry}`);
    assert.ok(Object.keys(await import(pathToFileURL(entry).href)).length > 0);
  }
  const native = require('node-addon-require-builtin');
  assert.equal(native.getBindingInfo().bindingSource, 'optional-package');
  assert.equal(typeof native.requireBuiltin('internal/modules/esm/loader'), 'object');
});
