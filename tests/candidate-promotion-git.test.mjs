import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {candidateGitFixture} from './fixtures/candidate-git.mjs';
import {archiveGit,archiveOp} from './fixtures/source-archive.mjs';
import {meta} from './fixtures/storage-data.mjs';

// Actual A2A admission, Git branches/archives/integrations and SQLite journal.
// Source Work completion is explicitly historical fixture data. No test report,
// model, delivery build or candidate quality freeze is claimed by this suite.
test('final publication retains the exact original Work-input commit without new merge steps',async t=>{
 const f=await candidateGitFixture(t);
 await f.develop(root=>writeFile(join(root,'src/left.ts'),'export const left = 11;\n'));
 await f.develop(root=>writeFile(join(root,'src/right.ts'),'export const right = 22;\n'));
 const input={principalId:'user_1',runId:f.p.runId,purpose:'work-input',workId:f.draft.works[2].workId,operationId:archiveOp()},origin=await f.service().integrate(input),provider=f.repository.provider;
 assert.equal(origin.state,'ACKNOWLEDGED');assert.equal(origin.acknowledgedSteps,2);
 const promote=()=>({...f.input(),originOperationId:origin.operationId});
 await t.test('exact commit, manifest and archive identities are preserved with an independent CAS receipt',async()=>{
  const before=await archiveGit(provider.identity.root,'rev-list','--all','--count'),request=promote(),result=await f.service().integrate(request);
  assert.equal(result.state,'ACKNOWLEDGED');assert.equal(result.originOperationId,origin.operationId);assert.deepEqual(result.manifest,origin.manifest);assert.equal(result.acknowledgedSteps,0);assert.equal(result.sourceCount,2);
  assert.equal(await provider.readRef('refs/devmesh/candidates/'+f.p.runId),origin.manifest.commit);
  assert.equal(await archiveGit(provider.identity.root,'rev-list','--all','--count'),before);
  assert.equal(f.sql('SELECT count(*) n FROM candidate_integration_steps WHERE operation_id=?',request.operationId)[0].n,0);
  assert.equal((await f.storage.request('getQualifiedCandidateSnapshot',f.subject)).operationId,result.operationId);
  assert.deepEqual(await f.service().reconcile({principalId:'user_1',operationId:result.operationId}),result);
  await assert.rejects(f.service().integrate({...request,originOperationId:result.operationId}),{code:'IDEMPOTENCY_KEY_REUSED'});
  await assert.rejects(f.service().integrate({...promote(),originOperationId:result.operationId}),{code:'CANDIDATE_PROMOTION_UNPROVEN'});
  assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);
 });
 await t.test('missing retained original refs reject publication before any new final ref is sent',async()=>{
  const ref=origin.updates[0],request=promote();assert.equal(await provider.updateRefs([{ref:ref.ref,commit:f.base,expected:ref.commit}]),true);
  await assert.rejects(f.service().integrate(request),{code:'CANDIDATE_SNAPSHOT_REF_CHANGED'});
  const record=await f.storage.request('getCandidateIntegration',{principalId:'user_1',operationId:request.operationId});assert.equal(record.state,'FAILED');assert.equal(record.manifest,null);
  assert.equal(await provider.readRef('refs/devmesh/integrations/'+request.operationId),null);
  assert.equal(await provider.updateRefs([{ref:ref.ref,commit:ref.commit,expected:f.base}]),true);
 });
 await t.test('a durable CAS intent is not resent while its original refs are unknown',async()=>{
  const request=promote();let interrupted=false;
  const storage={async request(method,args){const result=await f.storage.request(method,args);if(method==='markCandidateIntegrationSent'&&!interrupted){interrupted=true;throw Error('after durable promotion intent');}return result;}};
  await assert.rejects(f.service(storage).integrate(request),/durable promotion intent/);
  const record=await f.storage.request('getCandidateIntegration',{principalId:'user_1',operationId:request.operationId});assert.equal(record.state,'CAS_SENT');assert.equal(record.manifest.commit,origin.manifest.commit);
  await assert.rejects(f.service().reconcile({principalId:'user_1',operationId:request.operationId}),{code:'CANDIDATE_CAS_OUTCOME_UNKNOWN'});
  for(const ref of record.updates.filter(r=>!r.ref.startsWith('refs/devmesh/candidates/')))assert.equal(await provider.readRef(ref.ref),null);
  // Complete the admitted original external action. Recovery above only read it.
  assert.equal(await provider.updateRefs(record.updates),true);
  assert.equal((await f.service().reconcile({principalId:'user_1',operationId:request.operationId})).state,'ACKNOWLEDGED');
 });
 await t.test('lost database ACK can be recovered after pause without remerging or moving refs',async()=>{
  const request=promote(),storage={async request(method,args){if(method==='acknowledgeCandidateIntegration')throw Error('before promotion database ACK');return f.storage.request(method,args);}};
  await assert.rejects(f.service(storage).integrate(request),/before promotion database ACK/);
  const before=await archiveGit(provider.identity.root,'rev-list','--all','--count'),run=await f.storage.request('getRun',{runId:f.p.runId});
  await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  const result=await f.service().reconcile({principalId:'user_1',operationId:request.operationId});assert.equal(result.state,'ACKNOWLEDGED');assert.equal(result.manifest.commit,origin.manifest.commit);assert.equal(result.acknowledgedSteps,0);
  assert.equal(await archiveGit(provider.identity.root,'rev-list','--all','--count'),before);
  await assert.rejects(f.storage.request('getQualifiedCandidateSnapshot',f.subject),{code:'CANDIDATE_ADMISSION_CLOSED'});
  assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);assert.equal(f.held.size,0);
 });
});
