import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('agent exposure HTTP runs draft→validate→publish→drain→retire with catalog filtering',{timeout:120000},async t=>{
  const f=await inputFixture(t),created=await f.create({}),p=created.body.result,projectId=p.projectId;
  const card={name:'Reviewer',description:'External review agent',version:'1.0.0',skills:['review']};
  const draft=await f.call(`/projects/${projectId}/exposures`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({agentKey:'reviewer.v1',card})});
  assert.equal(draft.response.status,202,JSON.stringify(draft.body));
  const exposureId=draft.body.result.exposureId;
  const publishEarly=await f.call(`/exposures/${exposureId}:publish`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(publishEarly.response.status,409);
  assert.equal(publishEarly.body.error.code,'EXPOSURE_STATE_INVALID');
  const validate=await f.call(`/exposures/${exposureId}:validate`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(validate.response.status,202,JSON.stringify(validate.body));
  const publish=await f.call(`/exposures/${exposureId}:publish`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.equal(publish.response.status,202,JSON.stringify(publish.body));
  assert.equal(publish.body.result.state,'PUBLISHED');
  const catalog=await f.call(`/projects/${projectId}/agent-catalog`);
  assert.deepEqual(catalog.body.exposures.map(entry=>entry.exposureId),[exposureId]);
  const listed=await f.call(`/projects/${projectId}/exposures`);
  assert.equal(listed.body.exposures.length,1);
  await f.call(`/exposures/${exposureId}:drain`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  await f.call(`/exposures/${exposureId}:retire`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});
  assert.deepEqual((await f.call(`/projects/${projectId}/agent-catalog`)).body.exposures,[]);
});