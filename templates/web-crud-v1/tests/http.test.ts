import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { TaskDatabase } from '../src/server/database.js';
import { startService } from '../src/server/service.js';
import { WorkerStore } from '../src/server/store.js';
import { application } from '../src/server/app.js';
import { createServer } from 'node:http';
import type { Task } from '../src/shared/task.js';
const workerScript = new URL('../dist/server/db-worker.js', import.meta.url);
const parents: string[] = [];
const services: Awaited<ReturnType<typeof startService>>[] = [];
async function fixture(readOnly = false) {
  const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-http-')); parents.push(parent);
  const root = join(parent, 'dataset'); TaskDatabase.initialize(root);
  const service = await startService({ root, port: 0, readOnly, workerScript }); services.push(service);
  return { root, service };
}
const input = { title: '端到端任务', description: '<script>只是文字</script>', status: 'todo' };
const headers = () => ({ 'content-type': 'application/json', 'idempotency-key': randomUUID() });
afterEach(async () => { for (const service of services.splice(0)) await service.close(); for (const parent of parents.splice(0)) rmSync(parent, { recursive: true, force: true }); });
it('serves real HTTP through the SQLite Worker, persists on restart, and rejects stale and malformed writes', async () => {
  const { root, service } = await fixture();
  expect((await fetch(service.url + '/api/health')).status).toBe(200);
  const createHeaders = headers();
  const create = () => fetch(service.url + '/api/tasks', { method: 'POST', headers: createHeaders, body: JSON.stringify(input) });
  expect((await create()).status).toBe(201);
  const { task } = await (await create()).json() as { task: Task };
  expect((await (await fetch(service.url + '/api/tasks')).json()).tasks).toHaveLength(1);
  const updated = await fetch(service.url + '/api/tasks/' + task.id, { method: 'PUT', headers: { ...headers(), 'if-match': '"1"' }, body: JSON.stringify({ ...input, status: 'done' }) });
  expect(updated.status).toBe(200);
  const stale = await fetch(service.url + '/api/tasks/' + task.id, { method: 'DELETE', headers: { ...headers(), 'if-match': '"1"' } });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toEqual({ error: 'REVISION_CONFLICT' });
  const missing = await fetch(service.url + '/api/tasks/' + task.id, { method: 'DELETE', headers: headers() });
  expect(missing.status).toBe(428);
  for (const body of [{ ...input, title: '' }, { ...input, extra: 'denied' }, { ...input, status: 'invalid' }]) {
    expect((await fetch(service.url + '/api/tasks', { method: 'POST', headers: headers(), body: JSON.stringify(body) })).status).toBe(400);
  }
  expect((await fetch(service.url + '/api/tasks', { method: 'POST', headers: headers(), body: '{' })).status).toBe(400);
  expect((await fetch(service.url + '/api/tasks', { method: 'POST', headers: headers(), body: JSON.stringify({ ...input, description: 'x'.repeat(40000) }) })).status).toBe(413);
  expect((await fetch(service.url + '/api/unknown')).status).toBe(404);
  await service.close(); await service.close();
  const restarted = await startService({ root, port: 0, workerScript }); services.push(restarted);
  expect((await (await fetch(restarted.url + '/api/tasks')).json()).tasks[0].status).toBe('done');
  expect((await fetch(restarted.url + '/api/tasks/' + task.id, { method: 'DELETE', headers: { ...headers(), 'if-match': '"2"' } })).status).toBe(200);
  expect((await (await fetch(restarted.url + '/api/tasks')).json()).tasks).toEqual([]);
});
it('denies foreign Origin, hostile Host and read-only mutations', async () => {
  const { service } = await fixture(true);
  expect((await (await fetch(service.url + '/api/tasks')).json()).readOnly).toBe(true);
  expect((await fetch(service.url + '/api/tasks', { method: 'POST', headers: headers(), body: JSON.stringify(input) })).status).toBe(403);
  expect((await fetch(service.url + '/api/tasks', { headers: { origin: 'https://other.example' } })).status).toBe(403);
  expect((await fetch(service.url + '/api/tasks', { headers: { origin: service.url } })).status).toBe(200);
  const status = await new Promise<number>(resolve => { const request = httpRequest(service.url + '/api/tasks', { headers: { Host: 'hostile.example' } }, response => { response.resume(); resolve(response.statusCode!); }); request.end(); });
  expect(status).toBe(403);
});
it('rejects unavailable Worker startup and a second listener without abandoning the dataset lock', async () => {
  const { root, service } = await fixture();
  const otherRoot = join(parents[0]!, 'other'); TaskDatabase.initialize(otherRoot);
  const port = Number(new URL(service.url).port);
  await expect(startService({ root: otherRoot, port, workerScript })).rejects.toThrow();
  const reopened = new TaskDatabase(otherRoot); reopened.close();
  await expect(startService({ root: join(parents[0]!, 'missing'), port: 0, workerScript })).rejects.toThrow('STORAGE_UNAVAILABLE');
  const worker = new WorkerStore(otherRoot, false, workerScript);
  await worker.initialized(); await worker.close(); await worker.close();
  await expect(worker.list()).rejects.toThrow('STORAGE_UNAVAILABLE');
  await service.close();
});
it('returns public storage errors without exposing implementation paths', async () => {
  const server = createServer(application({ list: async () => { throw new Error('/private/path'); }, mutate: async () => { throw new Error('/private/path'); }, close: async () => {} }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tasks`);
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'INTERNAL_ERROR' });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
it('serves the built entry beneath a hidden ancestor while denying hidden web assets', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'devmesh-template-web-')); parents.push(parent);
  const web = join(parent, '.checkout', 'dist', 'web'); mkdirSync(web, { recursive: true });
  writeFileSync(join(web, 'index.html'), '<!doctype html><title>任务看板</title>'); writeFileSync(join(web, '.env'), 'PRIVATE_TEST_ASSET');
  const server = createServer(application({ list: async () => ({ tasks: [], readOnly: true }), mutate: async () => { throw new Error('not needed'); }, close: async () => {} }, web));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const entry = await fetch(url + '/'); expect(entry.status).toBe(200); expect(await entry.text()).toContain('任务看板');
    const hidden = await fetch(url + '/.env'); expect(hidden.status).toBe(404); expect(await hidden.text()).not.toContain('PRIVATE_TEST_ASSET');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
