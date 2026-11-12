import test from 'node:test';
import assert from 'node:assert/strict';
import {AcceptancePreparer} from '../packages/platform-core/dist/index.mjs';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {binding,preparedObservation,explicitAcceptanceBackend} from './fixtures/acceptance-readiness.mjs';
import {hash,canonical,meta} from './fixtures/storage-data.mjs';
const start=async f=>{const p=await f.call('beginAcceptancePreparation',await f.request());return (await f.call('markAcceptancePreparationSent',f.bound(p))).preparation;};
const ready=(f,p)=>f.call('getAcceptanceReadiness',binding(f,p));
const record=(f,p,observation,expectedSequence=0)=>f.call('recordAcceptancePreparationObservation',{...binding(f,p),expectedPreparationRevision:p.revision,expectedSequence,observation});
test('immutable original proof survives reopen while current health expires and custody high-water survives UNKNOWN',{timeout:240000},async t=>{
  const f=await acceptanceFixture(t),p=await start(f),o=preparedObservation(p),first=await record(f,p,o);assert.equal(first.state,'READY');assert.equal(first.proofHash,hash(canonical(o.proof)));assert.equal(first.sequence,1);
  assert.equal((await f.call('verifyAcceptancePreparation',binding(f,p))).allowed,false);
  await f.reopen();assert.deepEqual(await ready(f,p),first);assert.deepEqual(await record(f,p,o,0),first);
  assert.throws(()=>f.run('UPDATE acceptance_prepared_proofs SET proof_hash=?',hash('changed')),/ACCEPTANCE_PROOF_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM acceptance_preparation_observations'),/ACCEPTANCE_OBSERVATION_IMMUTABLE/);
  await new Promise(resolve=>setTimeout(resolve,31050));const expired=await ready(f,p);assert.equal(expired.state,'UNAVAILABLE');assert.equal(expired.reasonCode,'ACCEPTANCE_HEALTH_EXPIRED');assert.deepEqual(expired.proof,first.proof);
  const refresh={...o,health:{...o.health,custodyRevision:7},checkedAt:new Date().toISOString()};assert.equal((await record(f,p,refresh,1)).state,'READY');
  await record(f,p,{state:'UNKNOWN',errorCode:'EXPLICIT_CONNECTION_LOST',checkedAt:new Date().toISOString()},2);await f.reopen();assert.equal((await ready(f,p)).reasonCode,'EXPLICIT_CONNECTION_LOST');
  await assert.rejects(record(f,p,{...refresh,health:{...refresh.health,custodyRevision:6},checkedAt:new Date().toISOString()},3),{code:'ACCEPTANCE_OBSERVATION_STALE'});
  const recovered=await record(f,p,{...refresh,checkedAt:new Date().toISOString()},3);assert.equal(recovered.state,'READY');assert.equal(recovered.sequence,4);assert.equal(recovered.proofHash,first.proofHash);
  const uncertain=await f.call('markAcceptancePreparationUnknown',{...f.bound(p),errorCode:'EXPLICIT_LEGACY_UNCERTAINTY'});assert.ok(uncertain.revision>p.revision);assert.equal((await ready(f,p)).reasonCode,'ACCEPTANCE_BACKEND_UNCERTAIN');
  await assert.rejects(record(f,p,{...refresh,checkedAt:new Date().toISOString()},4),{code:'ACCEPTANCE_PREPARATION_CHANGED'});assert.equal((await record(f,uncertain,{...refresh,checkedAt:new Date().toISOString()},4)).state,'READY');
  const page=await f.call('listAcceptancePreparationObservations',{...binding(f,p),limit:2});assert.deepEqual(page.items.map(i=>i.sequence),[1,2]);assert.equal(page.nextSequence,2);assert.deepEqual((await f.call('listAcceptancePreparationObservations',{...binding(f,p),afterSequence:2})).items.map(i=>i.sequence),[3,4,5]);
  assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT count(*) n FROM datasets').n,0);assert.equal((await f.call('getRun',{runId:f.p.runId})).terminalOutcome,null);
});
test('backend identity, exact bindings, closed durable fence kind and fresh health are required; proof cannot be replaced',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await start(f),o=preparedObservation(p);
  await assert.rejects(f.call('recordAcceptancePreparationObservation',{...binding(f,p),principalId:'user_1',expectedPreparationRevision:p.revision,expectedSequence:0,observation:o}),{code:'FORBIDDEN'});
  await assert.rejects(f.call('getAcceptanceReadiness',{...binding(f,p),requestHash:hash('different')}),{code:'ACCEPTANCE_REQUEST_CHANGED'});
  const mutations=[x=>{x.proof.runnerId='other.runner';},x=>{x.proof.data.storageKey='other/dataset/app.sqlite';},x=>{x.proof.sourceFence={datasetId:'dataset_unexpected',datasetOperationId:'op_source',closeOperationId:p.operationId,closeRequestHash:hash('close'),gateFence:1,physical:x.proof.targetFence.physical};},x=>{x.proof.targetFence.writeState='OPEN';},x=>{x.proof.targetFence.physical.kind='IN_MEMORY_MUTEX';},x=>{x.proof.service.claim.datasetId='dataset_different';},x=>{x.health.endpoint.port++;},x=>{x.fences.targetProofHash=hash('other current fence');},x=>{x.health.custodyState='PREVIEW';},x=>{x.checkedAt=new Date(Date.now()+60000).toISOString();},x=>{x.healthy=true;}];
  for(const mutate of mutations){const bad=structuredClone(o);mutate(bad);await assert.rejects(record(f,p,bad));assert.equal((await ready(f,p)).sequence,0);}
  assert.equal((await record(f,p,o)).state,'READY');const changed=structuredClone(o);changed.proof.data.sha256=hash('substitute snapshot');changed.checkedAt=new Date().toISOString();await assert.rejects(record(f,p,changed,1),{code:'ACCEPTANCE_PROOF_IMMUTABLE'});
  const item=(await f.call('getCandidateReview',f.who)).items[0],r=await f.call('getRun',{runId:f.p.runId});await f.call('recordCandidateReview',{meta:meta(f.p.runId),runId:f.p.runId,candidateId:f.candidate.candidateId,ifMatch:'"r'+r.resourceRevision+'"',manifestHash:f.candidate.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result.resultId,verdict:'FAIL',procedure:'Changed explicit observation.',expected:item.expected,observed:'No longer passes.',evidence:[]});
  assert.equal((await ready(f,p)).state,'STALE');await assert.rejects(record(f,p,{...o,checkedAt:new Date().toISOString()},1),{code:'ACCEPTANCE_BASIS_CHANGED'});assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
test('proof, observation, resource revision and event roll back together; late CAS cannot overwrite newer health',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await start(f),o=preparedObservation(p),before=await f.call('getRun',{runId:f.p.runId});
  for(const [name,sql] of [['observation',"CREATE TRIGGER cut_observation BEFORE INSERT ON acceptance_preparation_observations BEGIN SELECT RAISE(ABORT,'readiness-cut'); END"],['event',"CREATE TRIGGER cut_event BEFORE INSERT ON events WHEN NEW.type='AcceptanceReadinessObserved' BEGIN SELECT RAISE(ABORT,'readiness-cut'); END"]]){
    f.db.exec(sql);await assert.rejects(record(f,p,o),/readiness-cut/);assert.equal(f.get('SELECT count(*) n FROM acceptance_prepared_proofs').n,0);assert.equal(f.get('SELECT count(*) n FROM acceptance_preparation_observations').n,0);assert.deepEqual(await f.call('getRun',{runId:f.p.runId}),before);f.db.exec('DROP TRIGGER cut_'+name);
  }
  assert.equal((await record(f,p,o)).state,'READY');await record(f,p,{state:'UNKNOWN',errorCode:'EXPLICIT_UNKNOWN',checkedAt:new Date().toISOString()},1);
  await assert.rejects(record(f,p,{...o,checkedAt:new Date().toISOString()},1),{code:'ACCEPTANCE_OBSERVATION_CHANGED'});assert.equal((await ready(f,p)).sequence,2);assert.equal((await record(f,p,o,0)).state,'UNAVAILABLE');assert.equal((await ready(f,p)).sequence,2);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('concurrent controllers dispatch once; lost observation ACK and worker reopen only inspect the original prepared objects',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),backend=explicitAcceptanceBackend();let enter,release,originalObservation;const started=new Promise(r=>{enter=r;}),pause=new Promise(r=>{release=r;}),prepare=backend.prepare.bind(backend);
  backend.prepare=async(...args)=>{const o=await prepare(...args);originalObservation=o;enter();await pause;return o;};
  const controller=new AcceptancePreparer(f.storage,f.policy.backendPrincipalId,backend),first=controller.advance(p.operationId);await started;
  backend.setObservation({state:'UNKNOWN',errorCode:'FIXTURE_ORIGINAL_UNCERTAIN',checkedAt:new Date().toISOString()});const concurrent=await controller.advance(p.operationId);assert.equal(concurrent.state,'UNAVAILABLE');release();await assert.rejects(first,{code:'ACCEPTANCE_OBSERVATION_CHANGED'});assert.equal(backend.counts.prepare,1);
  backend.setObservation({...originalObservation,checkedAt:new Date().toISOString()});await f.reopen();let lost=true;const lossy={async request(method,input){const value=await f.call(method,input);if(lost&&method==='recordAcceptancePreparationObservation'){lost=false;throw Error('lost committed observation ACK');}return value;}};
  await assert.rejects(new AcceptancePreparer(lossy,f.policy.backendPrincipalId,backend).advance(p.operationId),/lost committed observation ACK/);const persisted=await ready(f,p);assert.equal(persisted.state,'READY');
  await f.reopen();const recovery=await new AcceptancePreparer(f.storage,f.policy.backendPrincipalId,backend).recoverPage({projectId:f.p.projectId,policyHash:f.policyHash});assert.equal(recovery.results[0].state,'READY');assert.equal(backend.counts.prepare,1);assert.equal(backend.counts.inspect,3);assert.equal((await ready(f,p)).proofHash,persisted.proofHash);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
test('missing backend stays unsent; a lost dispatch grant ACK never permits prepare on recovery',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request());await assert.rejects(new AcceptancePreparer(f.storage,f.policy.backendPrincipalId).advance(p.operationId),{code:'ACCEPTANCE_BACKEND_NOT_CONFIGURED'});assert.equal((await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).state,'PREPARED');
  const backend=explicitAcceptanceBackend(),lossy={async request(method,input){const value=await f.call(method,input);if(method==='markAcceptancePreparationSent')throw Error('lost dispatch grant ACK');return value;}};
  await assert.rejects(new AcceptancePreparer(lossy,f.policy.backendPrincipalId,backend).advance(p.operationId),/lost dispatch grant ACK/);await f.reopen();const after=await new AcceptancePreparer(f.storage,f.policy.backendPrincipalId,backend).advance(p.operationId);assert.equal(after.state,'UNAVAILABLE');assert.equal(after.reasonCode,'FIXTURE_ORIGINAL_UNCERTAIN');assert.equal(backend.counts.prepare,0);assert.equal(backend.counts.inspect,1);assert.equal(f.get('SELECT count(*) n FROM acceptance_prepared_proofs').n,0);
});
