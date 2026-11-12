import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {previewHttpFixture} from './fixtures/preview-http.mjs';
import {gatewayConfiguration} from '../packages/preview-gateway/dist/index.mjs';
import {project} from './fixtures/storage-data.mjs';
const task = {title: 'Through original HTTPS preview', description: 'real template SQLite', status: 'todo'};
const requestOptions = (f, login, key = f.key(), input = task) => ({method: 'POST', headers: {cookie: login.cookie, origin: login.origin, 'content-type': 'application/json', 'idempotency-key': key}, body: JSON.stringify(input)});
test('preview origins use the private/public suffix boundary, with explicit local HTTPS and disabled defaults', () => {
  const base = {mode: 'shared', gatewayId: 'preview.gateway', principalId: 'preview.service', platformOrigin: 'https://control.example.com', previewBaseOrigin: 'https://apps.example.net'};
  assert.equal(gatewayConfiguration(base).config.enabled, false);
  for (const change of [{previewBaseOrigin: 'https://apps.example.com'}, {previewBaseOrigin: 'http://apps.example.net'}, {previewBaseOrigin: 'https://example.net'}, {platformOrigin: 'https://x.foo.github.io', previewBaseOrigin: 'https://apps.foo.github.io'}, {platformOrigin: 'https://control.invalid', previewBaseOrigin: 'https://apps.other.invalid'}]) assert.throws(() => gatewayConfiguration({...base, ...change}));
  assert.doesNotThrow(() => gatewayConfiguration({...base, platformOrigin: 'https://control.foo.github.io', previewBaseOrigin: 'https://apps.bar.github.io'}));
});
test('real HTTPS exchanges a purpose ticket once, scopes a host-only secure cookie and strips all upstream credentials', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login(), setCookie = login.response.headers['set-cookie'][0];
  for (const flag of ['Path=/', 'Secure', 'HttpOnly', 'SameSite=None']) assert.ok(setCookie.includes(flag));
  assert.equal(/Domain=/i.test(setCookie), false);
  assert.equal(login.response.headers['access-control-allow-origin'], f.gateway.config.platformOrigin);
  assert.equal(login.response.headers['access-control-allow-credentials'], 'true');
  assert.equal((await f.exchange(login.ticket)).status, 409);
  const preflight = await f.request(login.origin, '/__devmesh/preview/session', {method: 'OPTIONS', headers: {origin: f.gateway.config.platformOrigin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type'}});
  assert.equal(preflight.status, 204);
  const result = await f.request(login.origin, '/__test/echo', {headers: {cookie: login.cookie + '; platform_session=private', referer: f.gateway.config.platformOrigin + '/private', 'x-forwarded-host': 'control.devmesh.test', 'x-forwarded-for': 'internal'}});
  assert.equal(result.status, 200); assert.equal(result.headers['set-cookie'], undefined);
  const upstream = JSON.parse(result.body).headers;
  for (const name of ['cookie', 'authorization', 'origin', 'referer', 'x-forwarded-host', 'x-forwarded-for']) assert.equal(upstream[name], undefined);
  assert.match(upstream.host, /^127\.0\.0\.1:\d+$/);
  assert.match(result.headers['content-security-policy'], /worker-src 'none'/);
  assert.match(result.headers['content-security-policy'], /sandbox allow-scripts allow-forms allow-same-origin/);
  const badPurpose = await f.request(login.origin, '/api/tasks', {headers: {authorization: 'Bearer platform-token', cookie: login.cookie}}); assert.equal(badPurpose.status, 401);
  assert.equal((await f.request(login.origin, '/api/tasks', {headers: {cookie: '__Host-devmesh-preview=' + login.ticket.ticket}})).status, 401);
  const head = await f.request(login.origin, '/api/tasks', {method: 'HEAD', headers: {cookie: login.cookie}}); assert.equal(head.status, 200); assert.equal(head.body, '');
});
test('actual template CRUD binds original body and headers; a repeated unsafe key never sends HTTP twice', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login(), key = f.key(), options = requestOptions(f, login, key);
  const created = await f.request(login.origin, '/api/tasks', options); assert.equal(created.status, 201, created.body);
  const original = JSON.parse(created.body).task;
  const replay = await f.request(login.origin, '/api/tasks', options); assert.equal(replay.status, 409); assert.equal(JSON.parse(replay.body).state, 'FINISHED');
  assert.equal((await f.appStore.list()).tasks.length, 1);
  const conflict = await f.request(login.origin, '/api/tasks', requestOptions(f, login, key, {...task, title: 'changed'})); assert.equal(conflict.status, 409);
  const updated = await f.request(login.origin, '/api/tasks/' + original.id, {...requestOptions(f, login, f.key(), {...task, status: 'done'}), method: 'PUT', headers: {...requestOptions(f, login).headers, 'if-match': '"1"'}}); assert.equal(updated.status, 200, updated.body); assert.equal(JSON.parse(updated.body).task.revision, 2);
  const deleted = await f.request(login.origin, '/api/tasks/' + original.id, {method: 'DELETE', headers: {cookie: login.cookie, origin: login.origin, 'idempotency-key': f.key(), 'if-match': '"2"'}}); assert.equal(deleted.status, 200, deleted.body);
  assert.equal((await f.appStore.list()).tasks.length, 0);
  const rows = await f.rows(); assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.state === 'FINISHED' && /^[a-f0-9]{64}$/.test(JSON.parse(row.request_json).request.headersSha256)));
  assert.equal((await f.f.call('getPreviewWriteGate', f.f.data)).pendingWrites, 0);
});
test('cross-origin writes and missing keys never get a dispatch; closing the gate preserves safe reads only', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login();
  for (const origin of ['https://evil.test', f.gateway.config.platformOrigin, undefined]) {const options = requestOptions(f, login); options.headers.origin = origin; if (!origin) delete options.headers.origin; assert.equal((await f.request(login.origin, '/api/tasks', options)).status, 403);}
  const noKey = requestOptions(f, login); delete noKey.headers['idempotency-key']; assert.equal((await f.request(login.origin, '/api/tasks', noKey)).status, 428); assert.equal((await f.rows()).length, 0);
  const other = new URL(login.origin); other.hostname = 'p-' + 'a'.repeat(40) + '.apps.devmesh-app.test'; assert.equal((await f.request(other.origin, '/api/tasks', {headers: {cookie: login.cookie}})).status, 401);
  await f.f.close(f.f.closeRequest());
  assert.equal((await f.request(login.origin, '/api/tasks', requestOptions(f, login))).status, 409);
  assert.equal((await f.request(login.origin, '/api/tasks', {headers: {cookie: login.cookie}})).status, 200);
  assert.equal((await f.appStore.list()).tasks.length, 0);
});
test('a real committed SQLite write with a broken HTTP response remains UNKNOWN and cannot be replayed or drained by logout', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login(), options = requestOptions(f, login);
  const broken = await f.request(login.origin, '/__test/drop-after-write', options); assert.equal(broken.status, 502); assert.equal(JSON.parse(broken.body).error, 'PREVIEW_HTTP_OUTCOME_UNKNOWN');
  assert.equal((await f.appStore.list()).tasks.length, 1);
  const replay = await f.request(login.origin, '/__test/drop-after-write', options); assert.equal(replay.status, 409); assert.equal(JSON.parse(replay.body).state, 'UNKNOWN'); assert.equal(f.received.length, 1);
  await f.f.close(f.f.closeRequest());
  const logout = await f.request(login.origin, '/__devmesh/preview/logout', {method: 'POST', headers: {cookie: login.cookie, origin: login.origin}}); assert.equal(logout.status, 200);
  assert.equal((await f.f.call('getPreviewWriteGate', f.f.data)).pendingWrites, 1);
  assert.equal((await f.rows())[0].state, 'UNKNOWN');
  assert.equal((await f.request(login.origin, '/api/tasks', {headers: {cookie: login.cookie}})).status, 401);
});
test('a lost durable dispatch ACK causes zero business HTTP, and retry returns the original DISPATCHED record', {timeout: 90000}, async t => {
  let lost = true;
  const f = await previewHttpFixture(t, {storageWrap: storage => ({async request(method, input) {const result = await storage.request(method, input); if (method === 'beginPreviewAccessRequest' && lost) {lost = false; throw Error('explicit committed dispatch ACK loss');} return result;}})}), login = await f.login(), options = requestOptions(f, login);
  assert.equal((await f.request(login.origin, '/api/tasks', options)).status, 503);
  assert.equal((await f.appStore.list()).tasks.length, 0);
  const replay = await f.request(login.origin, '/api/tasks', options); assert.equal(replay.status, 409); assert.equal(JSON.parse(replay.body).state, 'DISPATCHED');
  assert.equal((await f.f.call('getPreviewWriteGate', f.f.data)).pendingWrites, 1);
});
test('revocation during actual upstream HTTP permits private completion accounting but withholds the response body', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login();
  const pending = f.request(login.origin, '/__test/revoke-in-flight', {headers: {cookie: login.cookie}});
  await f.waitForResponse;
  assert.equal((await f.request(login.origin, '/__devmesh/preview/logout', {method: 'POST', headers: {cookie: login.cookie, origin: login.origin}})).status, 200);
  f.releaseResponse(); const result = await pending;
  assert.equal(result.status, 401); assert.equal(result.body.includes('private in-flight body'), false);
  assert.equal((await f.rows())[0].state, 'FINISHED');
});
test('Runner original-instance mismatch never selects a replacement or arbitrary URL', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login();
  f.driver.containers.get(f.profile.containerName).containerId = 'f'.repeat(64);
  const result = await f.request(login.origin, '/api/tasks', requestOptions(f, login)); assert.equal(result.status, 502);
  assert.equal((await f.appStore.list()).tasks.length, 0);
  assert.equal((await f.rows()).length, 1);
  assert.equal((await f.rows())[0].state, 'NOT_SENT');
  assert.equal(f.driver.calls.filter(v => ['CREATE', 'START', 'NETWORK_CREATE'].includes(v)).length, 0);
});
test('Runner final authorization denial records definite no-send without changing business data', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t, {transportWrap: transport => ({configured: transport.configured, forward: input => transport.forward({...input, authorize: async () => false})})}), login = await f.login();
  const result = await f.request(login.origin, '/api/tasks', requestOptions(f, login)); assert.equal(result.status, 502);
  assert.equal((await f.appStore.list()).tasks.length, 0); assert.equal((await f.rows())[0].state, 'NOT_SENT');
  assert.equal((await f.f.call('getPreviewWriteGate', f.f.data)).pendingWrites, 0);
});
test('an actual short session expires over HTTPS without extending its lifetime or dispatching a read', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t, {gatewayOptions: {sessionTtlMs: 5000}}), login = await f.login();
  await delay(Math.max(0, Date.parse(login.ticket.sessionExpiresAt) - Date.now() + 25));
  const expired = await f.request(login.origin, '/api/tasks', {headers: {cookie: login.cookie}});
  assert.equal(expired.status, 401); assert.equal(JSON.parse(expired.body).error, 'PREVIEW_CREDENTIAL_EXPIRED');
  assert.equal((await f.rows()).length, 0);
});
test('another project member cannot acquire this preview and actual HTTPS rechecks viewer demotion and membership revocation', {timeout: 90000}, async t => {
  const f = await previewHttpFixture(t), login = await f.login(), principalId = 'other.preview.project.member';
  const other = await project({request: (method, input) => f.f.call(method, input)}, undefined, {meta: {principalId, scopeId: 'creation.other.preview.project.member', idempotencyKey: f.key()}});
  assert.notEqual(other.projectId, f.f.p.projectId);
  await assert.rejects(f.gateway.issueForMember({principalId, runId: f.f.p.runId, previewId: f.f.p.previewId}), {code: 'PREVIEW_NOT_FOUND'});
  // Explicit trusted-administration fixture: change only membership while the
  // Worker is idle. This does not claim a production membership-management API.
  const change = (sql, ...args) => {const db = new DatabaseSync(join(f.f.root, 'access.sqlite')); try {db.exec('PRAGMA foreign_keys=ON'); db.prepare(sql).run(...args);} finally {db.close();}};
  change("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id=?", f.f.p.projectId, 'user_1');
  assert.equal((await f.request(login.origin, '/api/tasks', requestOptions(f, login))).status, 403);
  assert.equal((await f.request(login.origin, '/api/tasks', {headers: {cookie: login.cookie}})).status, 200);
  change('DELETE FROM project_members WHERE project_id=? AND principal_id=?', f.f.p.projectId, 'user_1');
  assert.equal((await f.request(login.origin, '/api/tasks', {headers: {cookie: login.cookie}})).status, 404);
  assert.equal((await f.rows()).length, 1); assert.equal((await f.appStore.list()).tasks.length, 0);
});
