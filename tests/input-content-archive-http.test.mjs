import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';
import {content} from './fixtures/storage-data.mjs';

test('content archive HTTP requests, lists and acknowledges without deleting content',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,projectId=p.projectId,hash=await content(f.storage,'archive through http');
  const before=await f.storage.request('getStorageDiagnostics',{});
  const requested=await f.call(`/projects/${projectId}/content-archive`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({contentHash:hash})});
  assert.equal(requested.response.status,202,JSON.stringify(requested.body));
  const archiveId=requested.body.result.archiveId;
  const listed=await f.call(`/projects/${projectId}/content-archive`);
  assert.equal(listed.body.archives.length,1);
  const acked=await f.call(`/content-archives/${archiveId}:ack`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(acked.response.status,202,JSON.stringify(acked.body));
  assert.equal(acked.body.result.state,'ACKED');
  const detail=await f.call(`/content-archives/${archiveId}`);
  assert.equal(detail.body.state,'ACKED');
  assert.ok(detail.body.ackedAt);
  const after=await f.storage.request('getStorageDiagnostics',{});
  assert.equal(after.contentObjects,before.contentObjects);
});
