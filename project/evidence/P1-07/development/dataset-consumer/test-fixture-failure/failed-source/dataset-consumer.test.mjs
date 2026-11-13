import test from 'node:test';import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {setTimeout as delay} from 'node:timers/promises';
import {PreviewDatasetConsumer,DatasetPreparer} from '../packages/platform-core/dist/index.mjs';
import {LocalSqliteDatasetBackend} from '../packages/runner/dist/index.mjs';
import {previewConsumerFixture,previewScope,barrier} from './fixtures/preview-consumer.mjs';
import {datasetFixture,datasetEffect} from './fixtures/datasets.mjs';
const unknown=()=>({state:'UNKNOWN',errorCode:'EXPLICIT_FIXTURE_NOT_OBSERVED'});
const backend=()=>({configured:true,async preflight(){},async prepare(_e,authorize){assert.equal(await authorize(),true);return unknown();},async inspect(){return unknown();}});
const fixture=t=>previewConsumerFixture(t,{pendingDataset:true});
async function consume(t,f,b,options={}){const c=await PreviewDatasetConsumer.create(f.storage,{bindings:[previewScope(f,b)],...options});t.after(()=>c.stop());return c;}

test('dataset consumer authenticates original registered scope, bounds configuration and pins the public adapter methods',async t=>{
 const f=await fixture(t),b=backend();
 for(const patch of [{principalId:'user_1'},{runnerId:'runner.other'},{backendRef:'other'},{policyHash:'f'.repeat(64)},{backend:{...b,configured:false}}])await assert.rejects(PreviewDatasetConsumer.create(f.storage,{bindings:[{...previewScope(f,b),...patch}]}));
 for(const options of [{bindings:[]},{bindings:[previewScope(f,b),previewScope(f,b)]},{maxConcurrentProjects:3},{pollIntervalMs:999},{maxScopesPerPass:33},{pageSize:21}])await assert.rejects(PreviewDatasetConsumer.create(f.storage,{bindings:[previewScope(f,b)],...options}));
 const entered=barrier(),release=barrier();let calls=0;b.preflight=async()=>{calls++;entered.resolve();await release.promise;};const c=await consume(t,f,b);b.preflight=async()=>{throw Error('method replaced after construction');};const a=c.tick();assert.equal(c.tick(),a);try{await entered.promise;}finally{release.resolve();}await a;assert.equal(calls,1);assert.equal((await f.readEffect(f.d.operationId)).state,'UNKNOWN');assert.equal(c.lastError,null);await c.tick();assert.equal(calls,1);
 await assert.rejects(f.call('listPreviewDatasetWork',{principalId:'user_1',projectId:f.p.projectId,policyHash:f.policyHash}));
});

test('actual dataset files become READY after lost backend ACK and control Worker reopen, without reinitializing or creating preview/release',async t=>{
 const f=await fixture(t),data=await datasetFixture(t);let prepares=0,queries=0;
 const b={configured:true,preflight:e=>data.backend.preflight(e),async prepare(e,a){prepares++;const result=await data.backend.prepare(e,a);assert.equal(result.state,'SUCCEEDED');throw Error('explicit ACK lost after physical ready');},async inspect(e){queries++;return data.backend.inspect(e);}};
 let c=await consume(t,f,b);await c.tick();assert.equal((await f.readEffect(f.d.operationId)).state,'UNKNOWN');const original=await f.readEffect(f.d.operationId),paths=data.paths.resolve(original.request),bytes=await readFile(paths.databasePath),journal=await readFile(paths.journalPath);await c.stop();await f.reopen();c=await consume(t,f,b);await c.tick();const ready=await f.readEffect(original.operationId);assert.equal(ready.state,'SUCCEEDED');assert.equal(prepares,1);assert.equal(queries,1);assert.deepEqual(await readFile(paths.databasePath),bytes);assert.deepEqual(await readFile(paths.journalPath),journal);assert.equal(data.app(ready).list().tasks.length,0);
 assert.equal(f.get('SELECT count(*) n FROM previews').n,0);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal((await f.call('listPreviewDatasetWork',{principalId:f.principalId,projectId:f.p.projectId,policyHash:f.policyHash})).items.length,0);await c.tick();assert.equal(queries,1);
});

test('committed dispatch ACK loss never grants a second prepare, including after actual Worker reopen',async t=>{
 const f=await fixture(t),storage={request:async(m,i)=>{const value=await f.call(m,i);if(m==='markPreviewEffectSent')throw Error('explicit committed dispatch ACK lost');return value;}},b=backend();let prepares=0,queries=0;b.prepare=async()=>{prepares++;return unknown();};b.inspect=async()=>{queries++;return unknown();};let c=await PreviewDatasetConsumer.create(storage,{bindings:[previewScope(f,b)]});await c.tick();await c.stop();assert.equal((await f.readEffect(f.d.operationId)).state,'SENT');await f.reopen();c=await consume(t,f,b);await c.tick();assert.equal(prepares,0);assert.equal(queries,1);assert.equal((await f.readEffect(f.d.operationId)).state,'UNKNOWN');
});

test('stopping while preflight is paused leaves the original intent PREPARED and drains the actual invocation',async t=>{
 const f=await fixture(t),entered=barrier(),release=barrier(),b=backend();let prepares=0;b.preflight=async()=>{entered.resolve();await release.promise;};b.prepare=async()=>{prepares++;return unknown();};const c=await consume(t,f,b),pass=c.tick();await entered.promise;let ended=false;const stop=c.stop().then(()=>{ended=true;});try{await delay(20);assert.equal(ended,false);}finally{release.resolve();}await Promise.all([pass,stop]);assert.equal(prepares,0);assert.equal((await f.readEffect(f.d.operationId)).state,'PREPARED');await c.tick();assert.equal(prepares,0);
});

test('stopping or removing the original owner closes final authorization before a real dataset Worker creates its journal',async t=>{
 for(const mode of ['STOP','REMOVE'])await t.test(mode,async t=>{
  const f=await fixture(t),data=await datasetFixture(t),entered=barrier(),release=barrier();let allowed;
  const b={configured:true,preflight:e=>data.backend.preflight(e),prepare:(e,a)=>data.backend.prepare(e,async()=>{entered.resolve();await release.promise;allowed=await a();return allowed;}),inspect:e=>data.backend.inspect(e)},c=await consume(t,f,b),pass=c.tick();await entered.promise;
  let stopping;if(mode==='STOP')stopping=c.stop();else f.exec('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');release.resolve();await pass;await stopping;assert.equal(allowed,false);const e=await f.readEffect(f.d.operationId);assert.equal(e.state,'UNKNOWN');await assert.rejects(access(data.paths.resolve(e.request).journalPath));
 });
});

test('real Worker timeout closes delayed authorization and retains its slot until the authority RPC actually drains',async t=>{
 const data=await datasetFixture(t),b=new LocalSqliteDatasetBackend({...data.backendOptions,timeoutMs:1000,maximumWorkers:1}),e=datasetEffect(),next=datasetEffect(),entered=barrier(),release=barrier();let secondEntered=false,settled=false;
 const first=b.prepare(e,async()=>{entered.resolve();await release.promise;return true;}).then(()=>{settled=true;},error=>{settled=true;throw error;});const rejected=assert.rejects(first,error=>error.code==='DATASET_WORKER_OUTCOME_UNKNOWN');await entered.promise;const second=b.prepare(next,async()=>{secondEntered=true;return false;});try{await delay(1250);assert.equal(settled,false);assert.equal(secondEntered,false);}finally{release.resolve();}await rejected;assert.equal((await second).state,'UNKNOWN');assert.equal(secondEntered,true);await assert.rejects(access(data.paths.resolve(e.request).journalPath));await assert.rejects(access(data.paths.resolve(next.request).journalPath));
});

test('dataset work cursor ignores terminal and preview rows, rotates projects with a two-call limit and isolates scan failure',{timeout:240000},async t=>{
 const fs=await Promise.all([fixture(t),fixture(t),fixture(t)]),pending=[],counts=new Map();let active=0,maximum=0;
 const bindings=fs.map(f=>previewScope(f,{configured:true,async preflight(){},async prepare(_e,a){assert.equal(await a(),true);counts.set(f.p.projectId,(counts.get(f.p.projectId)??0)+1);active++;maximum=Math.max(maximum,active);const r=barrier();pending.push(r);await r.promise;active--;return unknown();},async inspect(){counts.set(f.p.projectId,(counts.get(f.p.projectId)??0)+1);return unknown();}}));
 let broken=false;const storage={request(m,i){if(broken&&i.projectId===fs[0].p.projectId&&m==='listPreviewDatasetWork')throw Error('explicit private failure text must not escape');const f=fs.find(f=>f.p.projectId===i.projectId||f.d.operationId===i.operationId);if(!f)throw Error('No explicit fixture route');return f.call(m,i);}},c=await PreviewDatasetConsumer.create(storage,{bindings,maxScopesPerPass:2,maxConcurrentProjects:2,pageSize:1});t.after(()=>c.stop());
 const pass=c.tick();while(pending.length<2)await delay(10);assert.equal(maximum,2);for(const p of pending)p.resolve();await pass;const next=c.tick();while(pending.length<3)await delay(10);pending[2].resolve();await next;assert.deepEqual(fs.map(f=>counts.get(f.p.projectId)),[2,1,1]);broken=true;await c.tick();await c.tick();assert.equal(c.lastError,'DATASET_RECOVERY_UNAVAILABLE');assert.ok((counts.get(fs[1].p.projectId)??0)>1);
 const p=await previewConsumerFixture(t),page=await p.call('listPreviewDatasetWork',{principalId:p.principalId,projectId:p.p.projectId,policyHash:p.policyHash,limit:1});assert.deepEqual(page.items,[]);assert.equal(page.nextSequence,null);
});

test('a directly closed preparer cannot grant new work',async t=>{const f=await fixture(t),p=new DatasetPreparer(f.storage,f.principalId,backend());p.stopAdmission();await assert.rejects(p.advance(f.d.operationId),error=>error.code==='DATASET_PREPARER_CLOSED');assert.equal((await f.readEffect(f.d.operationId)).state,'PREPARED');});
