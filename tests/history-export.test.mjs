import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, meta } from './fixtures/storage-data.mjs';

test('history export honors cutoff and flags incomplete data without inventing records', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const active = await f.storage.request('exportProjectHistory', { projectId: p.projectId });
  assert.equal(active.complete, false);
  assert.deepEqual(active.missing, ['ACTIVE_RUNS_AT_CUTOFF']);
  assert.equal(active.runs.length, 1);
  assert.ok(active.counts.messages >= 1);
  const empty = await f.storage.request('exportProjectHistory', { projectId: p.projectId, cutoffAt: '2000-01-01T00:00:00.000Z' });
  assert.equal(empty.complete, false);
  assert.deepEqual(empty.missing, ['NO_RUNS_BEFORE_CUTOFF']);
  assert.deepEqual(empty.runs, []);
  assert.deepEqual(empty.counts, { messages: 0, artifacts: 0, releases: 0 });
  const run = await f.storage.request('getRun', { runId: p.runId });
  await f.storage.request('finishRun', { meta: meta(p.runId), runId: p.runId, ifMatch: '"r' + run.resourceRevision + '"', outcome: 'FAILED', reason: 'history test' });
  const terminal = await f.storage.request('exportProjectHistory', { projectId: p.projectId });
  assert.equal(terminal.complete, true);
  assert.deepEqual(terminal.missing, []);
  assert.equal(terminal.runs[0].outcome, 'FAILED');
  await assert.rejects(f.storage.request('exportProjectHistory', { projectId: 'prj_missing' }), error => error.code === 'RESOURCE_NOT_FOUND');
});
