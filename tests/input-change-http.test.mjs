import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('change proposal HTTP requires current basis and records confirm plus stale rejection',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,runId=p.runId;
  const workspace=await f.call(`/projects/${p.projectId}/workspace`);
  assert.equal(workspace.response.status,200);
  const ifMatch='"r'+workspace.body.run.resourceRevision+'"';
  const headers=()=>({'content-type':'application/json','idempotency-key':randomUUID(),'if-match':ifMatch});
  const first=await f.call(`/runs/${runId}/changes`,{method:'POST',headers:headers(),body:JSON.stringify({proposedText:'新增导出功能',sourceMessageId:'message_change_http_one'})});
  assert.equal(first.response.status,202,JSON.stringify(first.body));
  const change=first.body.result;
  assert.equal(change.state,'PROPOSED');
  const detail=await f.call(`/changes/${change.changeId}`);
  assert.equal(detail.response.status,200);
  assert.equal(detail.body.state,'PROPOSED');
  const confirmed=await f.call(`/changes/${change.changeId}:decide`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({action:'confirm',basisHash:change.basisHash})});
  assert.equal(confirmed.response.status,202,JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.result.state,'CONFIRMED');
  const listed=await f.call(`/runs/${runId}/changes`);
  assert.equal(listed.response.status,200);
  assert.equal(listed.body.changes.length,1);
});
