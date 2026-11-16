import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, project } from './fixtures/storage-data.mjs';

test('project statistics are scoped, read-only and rejected for unknown projects', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const stats = await f.storage.request('getProjectStats', { projectId: p.projectId });
  assert.equal(stats.projectId, p.projectId);
  assert.equal(stats.members, 1);
  assert.equal(stats.runs.total, 1);
  assert.equal(stats.runs.active, 1);
  assert.equal(stats.runs.terminal, 0);
  assert.ok(stats.messages >= 1);
  assert.equal(stats.releases, 0);
  await assert.rejects(f.storage.request('getProjectStats', { projectId: 'prj_does_not_exist' }), error => error.code === 'RESOURCE_NOT_FOUND');
});

test('config export contains roles and registry bindings but no secret fields', async t => {
  const f = await fixture(t), p = await project(f.storage, f.root);
  const exported = await f.storage.request('getProjectConfigExport', { projectId: p.projectId });
  assert.equal(exported.projectId, p.projectId);
  assert.equal(exported.name, p.input.name);
  assert.deepEqual(exported.members, [{ principalId: 'user_1', role: 'owner' }]);
  assert.equal(exported.registry.generationId, null);
  assert.deepEqual(exported.registry.bindings, []);
  const text = JSON.stringify(exported);
  for (const forbidden of ['credentialRef', 'address', 'cardHash', 'secret', 'token']) assert.equal(text.includes(forbidden), false, forbidden);
});
