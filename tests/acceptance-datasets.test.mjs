import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {binding,preparedObservation} from './fixtures/acceptance-readiness.mjs';
import {hash} from './fixtures/storage-data.mjs';

test('formal INITIAL intent owns one closed target; metadata, proof and history roll back and recover together',{timeout:240000},async t=>{
  const f=await acceptanceFixture(t),input=await f.request(),before=await f.call('getRun',{runId:f.p.runId});
  for(const [table,name] of [['datasets','target'],['dataset_preparations','owner'],['preview_write_gates','gate'],['preview_write_gate_events','gate_history']]){
    f.db.exec('CREATE TRIGGER cut_'+name+' BEFORE INSERT ON '+table+" BEGIN SELECT RAISE(ABORT,'ownership-cut'); END");await assert.rejects(f.call('beginAcceptancePreparation',input),/ownership-cut/);
    for(const table of ['acceptance_preparations','datasets','dataset_preparations','preview_write_gates','preview_write_gate_events'])assert.equal(f.get('SELECT count(*) n FROM '+table).n,0,table);
    assert.equal(await f.call('lookupOperation',input.meta),null);assert.deepEqual(await f.call('getRun',{runId:f.p.runId}),before);f.db.exec('DROP TRIGGER cut_'+name);
  }
  const p=await f.call('beginAcceptancePreparation',input),b=binding(f,p),initial=await f.call('getAcceptanceDataset',b);
  assert.equal(initial.purpose,'ACCEPTANCE');assert.equal(initial.baseReleaseId,null);assert.equal(initial.dataset.operationId,p.operationId);assert.equal(initial.dataset.datasetId,p.request.target.datasetId);assert.equal(initial.dataset.state,'PREPARING');assert.equal(initial.gate.state,'CLOSED');assert.equal(initial.gate.fence,0);assert.equal(initial.gate.closeOperationId,null);assert.equal(initial.requestHash,p.requestHash);
  await f.reopen();assert.deepEqual(await f.call('getAcceptanceDataset',b),initial);assert.equal((await f.call('beginAcceptancePreparation',input)).operationId,p.operationId);assert.equal(f.get('SELECT count(*) n FROM preview_effects').n,0);assert.equal(f.get('SELECT count(*) n FROM preview_backend_policies').n,0);
  assert.throws(()=>f.run("INSERT INTO previews VALUES(?,?,?,?,?,?,?,?,'STARTING',1,NULL,?,?)",'preview_wrong_purpose',p.projectId,p.runId,p.candidateId,p.operationId,p.request.target.datasetId,p.policyHash,p.request.image.imageDigest,new Date(Date.now()+60000).toISOString(),p.createdAt),/PREVIEW_POLICY_PURPOSE_INVALID/);
  assert.throws(()=>f.run("INSERT INTO preview_effects VALUES(?,?,?,?,?,NULL,?,'DATASET_PREPARE',?,?,'{}','PREPARED',1,NULL,NULL,?)",p.operationId,p.projectId,p.runId,p.candidateId,p.request.target.datasetId,p.policyHash,p.request.target.datasetId,p.requestHash,p.createdAt),/PREVIEW_POLICY_PURPOSE_INVALID/);
  await assert.rejects(f.call('getAcceptanceDataset',{...b,principalId:'outside.subject'}));await assert.rejects(f.call('getAcceptanceDataset',{...b,requestHash:hash('wrong')}),{code:'ACCEPTANCE_REQUEST_CHANGED'});await assert.rejects(f.call('enrollPreviewWriteGate',{principalId:f.policy.backendPrincipalId,datasetOperationId:p.operationId,datasetRequestHash:p.requestHash}),{code:'PREVIEW_DATASET_NOT_FOUND'});
  const sent=(await f.call('markAcceptancePreparationSent',f.bound(p))).preparation;await assert.rejects(f.call('closeAcceptanceSourceWriteGate',{...b,principalId:'user_1',expectedRevision:sent.revision,expectedFence:0}),{code:'FORBIDDEN'});await assert.rejects(f.call('closeAcceptanceSourceWriteGate',{...b,expectedRevision:sent.revision,expectedFence:0}),{code:'ACCEPTANCE_SOURCE_NOT_APPLICABLE'});
  const observation=preparedObservation(sent),record=()=>f.call('recordAcceptancePreparationObservation',{...b,expectedPreparationRevision:sent.revision,expectedSequence:0,observation});
  f.db.exec("CREATE TRIGGER cut_proof BEFORE INSERT ON acceptance_preparation_observations BEGIN SELECT RAISE(ABORT,'proof-cut'); END");await assert.rejects(record(),/proof-cut/);assert.equal((await f.call('getAcceptanceDataset',b)).dataset.state,'PREPARING');assert.equal(f.get('SELECT count(*) n FROM acceptance_prepared_proofs').n,0);f.db.exec('DROP TRIGGER cut_proof');
  assert.equal((await record()).state,'READY');const frozen=await f.call('getAcceptanceDataset',b);assert.equal(frozen.dataset.state,'WRITE_FROZEN');assert.equal(frozen.dataset.snapshotAt,observation.proof.data.snapshotAt);assert.equal(frozen.dataset.revision,2);assert.equal(frozen.gate.state,'CLOSED');
  await f.call('recordAcceptancePreparationObservation',{...b,expectedPreparationRevision:sent.revision,expectedSequence:1,observation:{state:'UNKNOWN',errorCode:'EXPLICIT_UNCERTAINTY',checkedAt:new Date().toISOString()}});assert.deepEqual(await f.call('getAcceptanceDataset',b),frozen);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT accepted_release_id FROM projects').accepted_release_id,null);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
