import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {meta,hash} from './fixtures/storage-data.mjs';
const begin=async(f,input)=>f.call('beginAcceptancePreparation',input??await f.request());
test('acceptance intent fixes the exact reviewed candidate and reserved original identities without accepting or preparing data',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t,{register:false}),input=await f.request();await assert.rejects(begin(f,input),{code:'ACCEPTANCE_BACKEND_NOT_CONFIGURED'});
  await f.call('registerAcceptanceBackendPolicy',f.registration);const p=await begin(f,input);
  assert.equal(p.state,'PREPARED');assert.equal(p.qualification,'CURRENT');assert.equal(p.request.manifestHash,f.candidate.manifestHash);assert.equal(p.request.reviewHash,input.reviewHash);assert.equal(p.request.source,null);assert.equal(p.request.dataPlan.strategy,'INITIAL');assert.match(p.releaseId,/^release_/);assert.equal(p.request.target.storageKey,f.p.projectId+'/'+p.request.target.datasetId+'/app.sqlite');
  assert.deepEqual(await begin(f,input),p);assert.equal(f.get('SELECT count(*) n FROM acceptance_preparations').n,1);assert.equal(f.get('SELECT count(*) n FROM datasets').n,0);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);assert.equal((await f.call('getRun',{runId:f.p.runId})).terminalOutcome,null);
  await assert.rejects(begin(f,await f.request()),{code:'ACCEPTANCE_PREPARATION_UNRESOLVED'});
  assert.throws(()=>f.run('UPDATE acceptance_preparations SET request_hash=? WHERE operation_id=?',hash('forged'),p.operationId),/ACCEPTANCE_PREPARATION_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM acceptance_preparation_history'),/ACCEPTANCE_HISTORY_IMMUTABLE/);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('Worker concurrent dispatch, lost acknowledgement and UNKNOWN survive reopen and never grant a replacement effect',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await begin(f),bound=f.bound(p),values=await Promise.all([f.call('markAcceptancePreparationSent',bound),f.call('markAcceptancePreparationSent',bound)]);
  assert.equal(values.filter(v=>v.dispatch).length,1);const sent=values.find(v=>v.dispatch).preparation;
  await assert.rejects((async()=>{await f.call('markAcceptancePreparationUnknown',{...f.bound(sent),errorCode:'EXPLICIT_ACK_LOST'});throw Error('lost observation acknowledgement');})(),/lost observation acknowledgement/);
  await f.reopen();const unknown=await f.call('getAcceptancePreparation',{principalId:f.policy.backendPrincipalId,operationId:p.operationId});assert.equal(unknown.state,'UNKNOWN');
  assert.equal((await f.call('markAcceptancePreparationSent',bound)).dispatch,false);assert.deepEqual(await f.call('markAcceptancePreparationUnknown',{...f.bound(sent),errorCode:'EXPLICIT_ACK_LOST'}),unknown);
  await assert.rejects(begin(f,await f.request()),{code:'ACCEPTANCE_PREPARATION_UNRESOLVED'});
  const r=await f.call('getRun',{runId:f.p.runId});await assert.rejects(f.call('failUnsentAcceptancePreparation',{meta:meta(f.p.runId),runId:f.p.runId,operationId:p.operationId,requestHash:p.requestHash,ifMatch:'"r'+r.resourceRevision+'"'}),{code:'ACCEPTANCE_EFFECT_UNRESOLVED'});
  const {expectedRevision:_revision,...historyBound}=bound;
  const first=await f.call('listAcceptancePreparationHistory',{...historyBound,limit:1});assert.equal(first.items[0].snapshot.state,'PREPARED');assert.ok(first.nextSequence>0);const rest=await f.call('listAcceptancePreparationHistory',{...historyBound,afterSequence:first.nextSequence});assert.deepEqual(rest.items.map(i=>i.snapshot.state),['SENT','UNKNOWN']);
  const page=await f.call('listAcceptancePreparations',{principalId:f.policy.backendPrincipalId,projectId:f.p.projectId,policyHash:f.policyHash,limit:1});assert.equal(page.items[0].preparation.operationId,p.operationId);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
test('a changed human review invalidates the fixed basis; only the never-dispatched intent may be closed',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),p=await begin(f),v=await f.call('getCandidateReview',f.who),item=v.items[0],r=await f.call('getRun',{runId:f.p.runId});
  await f.call('recordCandidateReview',{meta:meta(f.p.runId),runId:f.p.runId,candidateId:f.candidate.candidateId,ifMatch:'"r'+r.resourceRevision+'"',manifestHash:f.candidate.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result.resultId,verdict:'FAIL',procedure:'Explicit changed protocol observation.',expected:item.expected,observed:'Fixture now fails.',evidence:[]});
  assert.equal((await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).qualification,'STALE');await assert.rejects(f.call('markAcceptancePreparationSent',f.bound(p)),{code:'ACCEPTANCE_BASIS_CHANGED'});
  const current=await f.call('getRun',{runId:f.p.runId}),cancel={meta:meta(f.p.runId),runId:f.p.runId,operationId:p.operationId,requestHash:p.requestHash,ifMatch:'"r'+current.resourceRevision+'"'};assert.equal((await f.call('failUnsentAcceptancePreparation',cancel)).state,'FAILED');assert.equal((await f.call('failUnsentAcceptancePreparation',cancel)).errorCode,'ACCEPTANCE_NOT_SENT');assert.equal((await f.call('markAcceptancePreparationSent',f.bound(p))).dispatch,false);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
test('intent/history/operation/event and dispatch observation roll back atomically before original-key recovery',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),input=await f.request(),before=await f.call('getRun',{runId:f.p.runId});f.db.exec("CREATE TRIGGER cut_acceptance BEFORE INSERT ON acceptance_preparation_history BEGIN SELECT RAISE(ABORT,'acceptance-cut'); END");
  await assert.rejects(begin(f,input),/acceptance-cut/);assert.equal(f.get('SELECT count(*) n FROM acceptance_preparations').n,0);assert.equal(await f.call('lookupOperation',input.meta),null);assert.deepEqual(await f.call('getRun',{runId:f.p.runId}),before);f.db.exec('DROP TRIGGER cut_acceptance');
  const p=await begin(f,input),after=await f.call('getRun',{runId:f.p.runId});f.db.exec("CREATE TRIGGER cut_acceptance_event BEFORE INSERT ON events WHEN NEW.type='AcceptancePreparationChanged' BEGIN SELECT RAISE(ABORT,'acceptance-event-cut'); END");
  await assert.rejects(f.call('markAcceptancePreparationSent',f.bound(p)),/acceptance-event-cut/);assert.equal((await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).state,'PREPARED');assert.deepEqual(await f.call('getRun',{runId:f.p.runId}),after);f.db.exec('DROP TRIGGER cut_acceptance_event');assert.equal((await f.call('markAcceptancePreparationSent',f.bound(p))).dispatch,true);
});
test('permissions, displayed hashes, original keys and replacement confirmation cannot create authority from caller fields',{timeout:180000},async t=>{
  const f=await acceptanceFixture(t),input=await f.request();
  await assert.rejects(begin(f,{...input,ifMatch:undefined}),{code:'PRECONDITION_REQUIRED'});
  await assert.rejects(begin(f,{...input,ifMatch:'"r1"'}),{code:'PRECONDITION_FAILED'});
  for(const override of [{reviewHash:hash('old')},{manifestHash:hash('other')},{candidateRevision:2},{expectedAcceptedReleaseId:'release_old'},{dataPlanHash:hash('other plan')}])await assert.rejects(begin(f,{...input,...override}));
  await assert.rejects(begin(f,{...input,healthy:true}),{code:'SCHEMA_INVALID'});
  const {policyHash:_policyHash,...decisionInput}=input;
  await assert.rejects(f.call('recordAcceptanceReplacementDecision',{...decisionInput,decisionId:'decision_fake',confirmation:'REPLACE_ACCEPTED_DATA'}),{code:'ACCEPTANCE_REPLACEMENT_NOT_APPLICABLE'});
  const p=await begin(f,input);await assert.rejects(begin(f,{...input,dataPlanHash:hash('altered key payload')}),{code:'IDEMPOTENCY_KEY_REUSED'});
  await assert.rejects(f.call('markAcceptancePreparationSent',{...f.bound(p),principalId:'user_1'}),{code:'FORBIDDEN'});await assert.rejects(f.call('markAcceptancePreparationSent',{...f.bound(p),requestHash:hash('wrong request')}),{code:'ACCEPTANCE_REQUEST_CHANGED'});
  await assert.rejects(f.call('getAcceptancePreparation',{principalId:'outside.fixture',operationId:p.operationId}));
  f.run("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",f.p.projectId);await assert.rejects(begin(f,input),{code:'FORBIDDEN'});assert.equal((await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).qualification,'STALE');await assert.rejects(f.call('markAcceptancePreparationSent',f.bound(p)),{code:'ACCEPTANCE_BASIS_CHANGED'});
  assert.equal(f.get('SELECT count(*) n FROM acceptance_data_decisions').n,0);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
});
