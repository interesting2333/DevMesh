// Real control/Runner Workers and template HTTP. Physical providers are fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openRunnerStore,RunnerReleaseServiceBackend,RunnerReleaseRetirementBackend} from '../packages/runner/dist/index.mjs';
import {ReleasePublisher} from '../packages/platform-core/dist/index.mjs';
import {releaseServiceFixture,hash,canonical} from './fixtures/release-service.mjs';
import {historicalV11Fixture} from './fixtures/runner-version.mjs';

const binding=f=>({principalId:f.options.principalId,releaseId:f.publication.releaseId,requestHash:f.publication.requestHash});
const current=f=>f.control.call('getReleasePublication',{principalId:f.options.principalId,releaseId:f.publication.releaseId});
const coordinator=f=>{
 const retirement=new RunnerReleaseRetirementBackend(f.store,f.control.storage,f.retirementBackend.driver,f.retirementBackend.authority,f.retirementBackend.options);
 return new ReleasePublisher(f.control.storage,f.options.principalId,new RunnerReleaseServiceBackend(f.store,f.control.storage,retirement,f.authority,f.driver,f.routes,f.options));
};
function loseReceipt(f,method,kind){
 const original=f.store.request.bind(f.store);let once=true;
 f.store.request=async(m,i)=>{const value=await original(m,i);if(once&&m===method&&(!kind||i.kind===kind)){once=false;throw Error('explicit committed '+method+' ACK loss');}return value;};
}
function counts(f){return Object.fromEntries(f.mutations().map(k=>[k,f.mutations().filter(x=>x===k).length]));}
async function assertPublishedOnce(f,p){
 assert.equal(p.state,'PUBLISHED',JSON.stringify(p));
 assert.deepEqual(counts(f),{ARM_FENCES:1,PREPARE:1,GUARD_ENFORCE:1,NETWORK_CREATE:1,CREATE:1,START:1,ROUTE_BIND:1});
 const j=await f.current();assert.equal(j.actions.length,7);assert.equal(j.profilePreparation,'EXECUTE_ONCE');
 assert.equal(f.control.get('SELECT count(*) n FROM releases').n,1);assert.equal(f.control.get('SELECT count(*) n FROM acceptance_commits').n,1);
 assert.equal(f.control.get('SELECT count(*) n FROM release_route_bindings').n,1);assert.equal((await f.store.request('capacityUsage',{})).usage.releaseServiceSlots,1);
 const proof=canonical(j.proof),before=counts(f);await coordinator(f).advance(p.releaseId);assert.deepEqual(counts(f),before);assert.equal(canonical((await f.current()).proof),proof);
 const response=await fetch(f.origin+'/api/tasks',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'continued-original-service'},body:JSON.stringify({title:'continued original service',description:'',status:'todo'}),signal:AbortSignal.timeout(5000)});assert.equal(response.status,201);
}

test('explicit continuation completes original physical stages after ACK loss and Worker termination',{timeout:300000},async t=>{
 for(const kind of ['REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE','ARM_FENCES','PROFILE_PREPARE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START','ROUTE_BIND'])await t.test(kind,async t=>{
  const f=await releaseServiceFixture(t,{dispatchPublication:false});
  if(kind==='REVOKE_PREPARATION')f.retirementBackend.authority.failAfter=true;
  else if(['STOP','CONTAINER_REMOVE','NETWORK_REMOVE'].includes(kind))f.retirementBackend.driver.failAfter=kind;
  else f.faults.failAfter=kind;
  const first=await coordinator(f).advance(f.publication.releaseId);assert.equal(first.state,'UNKNOWN');
  assert.equal((await f.control.call('verifyReleasePublication',binding(f))).allowed,false);
  assert.equal((await f.control.call('verifyReleasePublicationContinuation',binding(f))).allowed,true);
  const before=counts(f);await f.reopen(true);await f.backend.inspect(await current(f));assert.deepEqual(counts(f),before);
  const result=await coordinator(f).advance(first.releaseId);await assertPublishedOnce(f,result);
  for(const action of ['STOP','CONTAINER_REMOVE','NETWORK_REMOVE'])assert.equal(f.retirementBackend.driver.calls.filter(x=>x===action).length,1);
  assert.equal(f.retirementBackend.authority.calls.filter(x=>x==='REVOKE_PREPARATION').length,1);
 });
});

test('local journal and ownership ACK loss resumes the same enrollment, reservation, profile and proof',{timeout:210000},async t=>{
 for(const method of ['releaseRetirementEnroll','releaseServiceEnroll','releaseServiceReserve','releaseServiceProfilePrepare','releaseServiceOwn','releaseServicePrepareProof'])await t.test(method,async t=>{
  const f=await releaseServiceFixture(t,{dispatchPublication:false});loseReceipt(f,method);
  assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');
  const before=await f.current(),id=before?.reservation?.reservationId;await f.reopen(true);
  const result=await coordinator(f).advance(f.publication.releaseId);await assertPublishedOnce(f,result);if(id)assert.equal((await f.current()).reservation.reservationId,id);
 });
});

test('lost initial control ACK requires explicit continuation; inspect never enrolls a replacement',async t=>{
 const f=await releaseServiceFixture(t,{dispatchPublication:false}),request=f.control.storage.request.bind(f.control.storage);let cut=true;
 f.control.storage.request=async(m,i)=>{const value=await request(m,i);if(cut&&m==='beginReleasePublication'){cut=false;throw Error('explicit lost control dispatch ACK');}return value;};
 await assert.rejects(coordinator(f).advance(f.publication.releaseId));assert.equal((await current(f)).state,'SENT');
 await f.backend.inspect(await current(f));assert.equal(await f.current(),null);assert.deepEqual(f.mutations(),[]);
 await f.reopen(true);await assertPublishedOnce(f,await coordinator(f).advance(f.publication.releaseId));
});

test('lost physical grant without an observable result stays unknown and never replays quota or guard',{timeout:120000},async t=>{
 for(const kind of ['PROFILE_PREPARE','GUARD_ENFORCE'])await t.test(kind,async t=>{
  const f=await releaseServiceFixture(t,{dispatchPublication:false});loseReceipt(f,'releaseServiceActionBegin',kind);
  assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');const calls=counts(f),j=await f.current();
  assert.equal(j.actions.at(-1).state,'SENT');await f.reopen(true);
  for(let i=0;i<2;i++)assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');
  assert.deepEqual(counts(f),calls);assert.equal(f.mutations().includes(kind==='PROFILE_PREPARE'?'PREPARE':'GUARD_ENFORCE'),false);
  assert.equal((await f.store.request('capacityUsage',{})).usage.releaseServiceSlots,1);assert.equal(f.control.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.preparation.request.target.datasetId).state,'CLOSED');
 });
});

test('uncertain physical queries, changed configuration/fences or closed control gate block later phases',async t=>{
 const f=await releaseServiceFixture(t,{dispatchPublication:false});f.faults.failAfter='ARM_FENCES';assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');const before=counts(f);
 f.faults.queryFails=true;assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');assert.deepEqual(counts(f),before);f.faults.queryFails=false;
 const old=f.records.get(f.publication.releaseId);f.records.set(f.publication.releaseId,{...old,target:{...old.target,generation:old.target.generation+1}});assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');assert.deepEqual(counts(f),before);f.records.set(f.publication.releaseId,old);
 const gate=f.control.get('SELECT * FROM preview_write_gates WHERE dataset_id=?',f.preparation.request.target.datasetId);f.control.run('UPDATE preview_write_gates SET revision=revision+1 WHERE dataset_id=?',gate.dataset_id);
 assert.equal((await f.control.call('verifyReleasePublicationContinuation',binding(f))).allowed,false);assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');assert.deepEqual(counts(f),before);
 await assert.rejects(f.control.call('verifyReleasePublicationContinuation',{...binding(f),principalId:'user_1'}),{code:'FORBIDDEN'});
});

test('v11 profile upgrade preserves old bytes and makes quota query-only; failed v12 rolls back',async t=>{
 const f=await releaseServiceFixture(t,{dispatchPublication:false});loseReceipt(f,'releaseServiceProfilePrepare');assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');const j=await f.current();assert.equal(j.actions.length,1);assert.equal(f.mutations().includes('PREPARE'),false);
 await f.closeCurrent();f.sql(db=>historicalV11Fixture(db));
 const tables=['release_service_handoffs','release_service_reservations','release_service_profiles','release_service_actions','release_service_events','release_service_proofs','runner_schema_history'],snapshot=f.sql(db=>Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()])));
 f.sql(db=>db.exec("CREATE TRIGGER v12_cut BEFORE INSERT ON runner_schema_history WHEN NEW.version=12 BEGIN SELECT RAISE(ABORT,'EXPLICIT_V12_CUT'); END"));await assert.rejects(openRunnerStore({...f.store.options,initialize:false}));
 f.sql(db=>{assert.equal(db.prepare('PRAGMA user_version').get().user_version,11);assert.equal(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='release_profile_preparations'").get(),undefined);for(const name of tables)assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),snapshot[name]);db.exec('DROP TRIGGER v12_cut');});
 await f.reopen();assert.equal((await f.store.request('inspect',{})).version,12);
 f.sql(db=>{for(const name of tables.filter(x=>x!=='runner_schema_history'))assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),snapshot[name]);assert.deepEqual(db.prepare('SELECT * FROM runner_schema_history WHERE version<12 ORDER BY rowid').all(),snapshot.runner_schema_history);});
 assert.equal((await f.current()).profilePreparation,'INSPECT_ONLY');const before=counts(f);
 assert.equal((await coordinator(f).advance(f.publication.releaseId)).state,'UNKNOWN');assert.deepEqual(counts(f),before);
 // A verified original quota may be adopted by observation, never enforcement.
 f.preparations.add(hash(canonical(j.profile)));const p=await coordinator(f).advance(f.publication.releaseId);assert.equal(p.state,'PUBLISHED',JSON.stringify(p));assert.equal(f.mutations().includes('PREPARE'),false);assert.equal((await f.current()).profilePreparation,'INSPECT_ONLY');
 await f.closeCurrent();f.sql(db=>db.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=12').run('0'.repeat(64)));await assert.rejects(openRunnerStore({...f.store.options,initialize:false}),{code:'RUNNER_MIGRATION_DRIFT'});
 assert.equal(readFileSync(new URL('../packages/runner/src/release-service-migration.ts',import.meta.url),'utf8').includes('PROFILE_PREPARE'),false);
});
