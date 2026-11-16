import test from 'node:test';
import assert from 'node:assert/strict';
import {inputFixture} from './fixtures/input-data.mjs';

test('history export HTTP honors cutoff and reports incomplete data',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,projectId=p.projectId;
  const active=await f.call(`/projects/${projectId}/history-export`);
  assert.equal(active.response.status,200);
  assert.equal(active.body.complete,false);
  assert.deepEqual(active.body.missing,['ACTIVE_RUNS_AT_CUTOFF']);
  assert.equal(active.body.runs.length,1);
  const empty=await f.call(`/projects/${projectId}/history-export?cutoffAt=2000-01-01T00:00:00.000Z`);
  assert.equal(empty.response.status,200);
  assert.deepEqual(empty.body.missing,['NO_RUNS_BEFORE_CUTOFF']);
  assert.deepEqual(empty.body.runs,[]);
  assert.deepEqual(empty.body.counts,{messages:0,artifacts:0,releases:0});
  const invalid=await f.call(`/projects/${projectId}/history-export?cutoffAt=not-a-date`);
  assert.equal(invalid.response.status,422);
});
