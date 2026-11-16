import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('config adjustment HTTP requires a paused Run and a current generation',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,runId=p.runId;
  let run=await f.storage.request('getRun',{runId});
  const early=await f.call(`/runs/${runId}/config-adjustments`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({config:{model:'next'}})});
  assert.equal(early.response.status,428);
  const active=await f.call(`/runs/${runId}/config-adjustments`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"r'+run.resourceRevision+'"'},body:JSON.stringify({config:{model:'next'}})});
  assert.equal(active.response.status,409);
  assert.equal(active.body.error.code,'CONFIG_REQUIRES_PAUSED');
  await f.storage.request('setControlIntent',{meta:{principalId:'user_1',scopeId:runId,idempotencyKey:randomUUID()},runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});
  run=await f.storage.request('getRun',{runId});
  const proposed=await f.call(`/runs/${runId}/config-adjustments`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"r'+run.resourceRevision+'"'},body:JSON.stringify({config:{model:'next'}})});
  assert.equal(proposed.response.status,202,JSON.stringify(proposed.body));
  const adjustment=proposed.body.result;
  const confirmed=await f.call(`/config-adjustments/${adjustment.adjustmentId}:confirm`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(confirmed.response.status,202,JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.result.state,'CONFIRMED');
  const generation=await f.call(`/config/generation?runId=${runId}`);
  assert.equal(generation.response.status,200);
  assert.equal(generation.body.generation,adjustment.baseGeneration+1);
  const listed=await f.call(`/runs/${runId}/config-adjustments`);
  assert.equal(listed.body.adjustments.length,1);
  assert.equal((await f.storage.request('getRun',{runId})).controlGate,'PAUSED');
});
