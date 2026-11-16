import test from 'node:test';
import assert from 'node:assert/strict';
import {inputFixture} from './fixtures/input-data.mjs';

test('project stats and config export HTTP are scoped and secret-free',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,projectId=p.projectId;
  const stats=await f.call(`/projects/${projectId}/stats`);
  assert.equal(stats.response.status,200);
  assert.equal(stats.body.projectId,projectId);
  assert.equal(stats.body.members,1);
  assert.equal(stats.body.runs.total,1);
  const exported=await f.call(`/projects/${projectId}/config-export`);
  assert.equal(exported.response.status,200);
  assert.equal(exported.body.projectId,projectId);
  assert.deepEqual(exported.body.members,[{principalId:'user_1',role:'owner'}]);
  const text=JSON.stringify(exported.body);
  for(const forbidden of ['credentialRef','address','cardHash','secret','token'])assert.equal(text.includes(forbidden),false,forbidden);
});