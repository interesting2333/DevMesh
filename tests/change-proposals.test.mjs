import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const ifMatch = run => '"r' + run.resourceRevision + '"';

test('change proposal is source-unique and a current-basis confirmation is durable', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const run = await f.storage.request('getRun', { runId: p.runId });
  const proposed = (await f.storage.request('proposeChange', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), sourceMessageId: 'message_change_one', proposedText: '新增导出功能，并保留现有流程' })).result;
  assert.equal(proposed.state, 'PROPOSED');
  assert.match(proposed.basisHash, /^[0-9a-f]{64}$/);
  const duplicate = (await f.storage.request('proposeChange', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), sourceMessageId: 'message_change_one', proposedText: '新增导出功能，并保留现有流程' })).result;
  assert.equal(duplicate.changeId, proposed.changeId);
  const listed = await f.storage.request('listChanges', { runId: p.runId });
  assert.equal(listed.length, 1);
  const confirmed = (await f.storage.request('decideChange', { meta: meta(p.runId), changeId: proposed.changeId, action: 'confirm', basisHash: proposed.basisHash })).result;
  assert.equal(confirmed.state, 'CONFIRMED');
  assert.equal((await f.storage.request('getChange', { changeId: proposed.changeId })).state, 'CONFIRMED');
  await rejects(f.storage.request('decideChange', { meta: meta(p.runId), changeId: proposed.changeId, action: 'reject', basisHash: proposed.basisHash }), 'CHANGE_NOT_PROPOSED');
});

test('a decision based on an old run basis is rejected and leaves the proposal open', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  let run = await f.storage.request('getRun', { runId: p.runId });
  const proposed = (await f.storage.request('proposeChange', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), sourceMessageId: 'message_change_two', proposedText: '调整数据方案' })).result;
  await rejects(f.storage.request('decideChange', { meta: meta(p.runId), changeId: proposed.changeId, action: 'confirm', basisHash: 'f'.repeat(64) }), 'CHANGE_BASIS_SUPERSEDED');
  await f.storage.request('setControlIntent', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), action: 'pause' });
  run = await f.storage.request('getRun', { runId: p.runId });
  await rejects(f.storage.request('decideChange', { meta: meta(p.runId), changeId: proposed.changeId, action: 'confirm', basisHash: proposed.basisHash }), 'CHANGE_BASIS_SUPERSEDED');
  assert.equal((await f.storage.request('getChange', { changeId: proposed.changeId })).state, 'PROPOSED');
});
