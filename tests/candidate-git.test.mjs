import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {ExecutionGrantLease} from '../packages/agent-runtime/dist/index.mjs';
import {callerId} from './fixtures/a2a-data.mjs';
import {join} from 'node:path';
import {canonical} from '../packages/storage-sqlite/dist/index.mjs';
import {meta} from './fixtures/storage-data.mjs';
import {candidateGitFixture} from './fixtures/candidate-git.mjs';
import {archiveGit,archiveOp} from './fixtures/source-archive.mjs';

test('actual A2A-admitted archived Git branches retain immutable candidates and original operation recovery',async t=>{
 const f=await candidateGitFixture(t);await f.develop(root=>writeFile(join(root,'src/left.ts'),'export const left = 1;\n'));await f.develop(root=>writeFile(join(root,'src/right.ts'),'export const right = 2;\n'));const provider=f.repository.provider;
 await t.test('both changes survive lost step/final ACKs and later unsubmitted developer writes',async()=>{
  const input=f.input(),lost=new Set(),storage={async request(method,args){const result=await f.storage.request(method,args);if(['acknowledgeCandidateStep','acknowledgeCandidateIntegration'].includes(method)&&!lost.has(method)){lost.add(method);throw Error('Committed ACK reply lost');}return result;}};
  const result=await f.service(storage).integrate(input);assert.equal(result.state,'ACKNOWLEDGED');assert.equal(lost.size,2);assert.equal(result.acknowledgedSteps,2);const commit=result.manifest.commit;
  assert.equal(await archiveGit(provider.identity.root,'show',commit+':src/left.ts'),'export const left = 1;');assert.equal(await archiveGit(provider.identity.root,'show',commit+':src/right.ts'),'export const right = 2;');
  assert.equal((await provider.commit(commit)).parents[1],f.sources[1].commit);assert.equal(await provider.readRef('refs/devmesh/candidates/'+f.p.runId),commit);assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);
  const manifest=await f.storage.request('getCandidateIntegrationManifest',{principalId:'user_1',operationId:input.operationId});assert.equal(canonical(await provider.manifest(commit)),canonical(manifest));
  await writeFile(join(f.sources[0].binding.root,'src/left.ts'),'unsubmitted development changes\n');assert.equal(await archiveGit(provider.identity.root,'show',commit+':src/left.ts'),'export const left = 1;');
  assert.deepEqual(await f.service().reconcile({principalId:'user_1',operationId:input.operationId}),result);assert.equal(f.sql('SELECT count(*) n FROM candidate_integrations')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM candidate_integration_steps')[0].n,2);
 });
 await t.test('a sent intent with missing original refs stays unknown until the original delayed Git action is observed',async()=>{
  const input=f.input();let failed=false;const storage={async request(method,args){const result=await f.storage.request(method,args);if(method==='markCandidateIntegrationSent'&&!failed){failed=true;throw Error('Process boundary after durable intent');}return result;}};
  await assert.rejects(f.service(storage).integrate(input),/Process boundary/);const original=await f.storage.request('getCandidateIntegration',{principalId:'user_1',operationId:input.operationId});assert.equal(original.state,'CAS_SENT');
  await assert.rejects(f.service().reconcile({principalId:'user_1',operationId:input.operationId}),{code:'CANDIDATE_CAS_OUTCOME_UNKNOWN'});for(const ref of original.updates.filter(update=>update.expected===null))assert.equal(await provider.readRef(ref.ref),null);
  await assert.rejects(f.service().integrate({...input,operationId:archiveOp()}),{code:'CANDIDATE_RECONCILIATION_REQUIRED'});assert.equal(f.sql('SELECT count(*) n FROM candidate_integrations')[0].n,2);
  // Simulate the original external Git action completing late. The service's
  // recovery path above did not resend it; only exact original facts are used.
  assert.equal(await provider.updateRefs(original.updates),true);const recovered=await f.service().reconcile({principalId:'user_1',operationId:input.operationId});assert.equal(recovered.state,'ACKNOWLEDGED');assert.equal(recovered.manifest.commit,original.manifest.commit);
 });
   await t.test('scheduler admission and an isolated verification checkout freeze the exact dependency snapshot',async()=>{
   const work=f.draft.works.find(work=>work.role==='tester'),subject={principalId:'user_1',runId:f.p.runId,purpose:'work-input',workId:work.workId};
   const globalBefore=await provider.readRef('refs/devmesh/candidates/'+f.p.runId);
   // Run-candidate snapshots must not satisfy a different Work-input basis.
   await assert.rejects(f.storage.request('getQualifiedCandidateSnapshot',subject),{code:'CANDIDATE_SNAPSHOT_UNAVAILABLE'});
   const before=f.sql('SELECT count(*) n FROM attempts')[0].n;assert.equal(await f.scheduler.tick(new AbortController().signal),null);assert.equal(f.scheduler.lastError,'CANDIDATE_SNAPSHOT_UNAVAILABLE');assert.equal(f.sql('SELECT count(*) n FROM attempts')[0].n,before);
   f.scheduler.options.prepareCodeBasis=(candidate,signal)=>f.service().prepareWorkInput({principalId:candidate.principalId,runId:candidate.runId,workId:candidate.work.workId},signal);
   const admitted=await f.scheduler.tick(new AbortController().signal);assert.ok(admitted,JSON.stringify({error:f.scheduler.lastError}));const attemptId=admitted.result.attemptIds[0],attempt=await f.storage.request('getAttempt',{attemptId}),snapshot=await f.storage.request('getQualifiedCandidateSnapshot',subject);
   const admittedManifest=JSON.parse(f.sql('SELECT input_manifest_json FROM attempts WHERE attempt_id=?',attemptId)[0].input_manifest_json);
   assert.equal(attempt.role,'tester');assert.equal(admittedManifest.codeCommit,snapshot.manifest.commit);assert.notEqual(snapshot.manifest.commit,globalBefore);assert.equal(await provider.readRef('refs/devmesh/candidates/'+f.p.runId),globalBefore);
   const dispatch=(await f.storage.request('listScheduledDispatches',{})).find(row=>row.attemptId===attemptId);assert.equal((await f.scheduler.send(dispatch,new AbortController().signal)).state,'ACKED');
   const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.tester',workerId:'candidate.verification.fixture'}),{delegation:_delegation,...key}=claim;
   const permit=JSON.parse(f.sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',attemptId)[0].permit_json),lease=new ExecutionGrantLease(f.storage,key,value=>Object.assign(permit,value));await lease.start();t.after(()=>lease.stop());
   const workspaceRef=permit.resources.find(resource=>resource.kind==='workspace').resourceId,allocation=await f.allocator.allocate({permit,operationId:archiveOp(),workspaceRef,repositoryResourceId:'repository.candidate',runnerId:'runner.local',kind:'verification',baseCommit:snapshot.manifest.commit}),root=allocation.record.identity.root;
   assert.equal(allocation.record.baseCommit,snapshot.manifest.commit);assert.equal(allocation.record.manifest.sha256,snapshot.manifest.sha256);assert.notEqual(root,f.sources[0].binding.root);assert.equal(await allocation.provider.head(),snapshot.manifest.commit);
   await writeFile(join(f.sources[0].binding.root,'src/left.ts'),'developer changed after verification allocation\n');
   assert.equal(await readFile(join(root,'src/left.ts'),'utf8'),'export const left = 1;\n');assert.equal(await readFile(join(root,'src/right.ts'),'utf8'),'export const right = 2;\n');assert.equal(await allocation.provider.head(),snapshot.manifest.commit);assert.equal((await allocation.provider.manifest(snapshot.manifest.commit)).sha256,snapshot.manifest.sha256);
    // No Runtime/model or Runner job is started for this claimed fixture Host.
    // Prove its known empty effect set before supplying cancellation evidence.
    assert.equal(f.sql('SELECT count(*) n FROM tool_operations WHERE attempt_id=?',attemptId)[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM runner_jobs WHERE operation_id IN (SELECT operation_id FROM tool_operations WHERE attempt_id=?)',attemptId)[0].n,0);assert.equal(f.held.size,0);
    const task=await f.storage.request('getA2ATask',{callerId,endpointId:key.endpointId,taskId:key.taskId});await f.storage.request('settleAcceptedWork',{...key,state:'canceled',stopVerified:true,snapshot:{...task.snapshot,status:{state:'TASK_STATE_CANCELED',timestamp:new Date().toISOString()}}});await lease.stop();
   // This test proves exact input and isolation; it runs no quality checks.
   assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);
  });
 await t.test('unique atomic refs prove a lost ACK after pause and a later global ref move without replaying writes',async()=>{
  const input=f.input(),storage={async request(method,args){if(method==='acknowledgeCandidateIntegration')throw Error('Database unavailable before ACK');return f.storage.request(method,args);}};
  await assert.rejects(f.service(storage).integrate(input),/Database unavailable/);const original=await f.storage.request('getCandidateIntegration',{principalId:'user_1',operationId:input.operationId});assert.equal(original.state,'CAS_SENT');const global=original.updates.find(update=>update.ref.startsWith('refs/devmesh/candidates/'));
  assert.equal(await provider.updateRefs([{ref:global.ref,commit:f.sources[0].commit,expected:global.commit}]),true);const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  const recovered=await f.service().reconcile({principalId:'user_1',operationId:input.operationId});assert.equal(recovered.state,'ACKNOWLEDGED');assert.equal(recovered.manifest.commit,global.commit);assert.equal(await provider.readRef(global.ref),f.sources[0].commit);assert.equal(recovered.acknowledgement.refs.find(ref=>ref.ref===global.ref).commit,global.commit);assert.deepEqual(await f.service().reconcile({principalId:'user_1',operationId:input.operationId}),recovered);
  assert.equal(f.sql('SELECT count(*) n FROM candidate_integrations')[0].n,4);assert.equal(f.sql('SELECT count(*) n FROM candidate_integration_steps')[0].n,8);assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);assert.equal(f.held.size,0);
 });
});
