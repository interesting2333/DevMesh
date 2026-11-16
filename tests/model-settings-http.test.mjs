import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inputFixture } from './fixtures/input-data.mjs';

test('model settings API stores keys write-only, validates endpoints and tests the provider', { timeout: 120000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-model-settings-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const provider = createServer((request, response) => {
    response.writeHead(request.headers.authorization === 'Bearer sk-test-secret' ? 200 : 401, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: [] }));
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const endpoint = `http://127.0.0.1:${provider.address().port}`;
  const f = await inputFixture(t, { settingsRoot: directory });

  const initial = await f.call('/settings/model');
  assert.equal(initial.response.status, 200);
  assert.deepEqual(initial.body, { configured: false, providerId: null, endpoint: null, model: null, hasApiKey: false, updatedAt: null });

  const insecure = await f.call('/settings/model', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: 'deepseek', endpoint: 'http://example.com', model: 'deepseek-chat', apiKey: 'sk-test-secret' }) });
  assert.equal(insecure.response.status, 422);
  assert.equal(insecure.body.error.code, 'MODEL_ENDPOINT_INVALID');
  assert.equal(existsSync(join(directory, 'model.json')), false);

  const saved = await f.call('/settings/model', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: 'deepseek', endpoint, model: 'deepseek-chat', apiKey: 'sk-test-secret' }) });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.configured, true);
  assert.equal(saved.body.hasApiKey, true);
  assert.equal(JSON.stringify(saved.body).includes('sk-test-secret'), false);
  const secretFile = join(directory, 'model-secret.json');
  assert.equal(readFileSync(secretFile, 'utf8').includes('sk-test-secret'), true);
  if (process.platform !== 'win32') assert.equal(statSync(secretFile).mode & 0o777, 0o600);

  const kept = await f.call('/settings/model', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: 'deepseek', endpoint, model: 'deepseek-reasoner' }) });
  assert.equal(kept.response.status, 200);
  assert.equal(kept.body.model, 'deepseek-reasoner');
  assert.equal(kept.body.hasApiKey, true);

  const tested = await f.call('/settings/model:test', { method: 'POST' });
  assert.equal(tested.response.status, 200);
  assert.equal(tested.body.ok, true);
  assert.equal(tested.body.status, 200);
  assert.equal(JSON.stringify(tested.body).includes('sk-test-secret'), false);
});

test('model settings API refuses a connection test before configuration', { timeout: 120000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-model-settings-empty-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const f = await inputFixture(t, { settingsRoot: directory });
  const tested = await f.call('/settings/model:test', { method: 'POST' });
  assert.equal(tested.response.status, 422);
  assert.equal(tested.body.error.code, 'MODEL_KEY_REQUIRED');
});
