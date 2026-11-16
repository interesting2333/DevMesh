import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, content, meta } from './fixtures/storage-data.mjs';

test('archive requests are idempotent, ACK leaves content intact and lost ACK keeps the request open', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root), hash = await content(f.storage, 'archived content', f.root), secondHash = await content(f.storage, 'lost ack content', f.root);
  const before = await f.storage.request('getStorageDiagnostics', {});
  const key = meta(p.projectId);
  const requested = (await f.storage.request('requestContentArchive', { meta: key, projectId: p.projectId, contentHash: hash })).result;
  assert.equal(requested.state, 'REQUESTED');
  const replay = (await f.storage.request('requestContentArchive', { meta: key, projectId: p.projectId, contentHash: hash })).result;
  assert.equal(replay.archiveId, requested.archiveId);
  const unacked = (await f.storage.request('requestContentArchive', { meta: meta(p.projectId), projectId: p.projectId, contentHash: secondHash })).result;
  const acked = (await f.storage.request('ackContentArchive', { meta: meta(p.projectId), archiveId: requested.archiveId })).result;
  assert.equal(acked.state, 'ACKED');
  assert.equal(acked.ackedBy, 'user_1');
  assert.ok(acked.ackedAt);
  const after = await f.storage.request('getStorageDiagnostics', {});
  assert.equal(after.contentObjects, before.contentObjects);
  assert.equal((await f.storage.request('getContentArchive', { archiveId: unacked.archiveId })).state, 'REQUESTED');
  const listed = await f.storage.request('listContentArchives', { projectId: p.projectId, limit: 10 });
  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map(entry => entry.state).sort(), ['ACKED', 'REQUESTED']);
});
