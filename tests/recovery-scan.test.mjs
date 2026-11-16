import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture, project, planned, admission, meta } from './fixtures/storage-data.mjs';
import { RecoveryScan } from '../packages/platform-core/dist/index.mjs';

test('fresh storage reports no recovery work', async t => {
  const { storage } = await fixture(t);
  const state = await storage.request('getRecoveryState', {});
  assert.deepEqual(state, { controlRuns: [], activeAttempts: 0, unknownAttempts: 0, pendingOutbox: 0, leasedOutbox: 0, reconcileOutbox: 0, openPreparations: 0 });
});

test('manual pause survives a real Worker restart and the scan never reopens it', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  await f.storage.request('setControlIntent', { meta: meta(p.runId), runId: p.runId, ifMatch: '"r1"', action: 'pause' });
  const before = await f.storage.request('getRecoveryState', {});
  assert.equal(before.controlRuns[0].controlGate, 'PAUSED');
  await f.storage.close();
  const reopened = await f.reopen(), state = await reopened.request('getRecoveryState', {});
  assert.equal(state.controlRuns.length, 1);
  assert.equal(state.controlRuns[0].runId, p.runId);
  assert.equal(state.controlRuns[0].controlGate, 'PAUSED');
  assert.equal((await reopened.request('getRun', { runId: p.runId })).controlGate, 'PAUSED');
});

test('unknown attempt remains unknown across restart and is reported as recovery work', async t => {
  const f = await fixture(t), context = await planned(f.storage, f.root);
  const admitted = await f.storage.request('admitWorks', await admission(f.storage, context));
  const attemptId = admitted.result.attemptIds[0];
  await f.storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'RESERVED', state: 'OUTCOME_UNKNOWN' });
  await f.storage.close();
  const reopened = await f.reopen(), state = await reopened.request('getRecoveryState', {});
  assert.equal(state.unknownAttempts, 1);
  assert.equal(state.activeAttempts, 1);
  assert.equal((await reopened.request('getAttempt', { attemptId })).state, 'OUTCOME_UNKNOWN');
});

test('an expired Outbox lease is reported and moves to reconciliation', async t => {
  const f = await fixture(t);
  await project(f.storage, f.root);
  const first = await f.storage.request('claimOutbox', { workerId: 'worker.one', limit: 10, leaseMs: 30000 });
  assert.ok(first.length >= 1);
  const leased = await f.storage.request('getRecoveryState', {});
  assert.ok(leased.leasedOutbox >= 1);
  assert.equal(leased.pendingOutbox, 0);
  const db = new DatabaseSync(f.options.databasePath);
  try { db.prepare("UPDATE outbox SET lease_until=? WHERE lease_owner='worker.one'").run(new Date(Date.now() - 60000).toISOString()); }
  finally { db.close(); }
  const second = await f.storage.request('claimOutbox', { workerId: 'worker.two', limit: 10, leaseMs: 30000 });
  assert.equal(second.length, 0);
  const reconciled = await f.storage.request('getRecoveryState', {});
  assert.ok(reconciled.reconcileOutbox >= 1);
});

test('the platform scan is frozen and the original key still resolves after restart', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  await f.storage.close();
  const reopened = await f.reopen(), scan = new RecoveryScan(reopened), state = await scan.scan();
  assert.equal(Object.isFrozen(state), true);
  assert.deepEqual(state.controlRuns, []);
  const original = await reopened.request('lookupOperation', p.input.meta);
  assert.equal(original.operationId, p.receipt.operationId);
});
