import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, content, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('content pins are idempotent, release without deleting and are counted by diagnostics', async t => {
  const f = await fixture(t), first = await content(f.storage, 'pinned content', f.root), second = await content(f.storage, 'other content', f.root);
  const key = meta('content.maintenance');
  const pinned = (await f.storage.request('pinContent', { meta: key, contentHash: first, reason: 'retained evidence' })).result;
  assert.equal(pinned.contentHash, first);
  const replay = (await f.storage.request('pinContent', { meta: key, contentHash: first, reason: 'retained evidence' })).result;
  assert.equal(replay.pinId, pinned.pinId);
  await rejects(f.storage.request('pinContent', { meta: key, contentHash: second, reason: 'retained evidence' }), 'IDEMPOTENCY_KEY_REUSED');
  let diagnostics = await f.storage.request('getStorageDiagnostics', {});
  assert.ok(diagnostics.contentObjects >= 2);
  assert.equal(diagnostics.activePins, 1);
  const active = await f.storage.request('listContentPins', { contentHash: first, activeOnly: true });
  assert.deepEqual(active.map(pin => pin.pinId), [pinned.pinId]);
  const released = (await f.storage.request('releaseContentPin', { meta: meta('content.maintenance'), pinId: pinned.pinId })).result;
  assert.ok(released.releasedAt);
  diagnostics = await f.storage.request('getStorageDiagnostics', {});
  assert.equal(diagnostics.activePins, 0);
  assert.equal(diagnostics.releasedPins, 1);
  assert.deepEqual(await f.storage.request('listContentPins', { contentHash: first, activeOnly: true }), []);
  assert.equal((await f.storage.request('listContentPins', { contentHash: first, activeOnly: false })).length, 1);
});
