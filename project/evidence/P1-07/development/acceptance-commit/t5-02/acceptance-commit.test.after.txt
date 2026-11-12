// Actual file-backed control Worker/SQLite transactions and formal upstream
// verification. Runner/fences/health below are explicit protocol fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {backup,DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {openStorage} from '../packages/storage-sqlite/dist/index.mjs';
import {LocalContentStore} from '../packages/blob-store/dist/index.mjs';
import {ReleaseAcceptor,AcceptancePreparer} from '../packages/platform-core/dist/index.mjs';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {binding,preparedObservation} from './fixtures/acceptance-readiness.mjs';
import {hash,canonical,meta} from './fixtures/storage-data.mjs';

async function copy(t,base){
 const root=await mkdtemp(join(base.root,'commit-')),databasePath=join(root,'control.sqlite');await backup(base.db,databasePath);
 const db=new DatabaseSync(databasePath);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');const storeId=db.prepare('SELECT store_id FROM store_metadata').get().store_id;let storage=await openStorage({databasePath,storeId});
 t.after(async()=>{await storage.close();db.close();await rm(root,{recursive:true,force:true});});
 const client={request:(m,i)=>storage.request(m,i)};
 return {...base,storage:client,content:new LocalContentStore(client,base.content.dataRoot,0,base.provider),db,get:(s,...p)=>db.prepare(s).get(...p),run:(s,...p)=>db.prepare(s).run(...p),call:(m,i)=>storage.request(m,i),async reopen(){await storage.close();storage=await openStorage({databasePath,storeId});}};
}
async function ready(f){
 const p=await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:f.prepared.operationId}),o=structuredClone(f.observation);o.checkedAt=new Date().toISOString();
 const old=await f.call('getAcceptanceReadiness',binding(f,p));
 const value=await f.call('recordAcceptancePreparationObservation',{...binding(f,p),expectedPreparationRevision:p.revision,expectedSequence:old.sequence,observation:o});return {p,value};
}
async function input(f,patch={}){
 const {p,value}=await ready(f),r=await f.call('getRun',{runId:p.runId});
 return {meta:meta(p.runId),runId:p.runId,ifMatch:'"r'+r.resourceRevision+'"',preparationOperationId:p.operationId,requestHash:p.requestHash,expectedPreparationRevision:p.revision,expectedObservationSequence:value.sequence,proofHash:value.proofHash,...Object.fromEntries(['candidateId','candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash'].map(k=>[k,p.request[k]])),confirmation:'ACCEPT_RELEASE',...patch};
}
const commit=(f,i)=>f.call('commitReleaseAcceptance',i);
async function unknownWrite(f){
 const principalId='preview.commit.fixture',policy={schemaVersion:'devmesh.preview-backend.v1',backendPrincipalId:principalId,backendRef:'preview.commit.fixture.backend',runnerId:f.policy.runnerId,templateVersion:f.policy.templateVersion,schemaRevision:f.policy.schemaRevision,retentionDays:30,initialModes:['EMPTY','DEMO'],allowSnapshots:true},registered=await f.call('registerPreviewBackendPolicy',{principalId:'user_1',projectId:f.p.projectId,policy}),conditional=async()=>({meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+(await f.call('getRun',{runId:f.p.runId})).resourceRevision+'"',candidateId:f.candidate.candidateId,manifestHash:f.candidate.manifestHash});
 const dataset=await f.call('createPreviewDataset',{...await conditional(),policyHash:registered.policyHash}),effect=id=>f.call('getPreviewEffect',{principalId,operationId:id}),bound=e=>({principalId,operationId:e.operationId,requestHash:e.requestHash,expectedRevision:e.revision});
 let e=(await f.call('markPreviewEffectSent',bound(await effect(dataset.operationId)))).effect;
 await f.call('recordPreviewEffectObservation',{...bound(e),observation:{state:'SUCCEEDED',receipt:{kind:'DATASET_READY',datasetId:dataset.datasetId,storageKey:dataset.storageKey,originDatasetId:null,schemaRevision:dataset.schemaRevision,snapshotAt:new Date().toISOString(),sha256:hash('explicit preview dataset'),byteSize:4096,integrity:'ok'}}});
 const preview=await f.call('createPreviewIntent',{...await conditional(),datasetId:dataset.datasetId,expiresAt:new Date(Date.now()+3600000).toISOString()});e=(await f.call('markPreviewEffectSent',bound(await effect(preview.operationId)))).effect;
 const fact={previewId:preview.previewId,datasetId:dataset.datasetId,imageDigest:preview.imageDigest,state:'HEALTHY',instanceId:'instance.commit.preview.fixture',endpoint:{host:'127.0.0.1',port:19801},checkedAt:new Date().toISOString()};await f.call('recordPreviewRuntimeObservation',{principalId,operationId:e.operationId,requestHash:e.requestHash,expectedSequence:0,fact});await f.call('recordPreviewEffectObservation',{...bound(e),observation:{state:'SUCCEEDED',receipt:{kind:'PREVIEW_READY',previewId:preview.previewId,datasetId:dataset.datasetId,imageDigest:preview.imageDigest,instanceId:fact.instanceId,healthy:true,checkedAt:fact.checkedAt}}});
 const de=await effect(dataset.operationId);await f.call('enrollPreviewWriteGate',{principalId,datasetOperationId:de.operationId,datasetRequestHash:de.requestHash});const accessPolicy={schemaVersion:'devmesh.preview-access-policy.v1',gatewayId:'gateway.commit.fixture',gatewayPrincipalId:'gateway.commit.service',configurationHash:hash('explicit gateway config')};await f.call('registerPreviewAccessPolicy',{principalId:'user_1',projectId:f.p.projectId,policy:accessPolicy});
 const gateway={principalId:accessPolicy.gatewayPrincipalId,gatewayId:accessPolicy.gatewayId,configurationHash:accessPolicy.configurationHash},access=await f.call('preparePreviewAccessRequest',{...gateway,subjectPrincipalId:'user_1',runId:f.p.runId,previewId:preview.previewId,accessRequestId:meta().idempotencyKey,request:{method:'POST',path:'/api/tasks',bodySha256:hash('explicit unknown write')}}),b={...gateway,accessRequestId:access.accessRequestId,requestHash:access.requestHash};assert.equal((await f.call('beginPreviewAccessRequest',b)).dispatch,true);await f.call('recordPreviewAccessObservation',{...b,observation:{state:'UNKNOWN',errorCode:'EXPLICIT_WRITE_ACK_LOST',checkedAt:new Date().toISOString()}});return b;
}
function unchanged(f,before){for(const table of ['releases','acceptance_commits','work_acceptance_completions','release_promotion_outbox'])assert.equal(f.get('SELECT count(*) n FROM '+table).n,0,table);assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);assert.deepEqual(f.get('SELECT * FROM runs WHERE run_id=?',f.p.runId),before);}

test('T5 preserves original automatic facts, rolls back every boundary and recovers exact committed acceptance',{timeout:480000},async t=>{
 const base=await acceptanceFixture(t,{human:true,humanWork:true}),pending=await base.call('beginAcceptancePreparation',await base.request());base.prepared=(await base.call('markAcceptancePreparationSent',base.bound(pending))).preparation;base.observation=preparedObservation(base.prepared);
 const p=base.prepared,s=base.observation.proof.service,r=p.request;
 // Use the new ACCEPTANCE purpose without claiming an actual running container.
 s.claim={schemaVersion:'devmesh.acceptance-service-claim.v1',purpose:'ACCEPTANCE',operationId:p.operationId,acceptanceRequestHash:p.requestHash,releaseId:r.releaseId,projectId:r.projectId,runId:r.runId,candidateId:r.candidateId,manifestHash:r.manifestHash,reviewHash:r.reviewHash,dataPlanHash:r.dataPlanHash,datasetId:r.target.datasetId,imageDigest:r.image.imageDigest,reservationId:s.reservationId,profileHash:s.profileHash,serviceRequestHash:hash('explicit service request'),instanceId:s.claim.instanceId};s.claimHash=hash(canonical(s.claim));base.observation.health.claimHash=s.claimHash;
 const pendingVerificationId=base.candidate.manifest.works.find(w=>w.relation==='MANUAL_PENDING')?.operationId;assert.ok(pendingVerificationId);
 await t.test('legacy proof stays readable but cannot substitute a new ACCEPTANCE service purpose',async t=>{
  const f=await copy(t,base);f.observation=preparedObservation(p);const i=await input(f);assert.equal((await f.call('getAcceptanceReadiness',binding(f,p))).state,'READY');await assert.rejects(commit(f,i),{code:'ACCEPTANCE_SERVICE_PURPOSE_REQUIRED'});assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
 for(const [name,sql] of [
  ['release',"BEFORE INSERT ON releases"],
  ['pointer',"BEFORE UPDATE OF accepted_release_id ON projects"],
  ['resolution',"BEFORE INSERT ON acceptance_commits"],
  ['human',"BEFORE INSERT ON work_acceptance_completions"],
  ['work-result',"BEFORE INSERT ON verified_work_results"],
  ['attempt',"BEFORE UPDATE OF state ON attempts WHEN NEW.state='SUCCEEDED'"],
  ['slot',"BEFORE DELETE ON role_slots"],
  ['grant',"BEFORE UPDATE ON execution_grants WHEN NEW.status='REVOKED'"],
  ['assessment',"BEFORE UPDATE ON work_verifications WHEN NEW.state='APPLIED'"],
  ['run',"BEFORE UPDATE OF terminal_outcome ON runs WHEN NEW.terminal_outcome='COMPLETED'"],
  ['outbox',"BEFORE INSERT ON release_promotion_outbox"],
  ['event',"BEFORE INSERT ON events WHEN NEW.type='ReleaseAccepted'"],
  ['operation-result',"BEFORE UPDATE ON operations WHEN NEW.kind='CommitReleaseAcceptance' AND NEW.status='SUCCEEDED'"],
 ])await t.test('rollback at '+name,async t=>{
  const f=await copy(t,base),i=await input(f),before=f.get('SELECT * FROM runs WHERE run_id=?',f.p.runId),verification=f.get('SELECT * FROM work_verifications WHERE operation_id=?',pendingVerificationId),attempt=f.get('SELECT * FROM attempts WHERE attempt_id=?',verification.attempt_id),slots=f.get('SELECT count(*) n FROM role_slots').n,events=f.get('SELECT count(*) n FROM events').n;
  f.db.exec("CREATE TRIGGER cut_t5 "+sql+" BEGIN SELECT RAISE(ABORT,'T5-cut'); END");await assert.rejects(commit(f,i),/T5-cut/);unchanged(f,before);assert.equal(await f.call('lookupOperation',i.meta),null);assert.deepEqual(f.get('SELECT * FROM work_verifications WHERE operation_id=?',pendingVerificationId),verification);assert.deepEqual(f.get('SELECT * FROM attempts WHERE attempt_id=?',attempt.attempt_id),attempt);assert.equal(f.get('SELECT count(*) n FROM role_slots').n,slots);assert.equal(f.get('SELECT count(*) n FROM events').n,events);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
  f.db.exec('DROP TRIGGER cut_t5');assert.equal((await commit(f,i)).status,'SUCCEEDED');
 });
 await t.test('reject wrong versions, authority, proof, scope and pointer without partial facts',async t=>{
  const f=await copy(t,base),i=await input(f),before=f.get('SELECT * FROM runs WHERE run_id=?',f.p.runId);
  for(const [patch,code] of [[{ifMatch:undefined},'PRECONDITION_REQUIRED'],[{ifMatch:'"r1"'},'PRECONDITION_FAILED'],[{requestHash:hash('wrong')},'ACCEPTANCE_REQUEST_CHANGED'],[{expectedPreparationRevision:1},'ACCEPTANCE_REVISION_CHANGED'],[{expectedObservationSequence:99},'ACCEPTANCE_OBSERVATION_CHANGED'],[{proofHash:hash('wrong')},'ACCEPTANCE_OBSERVATION_CHANGED'],[{manifestHash:hash('other')},'ACCEPTANCE_BASIS_CHANGED'],[{reviewHash:hash('other')},'ACCEPTANCE_BASIS_CHANGED'],[{expectedAcceptedReleaseId:'release_wrong'},'ACCEPTANCE_BASIS_CHANGED'],[{dataPlanHash:hash('other')},'ACCEPTANCE_BASIS_CHANGED'],[{meta:{...i.meta,scopeId:'run_wrong'}},'OPERATION_SCOPE_INVALID']]){await assert.rejects(commit(f,{...i,...patch}),{code});unchanged(f,before);}
  await assert.rejects(commit(f,{...i,healthy:true}),{code:'SCHEMA_INVALID'});
  f.run("UPDATE project_members SET role='viewer' WHERE principal_id='user_1' AND project_id=?",f.p.projectId);await assert.rejects(commit(f,i),{code:'FORBIDDEN'});unchanged(f,before);
 });
 await t.test('missing material, changed review and unknown preparation close acceptance',async t=>{
  const f=await copy(t,base),i=await input(f),original=base.candidate.preflightHashes[0];
  f.run("UPDATE content_objects SET state='MISSING' WHERE content_hash=?",original);await assert.rejects(commit(f,i));assert.equal(f.get('SELECT count(*) n FROM releases').n,0);f.run("UPDATE content_objects SET state='READY' WHERE content_hash=?",original);
  const u=await f.call('markAcceptancePreparationUnknown',{...f.bound(p),errorCode:'EXPLICIT_ACK_UNCERTAIN'}),current=await f.call('getRun',{runId:p.runId});await assert.rejects(commit(f,{...i,expectedPreparationRevision:u.revision,ifMatch:'"r'+current.resourceRevision+'"'}),{code:'ACCEPTANCE_BACKEND_UNCERTAIN'});
  const j=await input(f),v=await f.call('getCandidateReview',f.who),item=v.items[0];await f.call('recordCandidateReview',{meta:meta(p.runId),runId:p.runId,candidateId:p.candidateId,ifMatch:j.ifMatch,manifestHash:p.request.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result.resultId,verdict:'FAIL',procedure:'Explicit changed fixture.',expected:item.expected,observed:'No longer passes.',evidence:[]});const after=await f.call('getRun',{runId:p.runId});await assert.rejects(commit(f,{...j,ifMatch:'"r'+after.resourceRevision+'"'}),{code:'ACCEPTANCE_BASIS_CHANGED'});assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
 await t.test('unknown HTTP writes survive Worker restart and prevent acceptance',async t=>{
  const f=await copy(t,base),i=await input(f),b=await unknownWrite(f);await f.reopen();const current=await f.call('getRun',{runId:p.runId});await assert.rejects(commit(f,{...i,ifMatch:'"r'+current.resourceRevision+'"'}),{code:'ACCEPTANCE_EFFECT_UNRESOLVED'});assert.equal((await f.call('getPreviewAccessRequest',b)).state,'UNKNOWN');assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT count(*) n FROM release_promotion_outbox').n,0);
 });
 await t.test('trusted preflight verifies real content bytes and writer rejects a basis changed during I/O',async t=>{
  const f=await copy(t,base),i=await input(f);let reads=0;
  const bad={async readBytes(...args){reads++;const bytes=Buffer.from(await f.content.readBytes(...args));if(reads===1)return Buffer.from('explicit corrupted preflight bytes');return bytes;}};
  await assert.rejects(new ReleaseAcceptor(f.storage,bad).accept(i),{code:'ACCEPTANCE_CONTENT_UNAVAILABLE'});assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(await f.call('lookupOperation',i.meta),null);
  const race={async readBytes(...args){const bytes=await f.content.readBytes(...args);if(++reads===2)f.run('UPDATE runs SET run_epoch=run_epoch+1 WHERE run_id=?',p.runId);return bytes;}};await assert.rejects(new ReleaseAcceptor(f.storage,race).accept(i));assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
 await t.test('trusted acceptor reads actual frozen materials once and skips preflight after committed ACK loss',async t=>{
  const f=await copy(t,base),i=await input(f);let reads=0;const content={async readBytes(...args){reads++;return f.content.readBytes(...args);}},acceptor=new ReleaseAcceptor(f.storage,content),value=await acceptor.accept(i);assert.equal(value.status,'SUCCEEDED');assert.equal(reads,base.candidate.preflightHashes.length);await f.reopen();
  const recovered=await new ReleaseAcceptor(f.storage,{readBytes(){throw Error('committed ACK must not reread');}}).accept(i);assert.deepEqual(recovered,value);assert.equal((await new AcceptancePreparer(f.storage,f.policy.backendPrincipalId).advance(p.operationId)).state,'STALE');assert.equal(f.get('SELECT count(*) n FROM releases').n,1);
 });
 await t.test('concurrent exact acceptance, immutable history, terminal ACK and retained dedicated promotion',async t=>{
  const f=await copy(t,base),i=await input(f),other={...i,meta:meta(i.runId)},assessment=f.get('SELECT evaluation_json FROM work_verifications WHERE operation_id=?',pendingVerificationId).evaluation_json,manifest=f.get('SELECT manifest_json FROM release_candidates WHERE candidate_id=?',r.candidateId).manifest_json,proof=f.get('SELECT * FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId);
  const outcomes=await Promise.allSettled([commit(f,i),commit(f,other)]);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);const value=outcomes[0].value;assert.equal(value.status,'SUCCEEDED');assert.equal(value.result.acceptanceState,'ACCEPTED');assert.equal(value.result.publicationState,'PENDING');assert.equal(value.result.datasetId,r.target.datasetId);
  assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',r.projectId).accepted_release_id,r.releaseId);assert.equal((await f.call('getRun',{runId:r.runId})).terminalOutcome,'COMPLETED');assert.ok(f.get('SELECT ended_at FROM runs WHERE run_id=?',r.runId).ended_at);assert.equal(f.get('SELECT count(*) n FROM role_slots WHERE run_id=?',r.runId).n,0);
  const human=f.get('SELECT * FROM work_acceptance_completions');assert.equal(human.review_hash,r.reviewHash);assert.ok(JSON.parse(human.result_ids_json).length>=2);assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',human.attempt_id).state,'SUCCEEDED');assert.equal(f.get('SELECT outcome FROM verified_work_results WHERE attempt_id=?',human.attempt_id).outcome,'success');assert.equal(f.get('SELECT evaluation_json FROM work_verifications WHERE operation_id=?',pendingVerificationId).evaluation_json,assessment);assert.equal(f.get('SELECT manifest_json FROM release_candidates WHERE candidate_id=?',r.candidateId).manifest_json,manifest);assert.deepEqual(f.get('SELECT * FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId),proof);
  const promotion=f.get('SELECT * FROM release_promotion_outbox'),intent=JSON.parse(promotion.request_json);assert.equal(hash(promotion.request_json),promotion.request_hash);assert.equal(intent.acceptanceOperationId,value.operationId);assert.deepEqual(intent.preparation,p.request);assert.deepEqual(intent.preparedProof,base.observation.proof);assert.equal(f.get('SELECT count(*) n FROM outbox WHERE operation_id=?',value.operationId).n,0);
  for(const table of ['releases','acceptance_commits','work_acceptance_completions','release_promotion_outbox']){assert.throws(()=>f.run('DELETE FROM '+table),/IMMUTABLE/);assert.throws(()=>f.run('UPDATE '+table+' SET '+(table==='work_acceptance_completions'?'review_hash':table==='release_promotion_outbox'?'request_hash':table==='releases'?'manifest_hash':'proof_hash')+'=?',hash('overwrite')),/IMMUTABLE/);assert.equal(f.get('SELECT count(*) n FROM '+table).n,1);}
  assert.equal(f.get('SELECT state FROM acceptance_preparations WHERE operation_id=?',p.operationId).state,'SENT');assert.equal((await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).resolution,'COMMITTED');await assert.rejects(f.call('markAcceptancePreparationUnknown',{...f.bound(p),errorCode:'late'}),{code:'ACCEPTANCE_ALREADY_COMMITTED'});assert.equal((await f.call('verifyAcceptancePreparation',binding(f,p))).allowed,false);
  // Simulate delivery loss after the original call, then restart the real Worker.
  await assert.rejects((async()=>{await commit(f,i);throw Error('lost committed T5 ACK');})(),/lost committed T5 ACK/);await f.reopen();assert.deepEqual(await commit(f,{...i,ifMatch:'"r1"'}),value);assert.deepEqual(await f.call('getAcceptedRelease',{principalId:'user_1',releaseId:r.releaseId}),value.result);await assert.rejects(commit(f,{...i,proofHash:hash('changed original body')}),{code:'IDEMPOTENCY_KEY_REUSED'});
  assert.equal(f.get('SELECT count(*) n FROM releases').n,1);assert.equal(f.get('SELECT count(*) n FROM release_promotion_outbox').n,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
  f.run("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",r.projectId);await assert.rejects(commit(f,i),{code:'FORBIDDEN'});f.run("DELETE FROM project_members WHERE project_id=? AND principal_id='user_1'",r.projectId);await assert.rejects(f.call('getAcceptedRelease',{principalId:'user_1',releaseId:r.releaseId}),{code:'RESOURCE_NOT_FOUND'});
 });
});

test('T5 accepts a fully automatic final Work without inventing human completions',{timeout:240000},async t=>{
 const f=await acceptanceFixture(t),pending=await f.call('beginAcceptancePreparation',await f.request());f.prepared=(await f.call('markAcceptancePreparationSent',f.bound(pending))).preparation;f.observation=preparedObservation(f.prepared);const p=f.prepared,r=p.request,s=f.observation.proof.service;
 s.claim={schemaVersion:'devmesh.acceptance-service-claim.v1',purpose:'ACCEPTANCE',operationId:p.operationId,acceptanceRequestHash:p.requestHash,releaseId:r.releaseId,projectId:r.projectId,runId:r.runId,candidateId:r.candidateId,manifestHash:r.manifestHash,reviewHash:r.reviewHash,dataPlanHash:r.dataPlanHash,datasetId:r.target.datasetId,imageDigest:r.image.imageDigest,reservationId:s.reservationId,profileHash:s.profileHash,serviceRequestHash:hash('explicit automatic service request'),instanceId:s.claim.instanceId};s.claimHash=hash(canonical(s.claim));f.observation.health.claimHash=s.claimHash;
 assert.equal(f.candidate.manifest.works.filter(w=>w.relation==='MANUAL_PENDING').length,0);const i=await input(f),value=await commit(f,i);assert.equal(value.status,'SUCCEEDED');assert.equal(f.get('SELECT count(*) n FROM work_acceptance_completions').n,0);assert.equal((await f.call('getRun',{runId:p.runId})).terminalOutcome,'COMPLETED');assert.equal(f.get('SELECT count(*) n FROM release_promotion_outbox').n,1);await f.reopen();assert.deepEqual(await commit(f,i),value);
});
