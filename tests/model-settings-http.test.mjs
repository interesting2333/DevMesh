import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inputFixture } from './fixtures/input-data.mjs';

test('full completion addresses and legacy stored values use one API base without rewriting credentials',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'devmesh-model-endpoint-')),paths=[],provider=createServer((req,res)=>{paths.push(req.url);assert.equal(req.headers.authorization,'Bearer fixture-secret');res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'fixture-model'}]}));});provider.listen(0,'127.0.0.1');await once(provider,'listening');t.after(async()=>{provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve));rmSync(directory,{recursive:true,force:true});});
 const f=await inputFixture(t,{settingsRoot:directory}),base='http://127.0.0.1:'+provider.address().port+'/v1',full=base+'/chat/completions/';const saved=await f.call('/settings/model',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({providerId:'fixture',endpoint:full,model:'fixture-model',apiKey:'fixture-secret'})});assert.equal(saved.response.status,200);assert.equal(saved.body.endpoint,base);
 const legacy={...JSON.parse(readFileSync(join(directory,'model.json'),'utf8')),endpoint:full};writeFileSync(join(directory,'model.json'),JSON.stringify(legacy));const secret=readFileSync(join(directory,'model-secret.json'),'utf8');assert.equal((await f.call('/settings/model')).body.endpoint,base);assert.equal((await f.call('/settings/model:test',{method:'POST'})).body.ok,true);const listed=await f.call('/settings/model:models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({providerId:'fixture',endpoint:full})});assert.equal(listed.body.ok,true);assert.deepEqual(paths,['/v1/models','/v1/models']);assert.deepEqual(JSON.parse(readFileSync(join(directory,'model.json'),'utf8')),legacy);assert.equal(readFileSync(join(directory,'model-secret.json'),'utf8'),secret);
});

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

test('model discovery supports unsaved credentials, filters IDs, and scopes reuse to the saved connection', { timeout: 120000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-model-discovery-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const requests = [];
  const provider = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data: [{ id: 'vendor-chat-pro' }, { id: 'reasoner-v2' }, { id: 'vendor-chat-pro' }, { id: 'sk-test-secret' }, { id: '<script>' }, { id: 'x'.repeat(129) }, { id: 'vendor/unsupported' }, { id: 5 }, null] }));
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const endpoint = `http://127.0.0.1:${provider.address().port}/v1`;
  const f = await inputFixture(t, { settingsRoot: directory });
  const discover = body => f.call('/settings/model:models', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const draft = await discover({ providerId: 'proxy', endpoint, apiKey: 'sk-test-secret' });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.body));
  assert.equal(draft.body.ok, true);
  assert.deepEqual(draft.body.models, ['vendor-chat-pro', 'reasoner-v2']);
  assert.equal(JSON.stringify(draft.body).includes('sk-test-secret'), false);
  assert.deepEqual(requests, [{ url: '/v1/models', authorization: 'Bearer sk-test-secret' }]);
  assert.equal(existsSync(join(directory, 'model.json')), false);
  assert.equal(existsSync(join(directory, 'model-secret.json')), false);
  const saved = await f.call('/settings/model', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: 'proxy', endpoint, model: 'vendor-chat-pro', apiKey: 'sk-test-secret' }) });
  assert.equal(saved.response.status, 200);
  const before = readFileSync(join(directory, 'model.json'), 'utf8');
  assert.equal((await discover({ providerId: 'proxy', endpoint: endpoint + '/' })).body.ok, true);
  const count = requests.length;
  for (const body of [{ providerId: 'other', endpoint }, { providerId: 'proxy', endpoint: endpoint + '/other' }]) {
    const rejected = await discover(body);
    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.body.error.code, 'MODEL_KEY_REQUIRED');
  }
  const invalid = await discover({ providerId: 'proxy', endpoint: 'http://example.com', apiKey: 'sk-test-secret' });
  assert.equal(invalid.body.error.code, 'MODEL_ENDPOINT_INVALID');
  assert.equal(requests.length, count);
  assert.equal(readFileSync(join(directory, 'model.json'), 'utf8'), before);
});

test('model discovery handles failures, malformed or oversized lists and redirects without echoing provider bodies', { timeout: 120000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-model-errors-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let mode = 'denied', redirected = 0;
  const target = createServer((_request, response) => { redirected++; response.end('{}'); });
  target.listen(0, '127.0.0.1');
  await once(target, 'listening');
  t.after(() => new Promise(resolve => target.close(resolve)));
  const provider = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    if (mode === 'redirect') { response.writeHead(302, { location: `http://127.0.0.1:${target.address().port}/models` }); response.end(); }
    else if (mode === 'denied') { response.writeHead(401); response.end('sk-sensitive-provider-body'); }
    else if (mode === 'malformed') response.end('sk-sensitive-provider-body');
    else if (mode === 'invalid') response.end(JSON.stringify({ error: 'sk-sensitive-provider-body' }));
    else if (mode === 'large') response.end(' '.repeat(1024 * 1024 + 1));
    else if (mode !== 'timeout') response.end(JSON.stringify({ data: [] }));
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  t.after(() => new Promise(resolve => provider.close(resolve)));
  const f = await inputFixture(t, { settingsRoot: directory });
  for (const value of ['denied', 'malformed', 'invalid', 'large', 'redirect', 'empty', 'timeout']) {
    mode = value;
    const started = Date.now();
    const result = await f.call('/settings/model:models', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerId: 'proxy', endpoint: `http://127.0.0.1:${provider.address().port}`, apiKey: 'sk-sensitive' }) });
    assert.equal(result.response.status, 200, value);
    assert.equal(result.body.ok, value === 'empty', value);
    assert.deepEqual(result.body.models, [], value);
    assert.equal(JSON.stringify(result.body).includes('sk-sensitive'), false, value);
    if (value === 'timeout') assert(Date.now() - started < 10000);
  }
  assert.equal(redirected, 0);
  assert.equal(existsSync(join(directory, 'model.json')), false);
});
