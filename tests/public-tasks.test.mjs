import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('public tasks enqueue idempotently, enforce principal quota and lease completion', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const firstKey = meta(p.projectId);
  const first = (await f.storage.request('enqueuePublicTask', { meta: firstKey, projectId: p.projectId, kind: 'review', payload: { id: 1 }, quota: 2 })).result;
  const replay = (await f.storage.request('enqueuePublicTask', { meta: firstKey, projectId: p.projectId, kind: 'review', payload: { id: 1 }, quota: 2 })).result;
  assert.equal(replay.taskKey, first.taskKey);
  await f.storage.request('enqueuePublicTask', { meta: meta(p.projectId), projectId: p.projectId, kind: 'review', payload: { id: 2 }, quota: 2 });
  await rejects(f.storage.request('enqueuePublicTask', { meta: meta(p.projectId), projectId: p.projectId, kind: 'review', payload: { id: 3 }, quota: 2 }), 'PUBLIC_QUOTA_EXCEEDED');
  const claimed = await f.storage.request('claimPublicTask', { meta: meta(p.projectId), workerId: 'worker.one', leaseMs: 30000 });
  assert.equal(claimed.state, 'LEASED');
  assert.equal(claimed.attempts, 1);
  await rejects(f.storage.request('completePublicTask', { meta: meta(p.projectId), taskKey: claimed.taskKey, workerId: 'worker.two', outcome: 'COMPLETED' }), 'PUBLIC_TASK_LEASE_INVALID');
  const done = (await f.storage.request('completePublicTask', { meta: meta(p.projectId), taskKey: claimed.taskKey, workerId: 'worker.one', outcome: 'COMPLETED' })).result;
  assert.equal(done.state, 'COMPLETED');
  await rejects(f.storage.request('completePublicTask', { meta: meta(p.projectId), taskKey: claimed.taskKey, workerId: 'worker.one', outcome: 'FAILED' }), 'PUBLIC_TASK_TERMINAL');
  await f.storage.request('enqueuePublicTask', { meta: meta(p.projectId), projectId: p.projectId, kind: 'review', payload: { id: 4 }, quota: 2 });
  const listed = await f.storage.request('listPublicTasks', { principalId: 'user_1', limit: 20 });
  assert.equal(listed.length, 3);
});

test('an expired public task lease can be reclaimed explicitly', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  await f.storage.request('enqueuePublicTask', { meta: meta(p.projectId), projectId: p.projectId, kind: 'review', payload: { id: 1 }, quota: 2 });
  const firstClaim = await f.storage.request('claimPublicTask', { meta: meta(p.projectId), workerId: 'worker.one', leaseMs: 1000 });
  const db = new DatabaseSync(f.options.databasePath);
  try { db.prepare("UPDATE public_tasks SET lease_until=? WHERE task_key=?").run(new Date(Date.now() - 60000).toISOString(), firstClaim.taskKey); }
  finally { db.close(); }
  const secondClaim = await f.storage.request('claimPublicTask', { meta: meta(p.projectId), workerId: 'worker.two', leaseMs: 30000 });
  assert.equal(secondClaim.taskKey, firstClaim.taskKey);
  assert.equal(secondClaim.leaseOwner, 'worker.two');
  assert.equal(secondClaim.attempts, 2);
});
