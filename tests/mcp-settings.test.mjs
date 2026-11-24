import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMcpSettings } from '../packages/mcp-tools/dist/index.mjs';
import { inputFixture } from './fixtures/input-data.mjs';
import { httpFixture, prepareDispatch, holdTestGrant } from './fixtures/a2a-data.mjs';
import { AgentRuntime } from '../packages/agent-runtime/dist/index.mjs';

const credentialRef = 'mcp.fixture';
const secret = 'local-mcp-fixture-token';
const workTool = 'mcp_fixture__read_note';

async function service(t) {
  let revision = '1.0.0';
  const received = [];
  const calls = [];
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST') { response.writeHead(405).end(); return; }
    if (request.headers.authorization !== 'Bearer ' + secret) { response.writeHead(401).end(); return; }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { id, method, params } = JSON.parse(Buffer.concat(chunks).toString());
    if (id === undefined) { response.writeHead(202).end(); return; }
    const tool = { name: 'read_note', description: 'Read a fixture note', annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } }, required: ['name'] } };
    const write = { ...tool, name: 'write_note', annotations: { readOnlyHint: false } };
    let result;
    if (method === 'initialize') result = { protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: revision } };
    if (method === 'tools/list') {
      received.push(params?.cursor ?? null);
      result = params?.cursor ? { tools: [write] } : { tools: [tool], nextCursor: 'page2' };
    }
    if (method === 'tools/call') {
      calls.push(params);
      result = { content: [{ type: 'text', text: 'fixture-note-value ' + secret }] };
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { endpoint: 'http://127.0.0.1:' + server.address().port + '/mcp', received, calls, revise: () => { revision = '2.0.0'; } };
}

function configure(root, storage, endpoint) {
  return createMcpSettings(root, storage, [{ endpoint, credentialRef, readTools: ['read_note', 'write_note'] }],
    async ref => ref === credentialRef ? secret : undefined);
}

function draft(endpoint, projectId = 'project_fixture') {
  return { endpointId: 'fixture', displayName: 'Fixture MCP', endpoint, credentialRef,
    timeoutMs: 5000, projectId, repository: null };
}

test('MCP settings API protects configuration, paginates discovery and revalidates saved snapshots on restart', { timeout: 120000 }, async t => {
  const remote = await service(t);
  let settings;
  const access = { administrator: 'user_1', view: () => settings.view(), discover: (...args) => settings.discover(...args),
    save: (...args) => settings.save(...args), setEnabled: (...args) => settings.setEnabled(...args),
    remove: (...args) => settings.remove(...args) };
  const api = await inputFixture(t, { mcpSettings: access });
  const root = join(api.local.dataRoot, 'settings');
  settings = configure(root, api.storage, remote.endpoint);
  t.after(() => settings.close());
  const base = '/settings/mcp';
  const post = (path, body, method = 'POST') => api.call(base + path, { method,
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await api.call(base, { headers: { authorization: 'Bearer test_other' } })).response.status, 403);
  const index = await api.call(base);
  assert.deepEqual(index.body.policies.filter(policy => ['mcp.atlassian', 'mcp.linear', 'mcp.exa'].includes(policy.credentialRef)), [
    { endpoint: 'https://mcp.atlassian.com/v2/mcp?tools=all', credentialRef: 'mcp.atlassian' },
    { endpoint: 'https://mcp.linear.app/mcp/readonly', credentialRef: 'mcp.linear' },
    { endpoint: 'https://mcp.exa.ai/mcp', credentialRef: 'mcp.exa' }
  ]);
  const exa = { ...draft('https://mcp.exa.ai/mcp'), endpointId: 'exa', credentialRef: 'mcp.exa' };
  assert.equal((await post('/discover', exa)).body.errorCode, 'MCP_CREDENTIAL_UNAVAILABLE');
  assert.equal((await post('/discover', { ...exa, endpoint: exa.endpoint + '?tools=all' })).response.status, 422);
  assert.equal((await post('/discover', draft(remote.endpoint + '/other'))).body.errorCode, 'MCP_ENDPOINT_NOT_APPROVED');

  const discovered = await post('/discover', draft(remote.endpoint));
  assert.equal(discovered.body.ok, true, JSON.stringify(discovered.body));
  assert.deepEqual(remote.received, [null, 'page2']);
  assert.deepEqual(discovered.body.catalog.tools.map(tool => [tool.name, tool.eligible]), [['read_note', true], ['write_note', false]]);
  const input = { ...draft(remote.endpoint), enabled: true, allowedTools: ['read_note'], expectedSnapshotHash: discovered.body.catalog.snapshotHash };
  assert.equal((await post('', { ...input, allowedTools: ['write_note'] })).body.error.code, 'MCP_TOOL_APPROVAL_REQUIRED');
  assert.equal((await post('', input)).body.connections[0].status.state, 'PENDING_RESTART');
  assert.equal((await post('', input)).response.status, 409);
  await settings.close();

  settings = configure(root, api.storage, remote.endpoint);
  const startup = await settings.start(true);
  assert.deepEqual(startup.map(tool => tool.name), [workTool]);
  assert.equal(settings.view().connections[0].status.state, 'CONNECTED');
  const disabled = (await post('/fixture', { enabled: false }, 'PATCH')).body.connections[0];
  assert.equal(disabled.status.state, 'DISABLED');
  assert.deepEqual(disabled.allowedTools, ['read_note']);
  assert.equal(disabled.expectedSnapshotHash, input.expectedSnapshotHash);
  assert.equal(disabled.projectId, input.projectId);
  assert.equal((await startup[0].execute('unused', {}, {}, new AbortController().signal)).value.code, 'MCP_CONNECTION_DISABLED');
  assert.equal((await post('/fixture', { enabled: true }, 'PATCH')).body.error.code, 'MCP_TOOL_APPROVAL_REQUIRED');
  assert.equal((await post('/discover', draft(remote.endpoint))).body.ok, true);
  assert.equal((await post('/fixture', { enabled: true }, 'PATCH')).body.connections[0].status.state, 'PENDING_RESTART');
  assert.equal((await api.call(base + '/fixture', { method: 'DELETE' })).body.connections.length, 0);
  const file = await readFile(join(root, 'mcp.json'), 'utf8');
  assert.ok(!file.includes(secret));
  assert.deepEqual(JSON.parse(file).audit.map(event => [event.actor, event.action]), [
    ['user_1', 'ADD'], ['user_1', 'UPDATE'], ['user_1', 'UPDATE'], ['user_1', 'REMOVE']
  ]);
});

test('A2A work calls a standard MCP tool with project authority and stops on catalog drift', { timeout: 120000 }, async t => {
  const remote = await service(t);
  const fixture = await httpFixture(t);
  const settings = configure(join(fixture.local.dataRoot, 'settings'), fixture.storage, remote.endpoint);
  t.after(() => settings.close());
  const output = { schemaVersion: 'devmesh.development-result.v1', role: 'developer', baseCommit: 'b'.repeat(40), resultCommit: 'c'.repeat(40),
    changedFiles: [], checkRefs: [], unverified: ['Controlled model fixture'], handoffProposal: null };
  const work = await prepareDispatch(fixture, fixture.registry, { allowedTools: [workTool], outputSchemaId: output.schemaVersion });
  holdTestGrant(fixture, work.attemptId);
  const connection = draft(remote.endpoint, work.projectId);
  const discovered = await settings.discover('user_1', connection);
  assert.equal(discovered.ok, true, JSON.stringify(discovered));
  settings.save('user_1', { ...connection, enabled: true, allowedTools: ['read_note'], expectedSnapshotHash: discovered.catalog.snapshotHash });
  const tools = await settings.start(true);
  assert.equal(tools.length, 1);
  const requests = [];
  const provider = {
    config: { providerId: 'test.provider', endpoint: 'http://127.0.0.1:1', model: 'test.model', credentialRef: 'test.model', responseMode: 'json', requestTimeoutMs: 120000,
      capabilities: { revision: 'fixture', contextTokens: 32768, maxOutputTokens: 4096, toolCalls: true, structuredOutput: 'json-object',
        tokenCounting: 'utf8-conservative-v1', reasoningMode: 'disabled', verification: 'DECLARED' } },
    async complete(request) {
      requests.push(request);
      const first = requests.length === 1;
      return { requestId: 'fixture-' + requests.length, model: 'test.model', content: first ? '' : JSON.stringify(output),
        toolCalls: first ? [{ id: 'mcp_call', name: workTool, arguments: '{"name":"hello"}' }] : [],
        finishReason: first ? 'tool_calls' : 'stop', usage: { inputTokens: 10, outputTokens: 10, source: 'provider' }, cost: null };
    }
  };
  const runtime = new AgentRuntime(fixture.storage, fixture.content, [provider], tools);
  const accepted = await fixture.client.sendMessage(work.params);
  assert.ok(accepted.task?.id ?? accepted.id ?? accepted.result?.id);
  const [claim] = await fixture.storage.request('claimAcceptedWork', {
    endpointId: work.delegation.endpointId, workerId: 'runtime.standard-mcp.test', limit: 1
  });
  assert.ok(claim);
  const { endpointId, taskId, workerId, claimToken } = claim;
  const outcome = await runtime.execute({ endpointId, taskId, workerId, claimToken });
  assert.equal(outcome.state, 'completed', JSON.stringify(outcome));
  assert.deepEqual(remote.calls, [{ name: 'read_note', arguments: { name: 'hello' } }]);
  assert.equal(requests[0].tools[0].name, workTool);
  assert.deepEqual(Object.keys(requests[0].tools[0].parameters.properties), ['name']);
  const result = requests[1].messages.at(-1).content;
  assert.match(result, /fixture-note-value/);
  assert.ok(!result.includes(secret));
  await settings.close();
  remote.revise();
  const restarted = configure(join(fixture.local.dataRoot, 'settings'), fixture.storage, remote.endpoint);
  t.after(() => restarted.close());
  assert.deepEqual(await restarted.start(true), []);
  assert.equal(restarted.view().connections[0].status.state, 'REVIEW_REQUIRED');
});
