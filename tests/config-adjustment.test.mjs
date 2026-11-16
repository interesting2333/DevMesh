import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const ifMatch = run => '"r' + run.resourceRevision + '"';

test('config adjustment requires a paused Run, uses generation CAS and keeps the Run paused across restart', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  let run = await f.storage.request('getRun', { runId: p.runId });
  await rejects(f.storage.request('proposeConfigAdjustment', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), config: { model: 'next' } }), 'CONFIG_REQUIRES_PAUSED');
  await f.storage.request('setControlIntent', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), action: 'pause' });
  run = await f.storage.request('getRun', { runId: p.runId });
  const generation = (await f.storage.request('getConfigGeneration', {})).generation;
  const first = (await f.storage.request('proposeConfigAdjustment', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), config: { model: 'next' } })).result;
  assert.equal(first.baseGeneration, generation);
  const second = (await f.storage.request('proposeConfigAdjustment', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), config: { model: 'later' } })).result;
  const confirmed = (await f.storage.request('confirmConfigAdjustment', { meta: meta(p.runId), adjustmentId: first.adjustmentId })).result;
  assert.equal(confirmed.state, 'CONFIRMED');
  assert.equal(confirmed.appliedGeneration, generation);
  assert.equal((await f.storage.request('getConfigGeneration', {})).generation, generation + 1);
  assert.equal((await f.storage.request('getRun', { runId: p.runId })).controlGate, 'PAUSED');
  await rejects(f.storage.request('confirmConfigAdjustment', { meta: meta(p.runId), adjustmentId: second.adjustmentId }), 'CONFIG_BASIS_SUPERSEDED');
  await f.storage.close();
  const reopened = await f.reopen();
  assert.equal((await reopened.request('getRun', { runId: p.runId })).controlGate, 'PAUSED');
  assert.equal((await reopened.request('getConfigGeneration', {})).generation, generation + 1);
  assert.equal((await reopened.request('getConfigAdjustment', { adjustmentId: first.adjustmentId })).state, 'CONFIRMED');
});
