import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('invocation HTTP creates, reads and transitions one independent record',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,projectId=p.projectId;
  const body={endpointId:'agent.reviewer',endpointRevision:1,registryGenerationId:'gen_01',inputManifestHash:'a'.repeat(64),definitionSnapshotHash:'b'.repeat(64)};
  const createdInvocation=await f.call(`/projects/${projectId}/invocations`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify(body)});
  assert.equal(createdInvocation.response.status,202,JSON.stringify(createdInvocation.body));
  const invocationId=createdInvocation.body.result.invocationId;
  const read=await f.call(`/invocations/${invocationId}`);
  assert.equal(read.response.status,200);
  assert.equal(read.body.endpointId,'agent.reviewer');
  assert.equal(read.body.state,'ACCEPTED');
  const listed=await f.call(`/projects/${projectId}/invocations`);
  assert.equal(listed.body.invocations.length,1);
  const working=await f.call(`/invocations/${invocationId}:transition`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({expectedState:'ACCEPTED',state:'WORKING'})});
  assert.equal(working.response.status,202,JSON.stringify(working.body));
  const completed=await f.call(`/invocations/${invocationId}:transition`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({expectedState:'WORKING',state:'COMPLETED'})});
  assert.equal(completed.response.status,202,JSON.stringify(completed.body));
  assert.equal((await f.storage.request('getInvocation',{invocationId})).state,'COMPLETED');
});
