import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('redo HTTP requires If-Match, rejects active Run and creates one new Run',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,runId=p.runId;
  const before=await f.storage.request('getRun',{runId});
  const headers={ 'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"r'+before.resourceRevision+'"' };
  const early=await f.call(`/runs/${runId}:redo`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({redoReviewHash:'a'.repeat(64)})});
  assert.equal(early.response.status,428);
  const active=await f.call(`/runs/${runId}:redo`,{method:'POST',headers,body:JSON.stringify({redoReviewHash:'a'.repeat(64)})});
  assert.equal(active.response.status,409);
  assert.equal(active.body.error.code,'REDO_REQUIRES_TERMINAL');
  await f.storage.request('finishRun',{meta:{principalId:'user_1',scopeId:runId,idempotencyKey:randomUUID()},runId,ifMatch:'"r'+before.resourceRevision+'"',outcome:'FAILED',reason:'ci failed'});
  const terminal=await f.storage.request('getRun',{runId});
  const redo=await f.call(`/runs/${runId}:redo`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID(),'if-match':'"r'+terminal.resourceRevision+'"'},body:JSON.stringify({redoReviewHash:'b'.repeat(64)})});
  assert.equal(redo.response.status,202,JSON.stringify(redo.body));
  assert.notEqual(redo.body.result.newRunId,runId);
  const fresh=await f.storage.request('getRun',{runId:redo.body.result.newRunId});
  assert.equal(fresh.phase,'PREPARING');
  assert.equal(fresh.currentPlanRevision,null);
});
