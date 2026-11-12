import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForProcessMessage, processTestTimeoutMs } from './fixtures/process.mjs';
import { mountPublicPrototype, parsePublicPrototypeConfig } from '../packages/a2a-adapter/dist/public-prototype.mjs';
import { probePrototype } from '../packages/a2a-adapter/examples/probe-client.mjs';
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from '../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/client/index.js';
import { SendMessageRequest, Role } from '../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/index.js';
const require = createRequire(new URL('../packages/a2a-adapter/package.json', import.meta.url)), express = require('express');
const alice = 'prototype-alice-test-only-token-0001', bob = 'prototype-bob-test-only-token-00002';
async function fixture(t, change = {}) {
  const app = express(); app.disable('x-powered-by'); app.disable('etag');
  const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { enabled: true, mode: 'loopback-protocol-prototype', publicBaseUrl: base, defaultEndpoint: 'team', endpoints: [
    { publicKey: 'reviewer', kind: 'agent', name: 'Review prototype', applicationVersion: '0.1.0' },
    { publicKey: 'team', kind: 'group', name: 'Team prototype', applicationVersion: '0.2.0' },
    { publicKey: 'public-probe', kind: 'agent', name: 'Public discovery prototype', applicationVersion: '0.1.0', publicCard: true }
  ], identities: [{ principalId: 'alice', credentialRef: 'alice', targets: ['reviewer', 'team', 'public-probe'] }, { principalId: 'bob', credentialRef: 'bob', targets: ['reviewer'] }], ...change };
  const mounted = await mountPublicPrototype(app, config.enabled ? config : { enabled: false }, async ref => ({ alice, bob })[ref]);
  const fetchAs = (path, token = alice, init = {}) => fetch(base + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const client = async (path = '/.well-known/agent-card.json', token = alice) => {
    const transport = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    return new ClientFactory({ cardResolver: new DefaultAgentCardResolver({ fetchImpl: transport }), transports: [new JsonRpcTransportFactory({ fetchImpl: transport })] }).createFromUrl(base, path);
  };
  return { app, server, base, config, mounted, fetchAs, client };
}
function params(data = { kind: 'devmesh.protocol-probe.v1', nonce: 'test_nonce' }) { return SendMessageRequest.fromJSON({ message: { messageId: randomUUID(), role: 'ROLE_USER', parts: [{ data }] } }); }

test('public prototype is disabled by default and refuses invalid/ambiguous startup before mounting', async t => {
  assert.deepEqual(parsePublicPrototypeConfig(), { enabled: false });
  const f = await fixture(t, { enabled: false, mode: undefined, publicBaseUrl: undefined, endpoints: undefined, defaultEndpoint: undefined, identities: undefined });
  assert.equal(f.mounted, undefined); assert.equal((await fetch(f.base + '/.well-known/agent-card.json')).status, 404);
  const valid = (await fixture(t)).config;
  for (const base of ['http://0.0.0.0:4320', 'https://127.0.0.1:4320', 'http://localhost:4320', 'http://127.0.0.1', 'http://127.0.0.1:4320/prefix', 'http://user@127.0.0.1:4320']) assert.throws(() => parsePublicPrototypeConfig({ ...valid, publicBaseUrl: base }));
  assert.throws(() => parsePublicPrototypeConfig({ ...valid, defaultEndpoint: 'missing' }));
  assert.throws(() => parsePublicPrototypeConfig({ ...valid, endpoints: [valid.endpoints[0], valid.endpoints[0]] }));
  assert.throws(() => parsePublicPrototypeConfig({ ...valid, identities: [{ ...valid.identities[0], targets: ['missing'] }] }));
  const app = express(), server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(mountPublicPrototype(app, valid, async () => undefined), /unavailable/);
  await assert.rejects(mountPublicPrototype(app, valid, async () => alice), /Ambiguous/);
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/.well-known/agent-card.json`)).status, 404);
});
test('single/group discovery has one well-known card, immutable trusted URLs and filtered catalog', async t => {
  const f = await fixture(t), card = await (await f.fetchAs('/.well-known/agent-card.json')).json();
  assert.equal(card.name, 'Team prototype'); assert.equal(card.version, '0.2.0'); assert.equal(card.supportedInterfaces.length, 1);
  assert.deepEqual(card.supportedInterfaces[0], { url: f.base + '/a2a/groups/team', protocolBinding: 'JSONRPC', protocolVersion: '1.0' });
  assert.equal(card.capabilities.streaming, true); assert.equal(card.skills[0].id, 'devmesh.protocol-probe.v1');
  assert.equal(card.securitySchemes.prototypeBearer.httpAuthSecurityScheme.scheme, 'Bearer');
  const agent = await (await f.fetchAs('/agents/reviewer/agent-card.json', alice, { headers: { 'X-Forwarded-Host': 'evil.invalid', 'X-Forwarded-Proto': 'https' } })).json();
  assert.equal(agent.supportedInterfaces[0].url, f.base + '/a2a/agents/reviewer');
  const serialized = JSON.stringify(card); for (const secret of ['credentialRef', 'principalId', 'topology', 'prompt', alice, bob]) assert.equal(serialized.includes(secret), false);
  const list = await (await f.fetchAs('/catalog/agents', bob)).json(); assert.deepEqual(list.endpoints.map(e => e.publicKey), ['reviewer']);
  assert.equal((await fetch(f.base + '/agents/public-probe/agent-card.json')).status, 200);
  assert.equal((await fetch(f.base + '/agents/reviewer/agent-card.json')).status, 401);
  assert.equal((await f.fetchAs('/groups/team/agent-card.json', bob)).status, 403);
  assert.equal((await f.fetchAs('/.well-known/agent-card.json', bob)).status, 403);
});
test('authentication, duplicate headers, origin and bounded body reject before protocol execution', async t => {
  const f = await fixture(t);
  for (const path of ['/catalog/agents', '/a2a/groups/team']) {
    assert.equal((await fetch(f.base + path, { method: path.startsWith('/a2a') ? 'POST' : 'GET' })).status, 401);
    assert.equal((await f.fetchAs(path, 'wrong-token'.repeat(4), { method: path.startsWith('/a2a') ? 'POST' : 'GET' })).status, 401);
  }
  assert.equal((await f.fetchAs('/catalog/agents', alice, { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  const raw = headers => new Promise((resolve, reject) => {
    const req = httpRequest(f.base + '/catalog/agents', { headers }, res => { res.resume(); res.once('end', () => resolve(res.statusCode)); }); req.once('error', reject); req.end();
  });
  assert.equal(await raw({ Host: 'evil.invalid', Authorization: 'Bearer ' + alice }), 403);
  assert.equal(await raw(['Host', new URL(f.base).host, 'Authorization', 'Bearer ' + alice, 'Authorization', 'Bearer ' + bob]), 401);
  const large = await f.fetchAs('/a2a/groups/team', alice, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(17000) }) });
  assert.equal(large.status, 413); assert.deepEqual(await large.json(), { error: 'PROTOTYPE_BODY_TOO_LARGE' });
  const malformed = await f.fetchAs('/a2a/groups/team', alice, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(malformed.status, 400); assert.deepEqual(await malformed.json(), { error: 'PROTOTYPE_REQUEST_INVALID' });
});
test('official JSON-RPC/SSE clients return immediate Message for agent and group; executable requests are refused', async t => {
  const f = await fixture(t);
  for (const path of ['/agents/reviewer/agent-card.json', '/groups/team/agent-card.json']) {
    const client = await f.client(path), p = params(), reply = await client.sendMessage(p);
    assert.equal(reply.role, Role.ROLE_AGENT); assert.equal(reply.taskId, ''); assert.equal(reply.parts[0].content.value.nonce, 'test_nonce');
    const events = []; for await (const event of client.sendMessageStream(p)) events.push(event);
    assert.equal(events.length, 1); assert.equal(events[0].payload.$case, 'message'); assert.deepEqual(events[0].payload.value.parts[0].content.value, reply.parts[0].content.value);
    await assert.rejects(client.sendMessage(params({ kind: 'devmesh.external-request.v1', prompt: 'Execute development' })), /business execution is disabled/);
    await assert.rejects(client.sendMessage(params({ kind: 'devmesh.protocol-probe.v1', nonce: 'valid', extra: true })), /Only devmesh/);
    await assert.rejects(client.getTask({ id: randomUUID() }), /not found/i);
    assert.deepEqual((await client.listTasks({ pageSize: 10 })).tasks, []);
  }
  await assert.rejects(f.client('/groups/team/agent-card.json', bob), /403/);
  const example = await probePrototype({ baseUrl: f.base, token: alice, nonce: 'example_was_executed' });
  assert.equal(example.reply.parts[0].content.value.nonce, 'example_was_executed'); assert.equal(example.streamed[0].payload.$case, 'message');
  await assert.rejects(probePrototype({ baseUrl: 'http://evil.invalid:4320', token: alice }), /loopback/);
});
test('documented prototype server starts with explicit test credentials and drains over IPC', { timeout: processTestTimeoutMs }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'devmesh-public-prototype-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const base = `http://127.0.0.1:${reservation.address().port}`; await new Promise(resolve => reservation.close(resolve));
  const config = { enabled: true, mode: 'loopback-protocol-prototype', publicBaseUrl: base, defaultEndpoint: 'team', endpoints: [{ publicKey: 'team', kind: 'group', name: 'Example team', applicationVersion: '0.1.0' }], identities: [{ principalId: 'example-client', credentialRef: 'CLIENT_TOKEN', targets: ['team'] }] };
  const path = join(directory, 'prototype.json'); writeFileSync(path, JSON.stringify(config));
  const child = fork(fileURLToPath(new URL('../packages/a2a-adapter/examples/prototype-server.mjs', import.meta.url)), ['--config', path], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [], env: { ...process.env, DEVMESH_PROTOTYPE_CLIENT_TOKEN: alice } });
  let output = '', errors = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { errors += value; });
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exit; });
  const ready = await waitForProcessMessage(child, 'Public prototype example', () => errors);
  assert.equal(ready.enterpriseAuthentication, 'NOT_CONFIGURED'); assert.equal(ready.businessExecution, 'DISABLED');
  assert.equal((await probePrototype({ baseUrl: base, token: alice })).reply.parts[0].content.value.publicKey, 'team');
  child.send({ type: 'shutdown' }); assert.equal(await exit, 0, errors); assert.equal(output.includes(alice), false);
  await assert.rejects(fetch(base + '/.well-known/agent-card.json'));
});
