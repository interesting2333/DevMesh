import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, planned, admission, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('pause records per-target cleanup, finish derives recovery review and resume reopens only with the exact hash', async t => {
  const { storage, root } = await fixture(t), context = await planned(storage, root);
  const admitted = await storage.request('admitWorks', await admission(storage, context));
  const attemptId = admitted.result.attemptIds[0];
  let current = await storage.request('getRun', { runId: context.runId });
  await rejects(storage.request('pauseRun', { meta: meta(context.runId), runId: context.runId, controlRevision: current.controlRevision + 1 }), 'CONTROL_REVISION_CONFLICT');
  const paused = await storage.request('pauseRun', { meta: meta(context.runId), runId: context.runId, controlRevision: current.controlRevision });
  assert.equal(paused.result.controlGate, 'PAUSING');
  assert.equal(paused.result.runEpoch, current.runEpoch + 1);
  const targets = await storage.request('listControlTargets', { runId: context.runId });
  assert.deepEqual(targets.map(target => [target.targetKind, target.targetId, target.state]), [['ATTEMPT', attemptId, 'PENDING']]);
  await storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'RESERVED', state: 'STOPPING' });
  await rejects(storage.request('finishControl', { meta: meta(context.runId), runId: context.runId, controlRevision: paused.result.controlRevision, outcome: 'PAUSED' }), 'CONTROL_TARGETS_UNRESOLVED');
  await storage.request('recordControlTarget', { meta: meta(context.runId), runId: context.runId, targetKind: 'ATTEMPT', targetId: attemptId, state: 'SAVED', evidence: { materialKey: 'attempt-output' } });
  await storage.request('recordControlTarget', { meta: meta(context.runId), runId: context.runId, targetKind: 'ATTEMPT', targetId: attemptId, state: 'RELEASED' });
  await storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'STOPPING', state: 'CANCELLED' });
  const finished = await storage.request('finishControl', { meta: meta(context.runId), runId: context.runId, controlRevision: paused.result.controlRevision, outcome: 'PAUSED' });
  assert.equal(finished.result.controlGate, 'PAUSED');
  assert.match(finished.result.recoveryReviewHash, /^[0-9a-f]{64}$/);
  current = await storage.request('getRun', { runId: context.runId });
  await rejects(storage.request('resumeRun', { meta: meta(context.runId), runId: context.runId, controlRevision: current.controlRevision, recoveryReviewHash: 'f'.repeat(64) }), 'CONTROL_RECOVERY_REVIEW_CHANGED');
  const resumed = await storage.request('resumeRun', { meta: meta(context.runId), runId: context.runId, controlRevision: current.controlRevision, recoveryReviewHash: finished.result.recoveryReviewHash });
  assert.equal(resumed.result.controlGate, 'OPEN');
  assert.equal(resumed.result.runEpoch, current.runEpoch + 1);
});

test('cancel intent cannot be overwritten by pause and cancellation waits for resolved targets', async t => {
  const { storage, root } = await fixture(t), context = await planned(storage, root);
  const admitted = await storage.request('admitWorks', await admission(storage, context));
  const attemptId = admitted.result.attemptIds[0];
  const before = await storage.request('getRun', { runId: context.runId });
  const cancelled = await storage.request('cancelRun', { meta: meta(context.runId), runId: context.runId, controlRevision: before.controlRevision, impactReviewHash: 'a'.repeat(64) });
  assert.equal(cancelled.result.controlGate, 'CANCELLING');
  await rejects(storage.request('pauseRun', { meta: meta(context.runId), runId: context.runId, controlRevision: cancelled.result.controlRevision }), 'CANCEL_INTENT_SAVED');
  const ifMatch = async () => '"r' + (await storage.request('getRun', { runId: context.runId })).resourceRevision + '"';
  await rejects(storage.request('finishRun', { meta: meta(context.runId), runId: context.runId, ifMatch: await ifMatch(), outcome: 'CANCELLED', reason: 'operator cancelled' }), 'ACTIVE_ATTEMPT_EXISTS');
  await storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'RESERVED', state: 'STOPPING' });
  await storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'STOPPING', state: 'CANCELLED' });
  await rejects(storage.request('finishRun', { meta: meta(context.runId), runId: context.runId, ifMatch: await ifMatch(), outcome: 'CANCELLED', reason: 'operator cancelled' }), 'CONTROL_TARGETS_UNRESOLVED');
  await storage.request('recordControlTarget', { meta: meta(context.runId), runId: context.runId, targetKind: 'ATTEMPT', targetId: attemptId, state: 'RELEASED' });
  const done = await storage.request('finishRun', { meta: meta(context.runId), runId: context.runId, ifMatch: await ifMatch(), outcome: 'CANCELLED', reason: 'operator cancelled' });
  assert.equal(done.result.terminalOutcome, 'CANCELLED');
});
