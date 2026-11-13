import {historicalV5Fixture} from './fixtures/runner-version.mjs';
// Actual Runner SQLite and Worker transactions; image and container facts below
// are explicit test values, not evidence of Docker execution or physical exit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {canonical,previewStartRequest} from '../packages/storage-sqlite/dist/index.mjs';
import {openRunnerStore,runnerCapacity} from '../packages/runner/dist/index.mjs';
import {request as jobRequest} from './fixtures/runner.mjs';

const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const capacity={maximumJobs:4,cpu:4,memoryMiB:1024},limits={cpu:1,memoryMiB:128,pids:32,temporaryMiB:32};
function request(n=1,change={}){return previewStartRequest.parse({schemaVersion:'devmesh.preview-start.v1',operationId:'op_preview_capacity'+n,projectId:'prj_capacity',runId:'run_capacity'+n,candidateId:'candidate_capacity'+n,policyHash:'b'.repeat(64),backendRef:'preview.capacity.fixture',runnerId:'runner.capacity',previewId:'preview_capacity'+n,datasetId:'dataset_capacity'+n,imageDigest:'sha256:'+'c'.repeat(64),manifestHash:'d'.repeat(64),storageKey:'prj_capacity/dataset_capacity'+n+'/app.sqlite',datasetOperationId:'op_dataset_capacity'+n,templateVersion:'web-crud-v1',schemaRevision:'web-crud-v1.schema.1',imageIdentity:{schemaVersion:'devmesh.preview-image-identity.v1',imageDigest:'sha256:'+'c'.repeat(64),configDigest:'sha256:'+'e'.repeat(64),targetCommit:'a'.repeat(40),buildArtifactHash:'f'.repeat(64),os:'linux',architecture:'amd64',layers:[{digest:'sha256:'+'1'.repeat(64),diffId:'sha256:'+'2'.repeat(64),byteSize:1024,expandedByteSize:1024}]},expiresAt:new Date(Date.now()+3600000).toISOString(),...change});}
function input(r=request(),change={}){return {controllerId:'controller.capacity',request:r,requestHash:hash(r),resourceLimits:limits,capacity,...change};}
const bound=r=>({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});
const fact=(r,change={})=>({previewId:r.request.previewId,datasetId:r.request.datasetId,imageDigest:r.request.imageDigest,state:'HEALTHY',instanceId:'container.original.'+r.reservationId,endpoint:{host:'127.0.0.1',port:54321},checkedAt:new Date().toISOString(),...change});
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'devmesh-preview-capacity-')),options={databasePath:join(root,'runner.sqlite'),runnerId:'runner.capacity',initialize:true};let store=await openRunnerStore(options);t.after(async()=>{await store.close();await rm(root,{recursive:true,force:true});});return {options,get store(){return store;},async reopen(){await store.close();store=await openRunnerStore({...options,initialize:false});return store;},sql(body){const db=new DatabaseSync(options.databasePath);try{return body(db);}finally{db.close();}}};}
async function job(f,n=1){const r=jobRequest(n,{run:n}),j=await f.store.request('register',{controllerId:'controller.jobs',request:r,execution:{workspacePath:'/explicit-fixture/workspace'+n,argv:['node','build.mjs']}});return j;}
const claim=(f,j,c=capacity)=>f.store.request('claim',{jobId:j.jobId,...c});
const dispatch=(f,r)=>f.store.request('previewReservationDispatch',bound(r));
const record=(f,r,change={})=>f.store.request('previewReservationRecord',{...bound(r),expectedRevision:r.revision,fact:fact(r,change)});

test('reservation schema, exact original request and configured Runner boundary are closed',async t=>{
 const f=await fixture(t),i=input();assert.equal(runnerCapacity.safeParse({...capacity,maximumJobs:5}).success,false);
 for(const bad of [{...i,requestHash:'0'.repeat(64)},input(request(2,{runnerId:'runner.other'}))])await assert.rejects(f.store.request('previewReserve',bad),{code:'PREVIEW_RESERVATION_IDENTITY_MISMATCH'});
 await assert.rejects(f.store.request('previewReserve',input(request(3,{expiresAt:new Date(Date.now()-1000).toISOString()}))),{code:'PREVIEW_RESERVATION_EXPIRED'});
 assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);
 const r=await f.store.request('previewReserve',i);assert.equal(r.state,'RESERVED');assert.equal(r.instanceId,null);
 await assert.rejects(f.store.request('previewReservationGet',{controllerId:'controller.other',reservationId:r.reservationId}),{code:'PREVIEW_RESERVATION_NOT_FOUND'});
 assert.equal(await f.store.request('previewReservationByOperation',{controllerId:'controller.other',operationId:r.request.operationId}),null);
 await assert.rejects(record(f,r),{code:'PREVIEW_RESERVATION_NOT_OBSERVABLE'});
 await assert.rejects(f.store.request('previewReservationDispatch',{...bound(r),requestHash:'0'.repeat(64)}),{code:'PREVIEW_RESERVATION_IDENTITY_MISMATCH'});
});

test('concurrent reserve and lost dispatch ACK recover the same original reservation exactly once',async t=>{
 const f=await fixture(t),i=input(),rows=await Promise.all(Array.from({length:8},()=>f.store.request('previewReserve',i))),r=rows[0];assert.equal(new Set(rows.map(v=>v.reservationId)).size,1);
 await assert.rejects(f.store.request('previewReserve',{...i,resourceLimits:{...limits,cpu:2}}),{code:'IDEMPOTENCY_KEY_REUSED'});
 const changed=request(1,{...i.request,manifestHash:'0'.repeat(64)});await assert.rejects(f.store.request('previewReserve',input(changed)),{code:'IDEMPOTENCY_KEY_REUSED'});
 const grants=await Promise.all(Array.from({length:8},()=>dispatch(f,r)));assert.equal(grants.filter(g=>g.dispatch).length,1);
 let current=grants.find(g=>g.dispatch).reservation;current=await record(f,current,{state:'UNKNOWN',instanceId:null,endpoint:null});assert.equal(current.state,'UNKNOWN');
 assert.equal((await dispatch(f,current)).dispatch,false);await assert.rejects(f.store.request('previewReservationCancel',bound(current)),{code:'PREVIEW_RESERVATION_DISPATCHED'});
 await f.reopen();assert.equal((await dispatch(f,current)).dispatch,false);assert.equal((await f.store.request('previewReserve',i)).reservationId,r.reservationId);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,1);
});

test('one transaction shares global slots between jobs and unknown previews across controllers',async t=>{
 const f=await fixture(t),c={...capacity,maximumJobs:2},r=(await dispatch(f,await f.store.request('previewReserve',input(request(),{capacity:c})))).reservation;
 await record(f,r,{state:'UNKNOWN',instanceId:null,endpoint:null});const j=await job(f,1),waiting=await job(f,2);assert.ok(await claim(f,j,c));assert.equal(await claim(f,waiting,c),null);
 await assert.rejects(f.store.request('previewReserve',input(request(2),{controllerId:'controller.other',capacity:c})),{code:'RUNNER_CAPACITY_EXHAUSTED'});
 await f.store.request('record',{jobId:j.jobId,state:'OUTCOME_UNKNOWN',containerId:null,exitCode:null,evidence:null,errorCode:'EXPLICIT_FIXTURE_UNKNOWN'});assert.equal(await claim(f,waiting,c),null);
 assert.deepEqual((await f.store.request('capacityUsage',{})).usage,{slots:2,jobSlots:1,previewSlots:1,acceptanceServiceSlots:0,releaseServiceSlots:0,cpu:2,memoryMiB:256});
});

test('preview CPU and memory separately reduce the remaining job budget',async t=>{
 for(const [name,c,l] of [['cpu',{...capacity,cpu:2},{...limits,cpu:1.5}],['memory',{...capacity,memoryMiB:256},{...limits,memoryMiB:192}]])await t.test(name,async t=>{
  const f=await fixture(t);await f.store.request('previewReserve',input(request(),{capacity:c,resourceLimits:l}));assert.equal(await claim(f,await job(f),c),null);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
 });
});

test('concurrent job and preview admission cannot overbook the final slot',async t=>{
 const f=await fixture(t),j=await job(f),c={...capacity,maximumJobs:1};await f.store.request('capacityConfigure',c);
 const attempts=await Promise.allSettled([f.store.request('previewReserve',input(request(),{capacity:c})),claim(f,j,c)]),successes=attempts.filter(r=>r.status==='fulfilled'&&r.value!==null);assert.equal(successes.length,1);
 assert.equal((await f.store.request('capacityUsage',{})).usage.slots,1);
});

test('the Runner rejects inconsistent admission budgets and exclusive dataset reuse',async t=>{
 const f=await fixture(t),i=input();await f.store.request('previewReserve',i);
 await assert.rejects(f.store.request('previewReserve',input(request(2),{capacity:{...capacity,cpu:8}})),{code:'RUNNER_CAPACITY_CONFIG_CHANGED'});
 await assert.rejects(claim(f,await job(f),{...capacity,memoryMiB:2048}),{code:'RUNNER_CAPACITY_CONFIG_CHANGED'});
 for(const r of [request(2,{datasetId:i.request.datasetId,storageKey:i.request.storageKey}),request(2,{previewId:i.request.previewId})])await assert.rejects(f.store.request('previewReserve',input(r,{controllerId:'controller.other'})),{code:'PREVIEW_RESERVATION_BUSY'});
});

test('runtime CAS, time, original instance and endpoint pins protect held capacity until exact exit',async t=>{
 const f=await fixture(t);let r=(await dispatch(f,await f.store.request('previewReserve',input()))).reservation;r=await record(f,r);const healthy=r;
 await assert.rejects(f.store.request('previewReservationRecord',{...bound(r),expectedRevision:r.revision-1,fact:fact(r,{state:'UNHEALTHY'})}),{code:'PREVIEW_RESERVATION_REVISION_CONFLICT'});
 for(const change of [{instanceId:'container.replacement'},{endpoint:{host:'127.0.0.1',port:54322}},{datasetId:'dataset_other'},{imageDigest:'sha256:'+'0'.repeat(64)}])await assert.rejects(record(f,r,change),{code:'PREVIEW_RESERVATION_IDENTITY_MISMATCH'});
 for(const at of [new Date(Date.now()+60000).toISOString(),new Date(Date.parse(r.createdAt)-1000).toISOString()])await assert.rejects(record(f,r,{checkedAt:at}),{code:'PREVIEW_RESERVATION_OBSERVATION_STALE'});
 r=await record(f,r,{state:'UNKNOWN',instanceId:null,endpoint:null});assert.equal(r.instanceId,healthy.instanceId);assert.deepEqual(r.endpoint,healthy.endpoint);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,1);
 r=await record(f,r,{state:'EXITED',endpoint:null});assert.equal(r.state,'EXITED');assert.equal(r.instanceId,healthy.instanceId);assert.ok(r.releasedAt);assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);
 await assert.rejects(record(f,r,{state:'HEALTHY'}),{code:'PREVIEW_RESERVATION_NOT_OBSERVABLE'});assert.equal((await dispatch(f,r)).dispatch,false);
});

test('only never-dispatched cancellation releases a reservation; expiry does not release a dispatched one',async t=>{
 const f=await fixture(t),i=input(),r=await f.store.request('previewReserve',i),cancelled=await f.store.request('previewReservationCancel',bound(r));assert.equal(cancelled.state,'CANCELLED');assert.equal((await f.store.request('previewReservationCancel',bound(r))).revision,cancelled.revision);assert.equal((await dispatch(f,cancelled)).dispatch,false);
 const expiresAt=new Date(Date.now()+2000).toISOString(),active=(await dispatch(f,await f.store.request('previewReserve',input(request(2,{expiresAt}))))).reservation,unsent=await f.store.request('previewReserve',input(request(3,{expiresAt})));await delay(2100);
 assert.equal((await f.store.request('previewReservationGet',{controllerId:active.controllerId,reservationId:active.reservationId})).state,'DISPATCHED');assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,2);
 await assert.rejects(dispatch(f,unsent),{code:'PREVIEW_RESERVATION_EXPIRED'});assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,2);await f.store.request('previewReservationCancel',bound(unsent));assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,1);
});

test('Worker reopen retains held resources and pages only original controller live reservations',async t=>{
 const f=await fixture(t),rows=[];for(let n=1;n<=3;n++)rows.push(await f.store.request('previewReserve',input(request(n))));await f.store.request('previewReservationCancel',bound(rows[1]));await f.reopen();
 assert.equal((await f.store.request('inspect',{})).version,11);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,2);
 const first=await f.store.request('previewReservationPage',{controllerId:rows[0].controllerId,limit:1});assert.equal(first.items[0].reservation.reservationId,rows[0].reservationId);assert.ok(first.nextSequence);
 const last=await f.store.request('previewReservationPage',{controllerId:rows[0].controllerId,limit:1,afterSequence:first.nextSequence});assert.equal(last.items[0].reservation.reservationId,rows[2].reservationId);assert.equal(last.nextSequence,null);
 assert.deepEqual(await f.store.request('previewReservationPage',{controllerId:'controller.other'}),{items:[],nextSequence:null});
 const c={...capacity,cpu:1,memoryMiB:128};await f.store.request('capacityConfigure',c);assert.equal(await claim(f,await job(f),c),null);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,2);
});

test('failed history insertion rolls back state and capacity release; immutable SQL protects originals',async t=>{
 const f=await fixture(t);let r=(await dispatch(f,await f.store.request('previewReserve',input()))).reservation;r=await record(f,r);
 f.sql(db=>db.exec("CREATE TRIGGER test_reject_reservation_event BEFORE INSERT ON preview_reservation_events BEGIN SELECT RAISE(ABORT,'TEST_EVENT_FAILURE'); END;"));
 await assert.rejects(record(f,r,{state:'EXITED',endpoint:null}),{code:'RUNNER_STORE_FAILURE'});assert.equal((await f.store.request('previewReservationGet',{controllerId:r.controllerId,reservationId:r.reservationId})).revision,r.revision);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,1);
 f.sql(db=>{db.exec('DROP TRIGGER test_reject_reservation_event');assert.throws(()=>db.prepare('UPDATE preview_reservations SET request_hash=? WHERE reservation_id=?').run('0'.repeat(64),r.reservationId),/PREVIEW_RESERVATION_IMMUTABLE/);assert.throws(()=>db.prepare('DELETE FROM preview_reservations WHERE reservation_id=?').run(r.reservationId),/PREVIEW_RESERVATION_IMMUTABLE/);assert.throws(()=>db.exec("UPDATE preview_reservation_events SET snapshot_json='{}'"),/PREVIEW_RESERVATION_EVENT_IMMUTABLE/);});
 r=await record(f,r,{state:'EXITED',endpoint:null});assert.equal((await f.store.request('capacityUsage',{})).usage.slots,0);assert.deepEqual((await f.store.request('inspect',{})).foreignKeyErrors,[]);
});

test('v2 upgrade to v7 preserves original migration fingerprint and queued jobs; v3 drift is rejected',async t=>{
 const f=await fixture(t),j=await job(f);await f.store.close();let fingerprint;
 // Reconstruct a dedicated historical v2 fixture, never a production downgrade.
 f.sql(db=>{historicalV5Fixture(db);fingerprint=db.prepare('SELECT sha256 FROM runner_schema_history WHERE version=2').get().sha256;db.exec('BEGIN IMMEDIATE; DROP TABLE preview_lifecycle_events; DROP TABLE preview_lifecycles; DROP TABLE preview_container_actions; DROP TABLE preview_container_profiles; DROP TABLE preview_reservation_events; DROP TABLE preview_reservations; ALTER TABLE runner_identity RENAME TO runner_identity_v4_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=2)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,2 FROM runner_identity_v4_fixture; DROP TABLE runner_identity_v4_fixture; DELETE FROM runner_schema_history WHERE version IN (3,4,5); PRAGMA user_version=2; COMMIT;');});
 await f.reopen();assert.equal((await f.store.request('get',{controllerId:j.controllerId,jobId:j.jobId})).state,'QUEUED');assert.equal((await f.store.request('inspect',{})).version,11);f.sql(db=>assert.equal(db.prepare('SELECT sha256 FROM runner_schema_history WHERE version=2').get().sha256,fingerprint));
 await f.store.close();f.sql(db=>db.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=3').run('0'.repeat(64)));await assert.rejects(openRunnerStore({...f.options,initialize:false}),{code:'RUNNER_MIGRATION_DRIFT'});
});

test('v3 to v7 preserves an active original reservation and history; a failed migration rolls back before retry and v4 drift is rejected',async t=>{
 const f=await fixture(t);let r=(await dispatch(f,await f.store.request('previewReserve',input()))).reservation;r=await record(f,r);const before=f.sql(db=>({history:db.prepare('SELECT * FROM preview_reservation_events ORDER BY reservation_id,revision').all(),migrations:db.prepare('SELECT * FROM runner_schema_history WHERE version<4 ORDER BY version').all()}));await f.store.close();
 // Dedicated historical fixture only: v3 had no container journal tables.
 f.sql(db=>{historicalV5Fixture(db);db.exec("BEGIN IMMEDIATE; DROP TABLE preview_lifecycle_events; DROP TABLE preview_lifecycles; DROP TABLE preview_container_actions; DROP TABLE preview_container_profiles; DROP INDEX preview_reservation_request_binding; ALTER TABLE runner_identity RENAME TO runner_identity_v4_fixture; CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=3)) STRICT; INSERT INTO runner_identity SELECT singleton,runner_id,3 FROM runner_identity_v4_fixture; DROP TABLE runner_identity_v4_fixture; DELETE FROM runner_schema_history WHERE version IN (4,5); PRAGMA user_version=3; CREATE TRIGGER test_v4_upgrade BEFORE INSERT ON runner_schema_history WHEN NEW.version=4 BEGIN SELECT RAISE(ABORT,'TEST_UPGRADE_FAILURE'); END; COMMIT;");});
 await assert.rejects(openRunnerStore({...f.options,initialize:false}));f.sql(db=>{assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);assert.equal(db.prepare('SELECT version FROM runner_identity').get().version,3);assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='preview_container_profiles'").get().n,0);assert.deepEqual(db.prepare('SELECT * FROM preview_reservation_events ORDER BY reservation_id,revision').all(),before.history);db.exec('DROP TRIGGER test_v4_upgrade');});
 await f.reopen();assert.equal((await f.store.request('inspect',{})).version,11);assert.deepEqual(await f.store.request('previewReservationGet',{controllerId:r.controllerId,reservationId:r.reservationId}),r);assert.equal((await f.store.request('capacityUsage',{})).usage.previewSlots,1);assert.equal(await f.store.request('previewContainerGet',bound(r)),null);f.sql(db=>{assert.deepEqual(db.prepare('SELECT * FROM preview_reservation_events ORDER BY reservation_id,revision').all(),before.history);assert.deepEqual(db.prepare('SELECT * FROM runner_schema_history WHERE version<4 ORDER BY version').all(),before.migrations);});await f.store.close();f.sql(db=>db.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=4').run('0'.repeat(64)));await assert.rejects(openRunnerStore({...f.options,initialize:false}),{code:'RUNNER_MIGRATION_DRIFT'});
});
