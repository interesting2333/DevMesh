// Actual file/control/Runner Workers; physical custody, OCI and container facts
// remain explicit fixtures. These are drain/recovery tests, not Linux evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {LocalSqliteAcceptanceDatasetBackend,RunnerAcceptancePreparationBackend} from '../packages/runner/dist/index.mjs';
import {AcceptancePreparationConsumer} from '../packages/platform-core/dist/index.mjs';
import {acceptanceDatasetFixture,acceptanceDatasetPreparation,copyPlan} from './fixtures/acceptance-datasets.mjs';
import {acceptanceServiceBackendFixture} from './fixtures/acceptance-service-backend.mjs';
import {acceptanceFixture} from './fixtures/acceptance.mjs';

const barrier=()=>Promise.withResolvers();
const outcome=p=>p.then(value=>({value}),error=>({error}));
const timeoutMs=5000;
const backend=(f,extra={})=>new LocalSqliteAcceptanceDatasetBackend({...f.acceptanceOptions,timeoutMs,maximumWorkers:1,...extra});
async function enters(entered,result){await Promise.race([entered.promise,result.then(()=>{throw Error('Worker returned before the controlled call');})]);}
async function retained(result,check){
 let settled=false;void result.then(()=>{settled=true;});await delay(timeoutMs+500);
 assert.equal(settled,false,'the external call must retain the timed-out Worker slot');await check?.();
}
function unknown(result){assert.equal(result.error?.code,'ACCEPTANCE_DATA_OUTCOME_UNKNOWN');}

test('preflight, authorization and migration RPCs retain their slot after Worker timeout',{timeout:180000},async t=>{
 for(const phase of ['preflight','authorize','migration'])await t.test(phase,async t=>{
  const f=await acceptanceDatasetFixture(t),source=phase==='migration'?acceptanceDatasetPreparation({initialData:'DEMO'}):null;
  if(source)await f.prepareAcceptance(source);
  const sourceBytes=source?await readFile(f.pathsFor(source).databasePath):null,p=acceptanceDatasetPreparation({source}),q=acceptanceDatasetPreparation(),entered=barrier(),release=barrier();
  let calls=0,active=0,maximum=0,authorizations=0;
  const hold=async value=>{calls++;active++;maximum=Math.max(maximum,active);entered.resolve();try{await release.promise;return value;}finally{active--;}};
  const preflight=f.authority.preflight.bind(f.authority);let queries=0;
  f.authority.preflight=async subject=>{queries++;await preflight(subject);if(phase==='preflight'&&subject.operationId===p.operationId)await hold();};
  const b=backend(f,phase==='migration'?{loadMigration:()=>hold(copyPlan)}:{}),result=outcome(b.prepare(p,async()=>{authorizations++;if(phase==='authorize')await hold();return true;}));
  let queued;
  try{
   await enters(entered,result);queued=outcome(b.preflight(q));
   await retained(result,async()=>{assert.equal(queries,1);assert.equal(active,1);await assert.rejects(stat(f.pathsFor(p).directory),{code:'ENOENT'});});
  }finally{release.resolve();await result;await queued;}
  unknown(await result);assert.deepEqual(await queued,{value:undefined});assert.equal(calls,1);assert.equal(maximum,1);assert.equal(active,0);assert.equal(queries,2);
  assert.equal(authorizations,phase==='authorize'?1:0);assert.equal(f.authority.acquisitions,source?1:0);
  assert.equal((await b.inspect(p)).errorCode,'ACCEPTANCE_DATA_ORIGINAL_NOT_OBSERVED');
  if(source)assert.deepEqual(await readFile(f.pathsFor(source).databasePath),sourceBytes);
 });
});

test('acquire and verify timeouts close late authorization and preserve incomplete original journals without replay',{timeout:180000},async t=>{
 for(const phase of ['acquire-before','acquire-after','verify'])await t.test(phase,async t=>{
  const f=await acceptanceDatasetFixture(t),p=acceptanceDatasetPreparation(),entered=barrier(),release=barrier(),acquire=f.authority.acquire.bind(f.authority),inspect=f.authority.inspect.bind(f.authority);
  let authorize,acquireCalls=0,inspectCalls=0;
  f.authority.acquire=async(subject,allowed)=>{acquireCalls++;authorize=allowed;if(phase==='acquire-before'){entered.resolve();await release.promise;}const value=await acquire(subject,allowed);if(phase==='acquire-after'){entered.resolve();await release.promise;}return value;};
  f.authority.inspect=async subject=>{inspectCalls++;const value=await inspect(subject);if(phase==='verify'){entered.resolve();await release.promise;}return value;};
  const b=backend(f),result=outcome(b.prepare(p,async()=>true));let queued,journal;
  try{
   await enters(entered,result);journal=await readFile(f.pathsFor(p).journalPath);queued=outcome(b.inspect(p));
   await retained(result,async()=>{assert.equal(await authorize(),false);assert.equal(acquireCalls,1);assert.equal(inspectCalls,phase==='verify'?1:0);});
  }finally{release.resolve();await result;await queued;}
  unknown(await result);assert.equal((await queued).value.errorCode,'ACCEPTANCE_DATA_ORIGINAL_INCOMPLETE');
  const paths=f.pathsFor(p);assert.deepEqual((await readdir(paths.directory)).sort(),phase==='verify'?['fences.json','operation.json']:['operation.json']);assert.deepEqual(await readFile(paths.journalPath),journal);
  assert.equal((await b.prepare(p,async()=>{throw Error('original must stay inspect-only');})).errorCode,'ACCEPTANCE_DATA_ORIGINAL_INCOMPLETE');
  assert.equal(acquireCalls,1);assert.equal(f.authority.acquisitions,phase==='acquire-before'?0:1);assert.equal(inspectCalls,phase==='verify'?1:0);
 });
});

test('a timed-out original custody query drains before queued inspection returns the same real receipt',{timeout:120000},async t=>{
 const f=await acceptanceDatasetFixture(t),p=acceptanceDatasetPreparation({initialData:'DEMO'}),original=await f.prepareAcceptance(p),paths=f.pathsFor(p),bytes=await readFile(paths.databasePath),journal=await readFile(paths.journalPath),entered=barrier(),release=barrier(),inspect=f.authority.inspect.bind(f.authority);
 let calls=0,active=0,maximum=0;
 f.authority.inspect=async subject=>{calls++;active++;maximum=Math.max(maximum,active);try{const value=await inspect(subject);if(calls===1){entered.resolve();await release.promise;}return value;}finally{active--;}};
 const b=backend(f),result=outcome(b.inspect(p));let queued;
 try{await enters(entered,result);queued=outcome(b.inspect(p));await retained(result,()=>{assert.equal(calls,1);assert.equal(active,1);});}finally{release.resolve();await result;await queued;}
 unknown(await result);assert.deepEqual((await queued).value,original);assert.equal(calls,2);assert.equal(maximum,1);assert.equal(active,0);assert.equal(f.authority.acquisitions,1);
 assert.deepEqual(await readFile(paths.databasePath),bytes);assert.deepEqual(await readFile(paths.journalPath),journal);
});

test('consumer stop drains actual timed-out data acquisition and restart only queries the original incomplete preparation',{timeout:180000},async t=>{
 const local=await acceptanceServiceBackendFixture(t),f=await acceptanceFixture(t),policy={...f.policy,runnerId:local.options.runnerId,backendRef:local.options.backendRef},registered=await f.call('registerAcceptanceBackendPolicy',{principalId:'user_1',projectId:f.p.projectId,policy}),pending=await f.call('beginAcceptancePreparation',await f.request({policyHash:registered.policyHash}));
 const entered=barrier(),release=barrier(),acquire=local.data.authority.acquire.bind(local.data.authority);let authorize,acquireCalls=0;
 local.data.authority.acquire=async(p,allowed)=>{acquireCalls++;authorize=allowed;const value=await acquire(p,allowed);entered.resolve();await release.promise;return value;};
 const datasets=backend(local.data),service=new RunnerAcceptancePreparationBackend(local.store,local.data.paths,datasets,local.driver,local.options),binding={projectId:f.p.projectId,policyHash:registered.policyHash,principalId:policy.backendPrincipalId,backendRef:policy.backendRef,runnerId:policy.runnerId,backend:service},consumer=await AcceptancePreparationConsumer.create(f.storage,{bindings:[binding]});
 const pass=outcome(consumer.tick());let stopping,stopped=false;
 try{
  await enters(entered,pass);stopping=consumer.stop().then(()=>{stopped=true;});
  await retained(pass,async()=>{assert.equal(stopped,false);assert.equal(await authorize(),false);assert.ok(await f.call('getRun',{runId:f.p.runId}));assert.deepEqual(local.mutations(),[]);});
 }finally{release.resolve();await pass;await (stopping??consumer.stop());}
 assert.equal(stopped,true);assert.equal(acquireCalls,1);assert.equal(local.data.authority.acquisitions,1);assert.deepEqual(local.mutations(),[]);
 const p=await f.call('getAcceptancePreparation',{principalId:'user_1',operationId:pending.operationId}),paths=local.data.pathsFor(p),journal=await readFile(paths.journalPath);assert.equal(p.state,'SENT');assert.equal((await datasets.inspect(p)).errorCode,'ACCEPTANCE_DATA_ORIGINAL_INCOMPLETE');
 await f.reopen();await local.reopen();const recovered=await AcceptancePreparationConsumer.create(f.storage,{bindings:[binding]});try{await recovered.tick();}finally{await recovered.stop();}
 assert.equal(acquireCalls,1);assert.deepEqual(local.mutations(),[]);assert.deepEqual(await readFile(paths.journalPath),journal);assert.deepEqual(await readdir(paths.directory),['operation.json']);
 assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT accepted_release_id FROM projects').accepted_release_id,null);
});
