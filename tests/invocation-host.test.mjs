import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const request = projectId => ({ projectId, endpointId: 'agent.reviewer', endpointRevision: 1, registryGenerationId: 'gen_01', inputManifestHash: 'a'.repeat(64), definitionSnapshotHash: 'b'.repeat(64) });

test('invocation creation is idempotent for the same target and rejects a changed request', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root), key = meta(p.projectId);
  const created = (await f.storage.request('createInvocation', { meta: key, ...request(p.projectId) })).result;
  assert.equal(created.state, 'ACCEPTED');
  const replay = (await f.storage.request('createInvocation', { meta: key, ...request(p.projectId) })).result;
  assert.equal(replay.invocationId, created.invocationId);
  await rejects(f.storage.request('createInvocation', { meta: key, ...request(p.projectId), endpointId: 'agent.other' }), 'IDEMPOTENCY_KEY_REUSED');
  assert.equal((await f.storage.request('getInvocation', { invocationId: created.invocationId })).endpointId, 'agent.reviewer');
  assert.equal((await f.storage.request('listInvocations', { projectId: p.projectId })).length, 1);
});

test('invocation transitions are explicit and terminal states never change', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const created = (await f.storage.request('createInvocation', { meta: meta(p.projectId), ...request(p.projectId) })).result;
  await rejects(f.storage.request('transitionInvocation', { meta: meta(p.projectId), invocationId: created.invocationId, expectedState: 'ACCEPTED', state: 'COMPLETED' }), 'INVOCATION_TRANSITION_INVALID');
  await f.storage.request('transitionInvocation', { meta: meta(p.projectId), invocationId: created.invocationId, expectedState: 'ACCEPTED', state: 'WORKING' });
  const done = await f.storage.request('transitionInvocation', { meta: meta(p.projectId), invocationId: created.invocationId, expectedState: 'WORKING', state: 'COMPLETED' });
  assert.equal(done.result.state, 'COMPLETED');
  await rejects(f.storage.request('transitionInvocation', { meta: meta(p.projectId), invocationId: created.invocationId, expectedState: 'COMPLETED', state: 'WORKING' }), 'INVOCATION_TERMINAL');
  const canceled = (await f.storage.request('createInvocation', { meta: meta(p.projectId), ...request(p.projectId) })).result;
  await f.storage.request('transitionInvocation', { meta: meta(p.projectId), invocationId: canceled.invocationId, expectedState: 'ACCEPTED', state: 'CANCELED' });
  assert.equal((await f.storage.request('getInvocation', { invocationId: canceled.invocationId })).state, 'CANCELED');
});
