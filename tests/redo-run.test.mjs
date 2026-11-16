import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const ifMatch = run => '"r' + run.resourceRevision + '"';

test('redo creates one fresh Run from a failed Run without copying plan or diff', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  let run = await f.storage.request('getRun', { runId: p.runId });
  await rejects(f.storage.request('redoRun', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), redoReviewHash: 'a'.repeat(64) }), 'REDO_REQUIRES_TERMINAL');
  await f.storage.request('finishRun', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), outcome: 'FAILED', reason: 'build failed' });
  run = await f.storage.request('getRun', { runId: p.runId });
  const redoMeta = meta(p.runId);
  const redo = (await f.storage.request('redoRun', { meta: redoMeta, runId: p.runId, ifMatch: ifMatch(run), redoReviewHash: 'b'.repeat(64) })).result;
  assert.notEqual(redo.newRunId, p.runId);
  const fresh = await f.storage.request('getRun', { runId: redo.newRunId });
  assert.equal(fresh.phase, 'PREPARING');
  assert.equal(fresh.controlGate, 'OPEN');
  assert.equal(fresh.currentPlanRevision, null);
  assert.equal(fresh.currentRequirementRevision, null);
  assert.equal(fresh.terminalOutcome, null);
  const db = new DatabaseSync(f.options.databasePath);
  try {
    const row = db.prepare('SELECT origin_run_id, task_id FROM runs WHERE run_id=?').get(redo.newRunId);
    assert.equal(row.origin_run_id, p.runId);
    assert.equal(row.task_id, p.taskId);
    assert.equal(db.prepare('SELECT count(*) n FROM run_redos WHERE source_run_id=?').get(p.runId).n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM work_revisions WHERE run_id=?').get(redo.newRunId).n, 0);
  } finally { db.close(); }
  const replay = (await f.storage.request('redoRun', { meta: redoMeta, runId: p.runId, ifMatch: ifMatch(run), redoReviewHash: 'b'.repeat(64) })).result;
  assert.equal(replay.newRunId, redo.newRunId);
  await rejects(f.storage.request('redoRun', { meta: meta(redo.newRunId), runId: redo.newRunId, ifMatch: '"r1"', redoReviewHash: 'c'.repeat(64) }), 'REDO_REQUIRES_TERMINAL');
  await rejects(f.storage.request('redoRun', { meta: meta(p.runId), runId: p.runId, ifMatch: ifMatch(run), redoReviewHash: 'd'.repeat(64) }), 'ACTIVE_RUN_EXISTS');
});
