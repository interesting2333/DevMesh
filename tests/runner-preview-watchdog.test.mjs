import {historicalV5Fixture} from './fixtures/runner-version.mjs';
// Real SQLite/Worker, local dataset and timers; ControlledContainerDriver facts
// remain explicit fixtures. These tests execute no Docker or T5 transaction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {RunnerPreviewBackend,RunnerPreviewWatchdog,openRunnerStore,previewReleaseClaim} from '../packages/runner/dist/index.mjs';
import {PreviewClock} from '../packages/runner/src/preview-clock.ts';
import {containerFixture,hash} from './fixtures/preview-container.mjs';
const allowed=async()=>true;
const bound=r=>({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});
const sql=(f,body)=>{const db=new DatabaseSync(join(f.data.layout.dataRoot,'registry/runner.sqlite'));try{return body(db);}finally{db.close();}};
const life=(f,r)=>f.store.request('previewLifecycleGet',bound(r));
// Explicit persistent clock rollback injection, separate from the real timer test.
const rollbackClock=(f)=>sql(f,db=>db.prepare('UPDATE preview_lifecycles SET last_wall_at=?').run(new Date(Date.now()+60000).toISOString()));
const watch=(t,backend,options={})=>{const w=new RunnerPreviewWatchdog(backend,{enabled:true,pollIntervalMs:100,...options});t.after(()=>w.close());return w;};
async function reserve(f,request=f.effect.request){return f.store.request('previewReserve',{controllerId:f.options.controllerId,request,requestHash:hash(request),capacity:f.options.capacity,resourceLimits:f.options.resourceLimits});}
function releaseClaim(f,r){return previewReleaseClaim.parse({schemaVersion:'devmesh.preview-release-claim.v1',operationId:'op_accept_fixture',releaseId:'release_fixture',candidateId:r.request.candidateId,manifestHash:r.request.manifestHash,previewId:r.request.previewId,datasetId:r.request.datasetId,imageDigest:r.request.imageDigest,startOperationId:r.request.operationId,startRequestHash:r.requestHash,instanceId:r.instanceId,acceptanceRequestHash:hash('explicit future acceptance request')});}
const hold=(store,r,claim)=>store.request('previewReleaseHold',{...bound(r),claim,claimHash:hash(claim)});
const commit=(store,r,claim)=>store.request('previewReleaseCommit',{...bound(r),claimHash:hash(claim),releaseId:claim.releaseId,acceptanceOperationId:claim.operationId,acceptanceRequestHash:claim.acceptanceRequestHash});

test('preview clock uses monotonic elapsed time, persists rollback high-water and never unlatches expiry',()=>{
 let wall=10000,monotonic=0;const clock=new PreviewClock({wall:()=>wall,monotonic:()=>monotonic}),iso=n=>new Date(n).toISOString();
 assert.equal(clock.observe('original',iso(20000),iso(10000),false).expired,false);
 monotonic=10001;assert.equal(clock.observe('original',iso(20000),iso(10000),false).expired,true);
 // A failed surrounding transaction must not reset the original deadline.
 assert.equal(clock.observe('original',iso(20000),iso(10000),false).expired,true);
 const restarted=new PreviewClock({wall:()=>wall,monotonic:()=>0});wall=9000;
 assert.deepEqual(restarted.observe('original',iso(20000),iso(11000),false),{expired:true,wallAt:iso(11000)});
 wall=15000;assert.equal(restarted.observe('original',iso(20000),iso(11000),false).expired,true);assert.equal(restarted.observe('original',iso(20000),iso(11000),true).expired,true);
 clock.forget('original');wall=15000;assert.equal(clock.observe('new-reservation',iso(20000),iso(11000),false).expired,false);
});

test('watchdog is explicitly closed by default; real Runner timer expires original instance without a control database',{timeout:90000},async t=>{
 const f=await containerFixture(t),off=new RunnerPreviewWatchdog(f.backend);await assert.rejects(off.reconcile(),{code:'PREVIEW_WATCHDOG_NOT_CONFIGURED'});assert.deepEqual(f.mutations(),[]);await off.close();
 // Allow actual dataset/Worker startup before the immutable original deadline.
 f.effect.request.expiresAt=new Date(Date.now()+20000).toISOString();f.effect.requestHash=hash(f.effect.request);
  const ready=await f.backend.execute(f.effect,f.dataset,allowed);assert.equal(ready.fact.state,'HEALTHY');const r=await f.reservation(),w=watch(t,f.backend),errors=[];let current,cleanup;
  t.after(()=>{if(t.signal.aborted||errors.length)t.diagnostic(JSON.stringify({watchdogErrors:errors,state:current?.state,cleanup,mutations:f.mutations()}));});
  await w.start(code=>errors.push(code));await assert.rejects(w.start(),{code:'PREVIEW_WATCHDOG_ALREADY_STARTED'});
  // Released EXITED reservations are immutable; cleanup evidence is independent.
  // Keep the watchdog alive for both original absence observations; the existing
  // 90-second test timeout bounds the wait and aborts the poll on failure.
  do{await delay(100,undefined,{signal:t.signal});current=await f.reservation();cleanup=await f.store.request('previewCleanupGet',bound(r));}while(current.state!=='EXITED'||cleanup.length!==2||cleanup.some(a=>a.state!=='OBSERVED'));
  await w.close();assert.equal(current.state,'EXITED');assert.equal(current.instanceId,ready.fact.instanceId);assert.deepEqual(cleanup.map(a=>a.request.kind),['CONTAINER_REMOVE','NETWORK_REMOVE']);assert.ok(cleanup.every(a=>a.state==='OBSERVED'&&a.observation.absenceVerified));assert.deepEqual(f.mutations(),['NETWORK_CREATE','CREATE','START','STOP','CONTAINER_REMOVE','NETWORK_REMOVE']);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,0);
 const lifecycle=await life(f,r);assert.equal(lifecycle.state,'STOPPING');assert.equal(lifecycle.expiryRequest.reason,'EXPIRED');assert.equal(lifecycle.expiryRequest.instanceId,r.instanceId);assert.equal(lifecycle.expiryRequestHash,hash(lifecycle.expiryRequest));assert.ok(lifecycle.expiredAt);
 await w.close();await assert.rejects(w.reconcile(),{code:'PREVIEW_WATCHDOG_CLOSED'});
});

test('expired never-dispatched reservations cancel without a profile, container action or dataset removal',async t=>{
 const f=await containerFixture(t),r=await reserve(f);await f.store.request('previewLifecycleEnroll',bound(r));rollbackClock(f);await watch(t,f.backend).reconcile();assert.equal((await f.reservation()).state,'CANCELLED');assert.equal((await f.backend.inspect(f.effect)).observation.state,'FAILED');assert.deepEqual(f.mutations(),[]);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);assert.equal(f.data.app(f.dataset).list().tasks.length,0);
});

test('unknown expiry STOP survives Worker termination, is never resent and holds capacity until original verified exit',async t=>{
 const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation();f.driver.unknownStop=true;rollbackClock(f);const w=watch(t,f.backend);await w.reconcile();const before=await life(f,r);assert.equal(before.state,'STOPPING');assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);assert.equal(f.mutations().filter(k=>k==='STOP').length,1);await w.close();
 await f.store.terminate();const store=await openRunnerStore({...f.store.options,initialize:false});f.data.cleanup.push(()=>store.close());const backend=new RunnerPreviewBackend(store,f.data.paths,f.data.backend,f.driver,f.options),next=watch(t,backend);await next.reconcile();const recovered=await store.request('previewLifecycleGet',bound(r));assert.equal(recovered.expiryRequestHash,before.expiryRequestHash);assert.deepEqual(recovered.expiryRequest,before.expiryRequest);assert.equal(f.mutations().filter(k=>k==='STOP').length,1);assert.equal((await store.request('capacityUsage',{})).usage.slots,1);
 const journal=await store.request('previewContainerGet',bound(r));Object.assign(f.driver.containers.get(journal.profile.containerName),{state:'exited',pid:0,exitCode:143,endpoint:null});await next.reconcile();assert.equal((await store.request('capacityUsage',{})).usage.slots,0);assert.equal(f.mutations().filter(k=>k==='STOP').length,1);assert.equal(f.data.app(f.dataset).list().tasks.length,0);
});

test('lost create and network ACKs never invent exit or replay start; only exact created-object removal frees capacity',async t=>{
 for(const kind of ['CREATE','NETWORK_CREATE'])await t.test(kind,async t=>{
  const f=await containerFixture(t);f.driver.failAfter=kind;await assert.rejects(f.backend.execute(f.effect,f.dataset,allowed));rollbackClock(f);await watch(t,f.backend).reconcile();const r=await f.reservation(),j=await f.journal();assert.equal((await life(f,r)).state,'STOPPING');assert.equal((await f.store.request('capacityUsage',{})).usage.slots,kind==='CREATE'?0:1);assert.equal(f.mutations().includes('START'),false);
  if(kind==='CREATE'){assert.equal(r.fact.state,'REMOVED');assert.equal(j.actions.find(a=>a.kind==='STOP').state,'SENT');}else{assert.equal(j.containerId,null);assert.equal(j.actions.some(a=>a.kind==='STOP'),false);}
  await assert.rejects(f.store.request('previewContainerActionBegin',{...bound(r),action:{kind:'START',requestHash:f.effect.requestHash,request:f.effect.request}}),{code:'PREVIEW_EXPIRY_CLAIMED'});
 });
});

test('private acceptance hold pins the original subject and protects HELD/OWNED previews across expiry and Worker restart',async t=>{
 const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation(),claim=releaseClaim(f,r);
 for(const change of [{candidateId:'candidate_other'},{manifestHash:'0'.repeat(64)},{previewId:'preview_other'},{datasetId:'dataset_other'},{imageDigest:'sha256:'+'0'.repeat(64)},{startOperationId:'op_other'},{startRequestHash:'0'.repeat(64)},{instanceId:'other.instance'}])await assert.rejects(hold(f.store,r,{...claim,...change}),{code:'PREVIEW_RELEASE_CLAIM_CHANGED'});
 await assert.rejects(f.store.request('previewReleaseHold',{...bound(r),claim,claimHash:'0'.repeat(64)}),{code:'PREVIEW_RELEASE_CLAIM_CHANGED'});const held=await hold(f.store,r,claim);assert.equal(held.state,'RELEASE_HELD');assert.equal((await hold(f.store,r,claim)).revision,held.revision);
 await assert.rejects(hold(f.store,r,{...claim,releaseId:'release_other'}),{code:'PREVIEW_RELEASE_CLAIM_CHANGED'});await assert.rejects(f.store.request('previewReleaseHold',{...bound(r),controllerId:'controller.other',claim,claimHash:hash(claim)}),{code:'PREVIEW_RESERVATION_NOT_FOUND'});
 rollbackClock(f);await watch(t,f.backend).reconcile();await assert.rejects(f.backend.execute(f.stop(r.instanceId),f.dataset,allowed),{code:'PREVIEW_OWNED_BY_RELEASE'});assert.equal(f.mutations().includes('STOP'),false);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 await f.store.terminate();const store=await openRunnerStore({...f.store.options,initialize:false});f.data.cleanup.push(()=>store.close());const backend=new RunnerPreviewBackend(store,f.data.paths,f.data.backend,f.driver,f.options);await watch(t,backend).reconcile();assert.equal((await hold(store,r,claim)).state,'RELEASE_HELD');await assert.rejects(commit(store,r,{...claim,acceptanceRequestHash:hash('changed')}),{code:'PREVIEW_RELEASE_CLAIM_CHANGED'});
 const owned=await commit(store,r,claim);assert.equal(owned.state,'RELEASE_OWNED');assert.equal((await commit(store,r,claim)).revision,owned.revision);await backend.expireReservation(r.reservationId);assert.equal(f.mutations().includes('STOP'),false);assert.equal((await store.request('capacityUsage',{})).usage.slots,1);
});

test('hold and STOP compete inside the Runner writer; whichever commits first excludes the other',async t=>{
 for(const first of ['hold','stop'])await t.test(first,async t=>{
  const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation(),claim=releaseClaim(f,r),stop=f.stop(r.instanceId),holdTask=()=>hold(f.store,r,claim),stopTask=()=>f.store.request('previewContainerActionBegin',{...bound(r),action:{kind:'STOP',requestHash:stop.requestHash,request:stop.request}}),tasks=first==='hold'?[holdTask(),stopTask()]:[stopTask(),holdTask()],outcomes=await Promise.allSettled(tasks);assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].status,'rejected');assert.equal((await life(f,r)).state,first==='hold'?'RELEASE_HELD':'STOPPING');assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 });
});

test('last-moment Runner expiry check denies delayed START even when the external controller still authorizes it',async t=>{
 const f=await containerFixture(t);f.driver.beforeStart=async()=>rollbackClock(f);await assert.rejects(f.backend.execute(f.effect,f.dataset,allowed));const r=await f.reservation();assert.ok((await life(f,r)).expiredAt);assert.deepEqual(f.mutations(),['NETWORK_CREATE','CREATE']);assert.equal((await f.backend.inspect(f.effect)).fact.state,'CREATED');await assert.rejects(hold(f.store,r,{...releaseClaim(f,{...r,instanceId:(await f.journal()).containerId})}),{code:'PREVIEW_RELEASE_HOLD_UNAVAILABLE'});assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
});

test('hold and commit ACK loss recover exact original ownership while failed audit insert rolls back custody',async t=>{
 const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation(),claim=releaseClaim(f,r);
 sql(f,db=>db.exec("CREATE TRIGGER test_lifecycle_event BEFORE INSERT ON preview_lifecycle_events BEGIN SELECT RAISE(ABORT,'TEST_EVENT_FAILURE'); END;"));await assert.rejects(hold(f.store,r,claim),{code:'RUNNER_STORE_FAILURE'});assert.equal((await life(f,r)).state,'PREVIEW');sql(f,db=>db.exec('DROP TRIGGER test_lifecycle_event'));
 const losing={async request(method,input){await f.store.request(method,input);throw Error('explicit committed custody ACK loss');}};await assert.rejects(hold(losing,r,claim));assert.equal((await hold(f.store,r,claim)).state,'RELEASE_HELD');await assert.rejects(commit(losing,r,claim));assert.equal((await commit(f.store,r,claim)).state,'RELEASE_OWNED');
 sql(f,db=>{assert.throws(()=>db.exec("UPDATE preview_lifecycles SET state='PREVIEW'"),/PREVIEW_LIFECYCLE_IMMUTABLE/);assert.throws(()=>db.exec('DELETE FROM preview_lifecycles'),/PREVIEW_LIFECYCLE_IMMUTABLE/);assert.throws(()=>db.exec("UPDATE preview_lifecycle_events SET snapshot_json='{}'"),/PREVIEW_LIFECYCLE_EVENT_IMMUTABLE/);});
 const second=await containerFixture(t);await second.backend.execute(second.effect,second.dataset,allowed);const sr=await second.reservation(),s=second.stop(sr.instanceId);sql(second,db=>db.exec("CREATE TRIGGER test_stop_insert BEFORE INSERT ON preview_container_actions WHEN NEW.kind='STOP' BEGIN SELECT RAISE(ABORT,'TEST_STOP_FAILURE'); END;"));await assert.rejects(second.backend.execute(s,second.dataset,allowed),{code:'RUNNER_STORE_FAILURE'});assert.equal((await life(second,sr)).state,'PREVIEW');assert.equal((await hold(second.store,sr,releaseClaim(second,sr))).state,'RELEASE_HELD');
});

test('paged reconciliation isolates original failure, starts each scan at zero and close prevents delayed STOP dispatch',async t=>{
 const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation(),second=await reserve(f,{...f.effect.request,operationId:'op_second_watchdog',previewId:'preview_second_watchdog',datasetId:'dataset_second_watchdog',storageKey:f.effect.request.projectId+'/dataset_second_watchdog/app.sqlite'});await f.store.request('previewLifecycleEnroll',bound(second));rollbackClock(f);
 const originalNetwork=f.driver.network.bind(f.driver);f.driver.network=async()=>{throw Error('explicit original network query failure');};const w=watch(t,f.backend,{pageSize:1}),outcomes=await w.reconcile();assert.deepEqual(outcomes.map(v=>v.reservationId),[r.reservationId,second.reservationId]);assert.equal(outcomes[0].errorCode,'PREVIEW_WATCHDOG_UNKNOWN');assert.equal(outcomes[1].state,'CANCELLED');f.driver.network=originalNetwork;
 let entered,unblock;const atStop=new Promise(resolve=>{entered=resolve;}),barrier=new Promise(resolve=>{unblock=resolve;});f.driver.beforeStop=async()=>{entered();await barrier;};const cycle=w.reconcile();await atStop;let closed=false;const closing=w.close().then(()=>{closed=true;});await delay(10);assert.equal(closed,false);unblock();await cycle;await closing;assert.equal(f.mutations().filter(k=>k==='STOP').length,0);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);assert.equal((await f.journal()).actions.find(a=>a.kind==='STOP').state,'SENT');
});

test('v4 to v6 is transactional and preserves original journals without adopting old previews; v5 drift is rejected',async t=>{
 const f=await containerFixture(t);await f.backend.execute(f.effect,f.dataset,allowed);const r=await f.reservation(),before=await f.journal(),migrations=sql(f,db=>db.prepare('SELECT * FROM runner_schema_history WHERE version<5 ORDER BY version').all());await f.store.close();
 // Dedicated historical fixture, never a production downgrade.
 sql(f,db=>{historicalV5Fixture(db);db.exec("BEGIN IMMEDIATE; DROP TABLE preview_lifecycle_events; DROP TABLE preview_lifecycles; ALTER TABLE runner_identity RENAME TO runner_identity_v5_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=4)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,4 FROM runner_identity_v5_fixture; DROP TABLE runner_identity_v5_fixture; DELETE FROM runner_schema_history WHERE version=5; PRAGMA user_version=4; CREATE TRIGGER test_v5_upgrade BEFORE INSERT ON runner_schema_history WHEN NEW.version=5 BEGIN SELECT RAISE(ABORT,'TEST_UPGRADE_FAILURE'); END; COMMIT;");});
 await assert.rejects(openRunnerStore({...f.store.options,initialize:false}));sql(f,db=>{assert.equal(db.prepare('PRAGMA user_version').get().user_version,4);assert.equal(db.prepare('SELECT version FROM runner_identity').get().version,4);assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='preview_lifecycles'").get().n,0);assert.deepEqual(db.prepare('SELECT * FROM runner_schema_history ORDER BY version').all(),migrations);db.exec('DROP TRIGGER test_v5_upgrade');});
 const store=await openRunnerStore({...f.store.options,initialize:false});f.data.cleanup.push(()=>store.close());assert.equal((await store.request('inspect',{})).version,9);assert.deepEqual(await store.request('previewContainerGet',bound(r)),before);assert.equal(await store.request('previewLifecycleGet',bound(r)),null);const backend=new RunnerPreviewBackend(store,f.data.paths,f.data.backend,f.driver,f.options);assert.equal((await backend.expireReservation(r.reservationId)).state,'UNENROLLED');await assert.rejects(store.request('previewLifecycleEnroll',bound(r)),{code:'PREVIEW_LIFECYCLE_ADOPTION_FORBIDDEN'});assert.equal(f.mutations().includes('STOP'),false);assert.equal((await store.request('capacityUsage',{})).usage.slots,1);assert.deepEqual((await store.request('inspect',{})).foreignKeyErrors,[]);await store.close();sql(f,db=>db.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=5').run('0'.repeat(64)));await assert.rejects(openRunnerStore({...f.store.options,initialize:false}),{code:'RUNNER_MIGRATION_DRIFT'});
});
