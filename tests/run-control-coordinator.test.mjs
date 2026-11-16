import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, planned, admission, meta } from './fixtures/storage-data.mjs';
import { RunControlCoordinator } from '../packages/platform-core/dist/index.mjs';

async function paused(t) {
  const f = await fixture(t), context = await planned(f.storage, f.root);
  const admitted = await f.storage.request('admitWorks', await admission(f.storage, context));
  const attemptId = admitted.result.attemptIds[0];
  const run = await f.storage.request('getRun', { runId: context.runId });
  await f.storage.request('pauseRun', { meta: meta(context.runId), runId: context.runId, controlRevision: run.controlRevision });
  return { ...f, context, attemptId };
}

test('coordinator releases each target once and finishes pause only after storage sees no unresolved targets', async t => {
  const f = await paused(t), calls = [];
  const backend = { configured: true, async stop(target) { calls.push(['stop', target.targetKind, target.targetId]); return { state: 'RELEASED', evidence: { instance: 'controlled-backend' } }; } };
  const coordinator = new RunControlCoordinator(f.storage, backend, { principalId: 'coordinator.local' });
  await coordinator.tick();
  assert.deepEqual(calls, [['stop', 'ATTEMPT', f.attemptId]]);
  const status = await f.storage.request('getControlStatus', { runId: f.context.runId });
  assert.equal(status.controlGate, 'PAUSED');
  assert.deepEqual(status.unresolved, []);
  assert.equal((await f.storage.request('listControlTargets', { runId: f.context.runId }))[0].state, 'RELEASED');
});

test('unknown target is inspected, never stopped twice, and only then completes pause', async t => {
  const f = await paused(t), calls = [];
  const backend = {
    configured: true,
    async stop(target) { calls.push('stop'); return { state: 'UNKNOWN', evidence: { reason: 'lost-ack' } }; },
    async inspect(target) { calls.push('inspect'); assert.equal(target.targetId, f.attemptId); return { state: 'RELEASED' }; }
  };
  const coordinator = new RunControlCoordinator(f.storage, backend, { principalId: 'coordinator.local' });
  await coordinator.tick();
  let status = await f.storage.request('getControlStatus', { runId: f.context.runId });
  assert.equal(status.controlGate, 'PAUSING');
  assert.equal(status.unresolved[0].state, 'UNKNOWN');
  await coordinator.tick();
  status = await f.storage.request('getControlStatus', { runId: f.context.runId });
  assert.equal(status.controlGate, 'PAUSED');
  assert.deepEqual(calls, ['stop', 'inspect']);
});

test('unconfigured backend never stops or advances a paused run', async t => {
  const f = await paused(t), calls = [];
  const backend = { configured: false, async stop() { calls.push('stop'); return { state: 'RELEASED' }; } };
  const coordinator = new RunControlCoordinator(f.storage, backend, { principalId: 'coordinator.local' });
  await coordinator.tick();
  assert.deepEqual(calls, []);
  const status = await f.storage.request('getControlStatus', { runId: f.context.runId });
  assert.equal(status.controlGate, 'PAUSING');
  assert.equal(status.unresolved[0].state, 'PENDING');
});

test('failed material save retries only the save and never repeats the stop action', async t => {
  const f = await paused(t);
  let stops = 0, records = 0, failures = 1;
  const flaky = {
    async request(method, input) {
      if (method === 'recordControlTarget') {
        records++;
        if (failures-- > 0) throw Object.assign(new Error('lost save ack'), { code: 'STORAGE_UNAVAILABLE' });
      }
      return f.storage.request(method, input);
    }
  };
  const backend = { configured: true, async stop() { stops++; return { state: 'RELEASED' }; } };
  const coordinator = new RunControlCoordinator(flaky, backend, { principalId: 'coordinator.local', saveRetries: 1 });
  await coordinator.tick();
  assert.equal(stops, 1);
  assert.equal(records, 2);
  assert.equal((await f.storage.request('getControlStatus', { runId: f.context.runId })).controlGate, 'PAUSED');
});

test('cancelling run releases targets but waits for the explicit finishRun decision', async t => {
  const f = await fixture(t), context = await planned(f.storage, f.root);
  const admitted = await f.storage.request('admitWorks', await admission(f.storage, context));
  const attemptId = admitted.result.attemptIds[0], run = await f.storage.request('getRun', { runId: context.runId });
  await f.storage.request('cancelRun', { meta: meta(context.runId), runId: context.runId, controlRevision: run.controlRevision, impactReviewHash: 'a'.repeat(64) });
  const backend = { configured: true, async stop() { return { state: 'RELEASED' }; } };
  const coordinator = new RunControlCoordinator(f.storage, backend, { principalId: 'coordinator.local' });
  await coordinator.tick();
  let status = await f.storage.request('getControlStatus', { runId: context.runId });
  assert.equal(status.controlGate, 'CANCELLING');
  assert.deepEqual(status.unresolved, []);
  await f.storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'RESERVED', state: 'STOPPING' });
  await f.storage.request('transitionAttempt', { meta: meta(context.runId), runId: context.runId, attemptId, expectedState: 'STOPPING', state: 'CANCELLED' });
  const current = await f.storage.request('getRun', { runId: context.runId });
  const done = await f.storage.request('finishRun', { meta: meta(context.runId), runId: context.runId, ifMatch: '"r' + current.resourceRevision + '"', outcome: 'CANCELLED', reason: 'operator cancelled' });
  assert.equal(done.result.terminalOutcome, 'CANCELLED');
});
