import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project, meta } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
const card = { name: 'Reviewer', description: 'External review agent', version: '1.0.0', skills: ['review', 'summarize'] };

test('agent exposure follows an explicit lifecycle and catalog hides retired entries', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  await rejects(f.storage.request('createExposureDraft', { meta: meta(p.projectId), projectId: p.projectId, agentKey: 'reviewer.v1', card: { ...card, skills: ['review', 'review'] } }), 'EXPOSURE_CARD_CHANGED');
  const draft = (await f.storage.request('createExposureDraft', { meta: meta(p.projectId), projectId: p.projectId, agentKey: 'reviewer.v1', card })).result;
  assert.equal(draft.state, 'DRAFT');
  await rejects(f.storage.request('createExposureDraft', { meta: meta(p.projectId), projectId: p.projectId, agentKey: 'reviewer.v1', card }), 'EXPOSURE_DUPLICATE');
  await rejects(f.storage.request('publishExposure', { meta: meta(p.projectId), exposureId: draft.exposureId }), 'EXPOSURE_STATE_INVALID');
  const validated = (await f.storage.request('validateExposure', { meta: meta(p.projectId), exposureId: draft.exposureId })).result;
  assert.equal(validated.state, 'VALIDATED');
  const published = (await f.storage.request('publishExposure', { meta: meta(p.projectId), exposureId: draft.exposureId })).result;
  assert.equal(published.state, 'PUBLISHED');
  assert.ok(published.publishedAt);
  assert.equal(published.revision, 2);
  let catalog = await f.storage.request('getExposureCatalog', { projectId: p.projectId });
  assert.deepEqual(catalog.map(entry => entry.exposureId), [draft.exposureId]);
  await f.storage.request('drainExposure', { meta: meta(p.projectId), exposureId: draft.exposureId });
  catalog = await f.storage.request('getExposureCatalog', { projectId: p.projectId });
  assert.equal(catalog[0].state, 'DRAINING');
  await f.storage.request('retireExposure', { meta: meta(p.projectId), exposureId: draft.exposureId });
  assert.deepEqual(await f.storage.request('getExposureCatalog', { projectId: p.projectId }), []);
  assert.equal((await f.storage.request('getExposure', { exposureId: draft.exposureId })).state, 'RETIRED');
});
