import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openRunnerStore} from '../packages/runner/dist/index.mjs';
import {retirementFixture,hash,canonical} from './fixtures/release-retirement.mjs';
import {bound} from './fixtures/acceptance-service-backend.mjs';
import {historicalV9Fixture} from './fixtures/runner-version.mjs';
import {previewStartRequest} from '../packages/storage-sqlite/dist/index.mjs';
const kinds=['REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE'];

test('formal control T5 retires only its exact readonly service and preserves data, proof and PENDING publication',async t=>{
 const f=await retirementFixture(t),r=await f.reservation(),j=await f.journal(),bytes=await readFile(f.data.pathsFor(f.preparation).databasePath),saved=f.sql(db=>db.prepare('SELECT * FROM acceptance_service_proofs').get());
 const result=await f.backend.retire(f.publication,async()=>true);
 assert.equal(result.revoked,true);assert.equal(result.containerCleared,true);assert.equal(result.networkCleared,true);assert.equal(result.reservation.state,'REMOVED');assert.equal(result.reservation.custodyState,'RELEASE_HELD');assert.deepEqual(result.reservation.claim,r.claim);assert.deepEqual(result.original,j);
 assert.deepEqual(result.actions.map(a=>a.request.kind).sort(),[...kinds].sort());for(const a of result.actions){assert.equal(a.state,'OBSERVED');assert.equal(a.request.profileHash,j.profileHash);assert.equal(a.request.networkId,j.networkId);assert.equal(a.request.containerId,j.containerId);}
 assert.deepEqual(await readFile(f.data.pathsFor(f.preparation).databasePath),bytes);assert.deepEqual(f.sql(db=>db.prepare('SELECT * FROM acceptance_service_proofs').get()),saved);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);assert.equal(f.data.authority.acquisitions,1);
 assert.deepEqual(f.mutations(),['NETWORK_CREATE','CREATE','START','STOP','CONTAINER_REMOVE','NETWORK_REMOVE']);assert.deepEqual(f.authority.calls,['REVOKE_PREPARATION']);
 const p=await f.control.call('getReleasePublication',{principalId:f.publication.request.preparation.backendPrincipalId,releaseId:f.publication.releaseId});assert.equal(p.state,'SENT');assert.equal(p.proof,null);assert.equal(f.control.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',r.request.preparation.target.datasetId).state,'CLOSED');assert.equal(f.control.get('SELECT count(*) n FROM releases').n,1);
 await f.reopen(true);assert.deepEqual(await f.backend.inspect(f.publication),result);assert.deepEqual(await f.backend.retire(f.publication,async()=>true),result);assert.deepEqual(await f.store.request('acceptanceServicePrepareProof',bound(r)),JSON.parse(saved.proof_json));assert.deepEqual((await f.store.request('inspect',{})).foreignKeyErrors,[]);
});

test('enrollment and stage grants are unique across concurrent requests and restart',async t=>{
 const f=await retirementFixture(t),grants=await Promise.all(Array.from({length:8},()=>f.enroll()));assert.equal(grants.filter(g=>g.dispatch).length,1);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 const a=await Promise.all(Array.from({length:8},()=>f.store.request('releaseRetirementActionBegin',{...f.binding,kind:'REVOKE_PREPARATION'})));assert.equal(a.filter(g=>g.dispatch).length,1);await f.reopen(true);assert.equal((await f.enroll()).dispatch,false);assert.equal((await f.store.request('releaseRetirementActionBegin',{...f.binding,kind:'REVOKE_PREPARATION'})).dispatch,false);
 const b=await f.backend.retire(f.publication,async()=>true);assert.equal(b.actions.length,1);assert.equal(b.revoked,false);assert.deepEqual(f.authority.calls,['query-revocation']);assert.deepEqual(f.mutations(),['NETWORK_CREATE','CREATE','START']);
});

test('lost physical ACKs recover only the original granted stage without issuing subsequent actions',async t=>{
 for(const kind of kinds)await t.test(kind,async t=>{
  const f=await retirementFixture(t);if(kind==='REVOKE_PREPARATION')f.authority.failAfter=true;else f.driver.failAfter=kind;
  const before=await f.backend.retire(f.publication,async()=>true),a=before.actions.find(a=>a.request.kind===kind);assert.equal(a.state,'SENT');const calls=[...f.mutations()],acquisitions=f.authority.calls.filter(x=>x==='REVOKE_PREPARATION').length;
  await f.reopen(true);const after=await f.backend.inspect(f.publication);assert.equal(after.actions.find(a=>a.request.kind===kind).state,'OBSERVED');assert.equal(after.actions.length,kinds.indexOf(kind)+1);assert.deepEqual(f.mutations(),calls);assert.equal(f.authority.calls.filter(x=>x==='REVOKE_PREPARATION').length,acquisitions);
  assert.equal((await f.store.request('capacityUsage',{})).usage.slots,['CONTAINER_REMOVE','NETWORK_REMOVE'].includes(kind)?0:1);await f.backend.retire(f.publication,async()=>true);assert.deepEqual(f.mutations(),calls);
 });
});

test('capacity, absence observation and service history roll back together on writer failure',async t=>{
 const f=await retirementFixture(t);f.sql(db=>db.exec("CREATE TRIGGER retirement_event_cut BEFORE INSERT ON acceptance_service_events WHEN json_extract(NEW.snapshot_json,'$.state')='REMOVED' BEGIN SELECT RAISE(ABORT,'EXPLICIT_RETIREMENT_EVENT_CUT'); END"));
 let j=await f.backend.retire(f.publication,async()=>true);assert.equal(j.actions.find(a=>a.request.kind==='CONTAINER_REMOVE').state,'SENT');assert.equal(j.reservation.state,'ACTIVE');assert.equal(j.networkCleared,false);assert.equal(f.driver.containers.size,0);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 f.sql(db=>db.exec('DROP TRIGGER retirement_event_cut'));await f.reopen(true);j=await f.backend.inspect(f.publication);assert.equal(j.containerCleared,true);assert.equal(j.networkCleared,false);assert.equal(j.reservation.state,'REMOVED');assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);assert.equal(f.mutations().filter(x=>x==='CONTAINER_REMOVE').length,1);assert.equal(f.mutations().includes('NETWORK_REMOVE'),false);
});

test('predecessors, exact identities, hashes and immutable observations cannot be bypassed',async t=>{
 const f=await retirementFixture(t);await f.enroll();await assert.rejects(f.store.request('releaseRetirementActionBegin',{...f.binding,kind:'STOP'}),{code:'RELEASE_RETIREMENT_PREDECESSOR_UNKNOWN'});await assert.rejects(f.store.request('releaseRetirementGet',{...f.binding,controllerId:'wrong.controller'}),{code:'RELEASE_RETIREMENT_NOT_FOUND'});await assert.rejects(f.store.request('releaseRetirementGet',{...f.binding,requestHash:'0'.repeat(64)}),{code:'RELEASE_RETIREMENT_IDENTITY_CHANGED'});
 const g=await f.store.request('releaseRetirementActionBegin',{...f.binding,kind:'REVOKE_PREPARATION'}),proof=await f.authority.revoke(f.request,f.binding.controllerId,async()=>true),observation={kind:'REVOKE_PREPARATION',proof,checkedAt:new Date().toISOString()},i={...f.binding,kind:'REVOKE_PREPARATION',actionRequestHash:g.action.requestHash,observation};
 await assert.rejects(f.store.request('releaseRetirementActionObserve',{...i,observation:{...observation,proof:{...proof,releaseId:'release_other'}}}),{code:'RELEASE_RETIREMENT_REVOCATION_CHANGED'});await assert.rejects(f.store.request('releaseRetirementActionObserve',{...i,observation:{...observation,checkedAt:new Date(Date.now()+60000).toISOString()}}),{code:'RELEASE_RETIREMENT_OBSERVATION_STALE'});await f.store.request('releaseRetirementActionObserve',i);await f.store.request('releaseRetirementActionObserve',i);await assert.rejects(f.store.request('releaseRetirementActionObserve',{...i,observation:{...observation,proof:{...proof,generation:2}}}),{code:'RELEASE_RETIREMENT_ACTION_IMMUTABLE'});
 await f.observe('STOP');await assert.rejects(f.observe('CONTAINER_REMOVE',{objectId:'c'.repeat(64)}),{code:'RELEASE_RETIREMENT_IDENTITY_CHANGED'});assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
});

test('wrong original proof, closed gates and controller fail before any physical stage',async t=>{
 for(const change of [r=>({...r,promotionRequestHash:'0'.repeat(64)}),r=>({...r,gates:{...r.gates,targetGate:{...r.gates.targetGate,state:'OPEN'}}}),r=>{r=JSON.parse(JSON.stringify(r));r.promotion.preparedProof.service.claim.profileHash='0'.repeat(64);r.promotion.proofHash=hash(canonical(r.promotion.preparedProof));r.promotionRequestHash=hash(canonical(r.promotion));return r;}]){
  const f=await retirementFixture(t),request=change(f.request);await assert.rejects(f.store.request('releaseRetirementEnroll',{controllerId:f.binding.controllerId,request,requestHash:hash(canonical(request))}));assert.equal(f.sql(db=>db.prepare('SELECT count(*) n FROM release_retirements').get().n),0);assert.deepEqual(f.authority.calls,[]);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 }
});

test('failed absence queries retain capacity and failed revocation cannot authorize STOP',async t=>{
 const f=await retirementFixture(t);f.driver.queryFails=true;let j=await f.backend.retire(f.publication,async()=>true);assert.equal(j.containerCleared,false);assert.equal(j.reservation.state,'ACTIVE');assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);f.driver.queryFails=false;j=await f.backend.inspect(f.publication);assert.equal(j.containerCleared,true);assert.equal(j.networkCleared,false);
 const g=await retirementFixture(t);g.authority.failAfter=true;g.authority.queryFails=true;await g.backend.retire(g.publication,async()=>true);await g.backend.inspect(g.publication);assert.equal(g.mutations().includes('STOP'),false);assert.equal((await g.store.request('capacityUsage',{})).usage.slots,1);
});

test('missing authority, denied control, forged publication and replay without enrollment remain closed',async t=>{
 const f=await retirementFixture(t);f.authority.configured=false;await assert.rejects(f.backend.retire(f.publication,async()=>true),{code:'RELEASE_RETIREMENT_NOT_CONFIGURED'});f.authority.configured=true;await assert.rejects(f.backend.retire(f.publication,async()=>false),{code:'RELEASE_RETIREMENT_AUTHORITY_CLOSED'});await assert.rejects(f.backend.inspect(f.publication),{code:'RELEASE_RETIREMENT_NOT_FOUND'});
 const forged={...f.publication,basis:{...f.publication.basis,targetGate:{...f.publication.basis.targetGate,fence:99}}};await assert.rejects(f.backend.retire(forged,async()=>true),{code:'RELEASE_RETIREMENT_IDENTITY_CHANGED'});const deny={async request(m,i){if(m==='verifyReleasePublication')return {allowed:false};return f.control.storage.request(m,i);}};await assert.rejects(f.makeBackend(f.store,deny).retire(f.publication,async()=>true),{code:'RELEASE_RETIREMENT_AUTHORITY_CLOSED'});assert.deepEqual(f.authority.calls,[]);assert.deepEqual(f.mutations(),['NETWORK_CREATE','CREATE','START']);
});

test('new facts and arbitrary dataset reservations remain fenced after capacity is released',async t=>{
 const f=await retirementFixture(t),r=await f.reservation();await f.backend.retire(f.publication,async()=>true);await assert.rejects(f.store.request('acceptanceServiceRecord',{...bound(r),expectedRevision:r.revision,fact:{...r.fact,state:'UNHEALTHY',checkedAt:new Date().toISOString()}}),{code:'RELEASE_RETIREMENT_ENROLLED'});
 await assert.rejects(f.store.request('acceptanceServiceReserve',{controllerId:'other.controller',request:r.request,requestHash:r.requestHash,resourceLimits:r.resourceLimits,capacity:f.options.capacity}),{code:'ACCEPTANCE_SERVICE_BUSY'});
 const p=r.request.preparation,preview=previewStartRequest.parse({schemaVersion:'devmesh.preview-start.v1',operationId:'op_retirement_other_preview',projectId:p.projectId,runId:p.runId,candidateId:p.candidateId,policyHash:p.policyHash,backendRef:'preview.controlled.fixture',runnerId:p.runnerId,previewId:'preview_retirement_other',datasetId:p.target.datasetId,imageDigest:p.image.imageDigest,manifestHash:p.manifestHash,storageKey:p.target.storageKey,datasetOperationId:p.operationId,templateVersion:p.dataPlan.templateVersion,schemaRevision:p.target.schemaRevision,imageIdentity:p.image,expiresAt:new Date(Date.now()+3600000).toISOString()});
 await assert.rejects(f.store.request('previewReserve',{controllerId:'other.preview.controller',request:preview,requestHash:hash(canonical(preview)),resourceLimits:r.resourceLimits,capacity:f.options.capacity}),{code:'PREVIEW_RESERVATION_BUSY'});
 f.sql(db=>{assert.throws(()=>db.exec("UPDATE release_retirements SET original_json='{}'"),/RETIREMENT_IMMUTABLE/);assert.throws(()=>db.exec('DELETE FROM release_retirements'),/RETIREMENT_IMMUTABLE/);assert.throws(()=>db.exec("UPDATE release_retirement_actions SET observation_json='{}'"),/ACTION_IMMUTABLE/);assert.throws(()=>db.prepare("UPDATE acceptance_services SET state='ACTIVE',released_at=NULL WHERE reservation_id=?").run(r.reservationId));assert.throws(()=>db.prepare('INSERT INTO acceptance_services SELECT NULL,reservation_id||?,controller_id||?,operation_id||?,release_id||?,dataset_id,purpose,request_hash,request_json,limits_json,state,revision,instance_id,endpoint_json,fact_json,custody_state,claim_json,claim_hash,created_at,updated_at,released_at FROM acceptance_services WHERE reservation_id=?').run('x','x','x','x',r.reservationId),/HANDOFF_HELD/);});
});

test('private retirement and abort enrollment remain mutually exclusive; no post-T5 public abort is asserted',async t=>{
 const decision=f=>{const q=f.request.promotion.preparation,d={schemaVersion:'devmesh.acceptance-abort-decision.v1',operationId:'op_explicit_mutual_exclusion_abort',preparation:q,preparationRequestHash:hash(canonical(q)),preparationRevision:2,preparedProofHash:f.request.promotion.proofHash,requestedBy:'owner.explicit.fixture',reason:'Explicit private writer mutual exclusion only; not a valid post-T5 control decision.',decidedAt:new Date().toISOString()};return {controllerId:f.binding.controllerId,decision:d,decisionHash:hash(canonical(d))};};
 const f=await retirementFixture(t);await f.enroll();await assert.rejects(f.store.request('acceptanceAbortEnroll',decision(f)),{code:'RELEASE_RETIREMENT_ENROLLED'});assert.equal(f.sql(db=>db.prepare('SELECT count(*) n FROM acceptance_service_aborts').get().n),0);
 const g=await retirementFixture(t);await g.store.request('acceptanceAbortEnroll',decision(g));await assert.rejects(g.enroll(),{code:'ACCEPTANCE_ABORT_REQUESTED'});assert.equal(g.sql(db=>db.prepare('SELECT count(*) n FROM release_retirements').get().n),0);assert.equal((await g.store.request('capacityUsage',{})).usage.slots,1);assert.deepEqual(g.authority.calls,[]);assert.equal(g.mutations().includes('STOP'),false);
});

test('retirement recovery pagination is controller-scoped and keeps network cleanup after capacity release',async t=>{
 const f=await retirementFixture(t);f.driver.failAfter='CONTAINER_REMOVE';await f.backend.retire(f.publication,async()=>true);await f.backend.inspect(f.publication);const page=await f.store.request('releaseRetirementPage',{controllerId:f.binding.controllerId,limit:1});assert.equal(page.items.length,1);assert.equal(page.items[0].reservation.releasedAt!==null,true);assert.equal(page.nextSequence,null);assert.deepEqual(await f.store.request('releaseRetirementPage',{controllerId:'other.controller'}),{items:[],nextSequence:null});
});

test('v9 to v10 preserves held services and old migration hashes; failed upgrade is atomic and drift closes restart',async t=>{
 const f=await retirementFixture(t);await f.closeCurrent();f.sql(db=>historicalV9Fixture(db));const names=['acceptance_services','acceptance_service_profiles','acceptance_service_actions','acceptance_service_proofs','acceptance_service_events','acceptance_service_aborts','acceptance_abort_actions','preview_reservations','jobs','runner_schema_history'],before=f.sql(db=>Object.fromEntries(names.map(n=>[n,db.prepare('SELECT * FROM '+n+' ORDER BY rowid').all()])));
 f.sql(db=>db.exec("CREATE TRIGGER retirement_migration_cut BEFORE INSERT ON runner_schema_history WHEN NEW.version=10 BEGIN SELECT RAISE(ABORT,'EXPLICIT_V10_CUT'); END"));await assert.rejects(openRunnerStore({...f.store.options,initialize:false}));f.sql(db=>{assert.equal(db.prepare('PRAGMA user_version').get().user_version,9);assert.equal(db.prepare('SELECT version FROM runner_identity').get().version,9);assert.equal(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='release_retirements'").get(),undefined);for(const n of names)assert.deepEqual(db.prepare('SELECT * FROM '+n+' ORDER BY rowid').all(),before[n]);db.exec('DROP TRIGGER retirement_migration_cut');});
 await f.reopen();assert.equal((await f.store.request('inspect',{})).version,10);f.sql(db=>{for(const n of names.filter(n=>n!=='runner_schema_history'))assert.deepEqual(db.prepare('SELECT * FROM '+n+' ORDER BY rowid').all(),before[n]);assert.deepEqual(db.prepare('SELECT * FROM runner_schema_history WHERE version<10 ORDER BY rowid').all(),before.runner_schema_history);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);});await f.closeCurrent();f.sql(db=>db.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=10').run('0'.repeat(64)));await assert.rejects(openRunnerStore({...f.store.options,initialize:false}),{code:'RUNNER_MIGRATION_DRIFT'});
});
