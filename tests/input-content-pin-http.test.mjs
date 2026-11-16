import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';
import {content} from './fixtures/storage-data.mjs';

test('content pin HTTP protects, lists, releases and reports verified counts',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,hash=await content(f.storage,'pinned through http');
  const pinned=await f.call(`/projects/${p.projectId}/content-pins`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({contentHash:hash,reason:'retain evidence'})});
  assert.equal(pinned.response.status,202,JSON.stringify(pinned.body));
  const pinId=pinned.body.result.pinId;
  const listed=await f.call(`/projects/${p.projectId}/content-pins?contentHash=${hash}`);
  assert.equal(listed.response.status,200);
  assert.deepEqual(listed.body.pins.map(pin=>pin.pinId),[pinId]);
  const diagnostics=await f.call(`/storage/diagnostics?projectId=${p.projectId}`);
  assert.equal(diagnostics.response.status,200);
  assert.equal(diagnostics.body.activePins,1);
  const released=await f.call(`/projects/${p.projectId}/content-pins/${pinId}:release`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(released.response.status,202,JSON.stringify(released.body));
  assert.ok(released.body.result.releasedAt);
  assert.equal((await f.call(`/storage/diagnostics?projectId=${p.projectId}`)).body.activePins,0);
});
