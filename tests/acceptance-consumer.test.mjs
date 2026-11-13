// Actual file-backed SQLite Workers and original command/CAS state. Backend
// proofs, physical fences, Runner custody and health remain explicit fixtures.
import test from 'node:test';import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {AcceptancePreparationConsumer} from '../packages/platform-core/dist/index.mjs';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {acceptanceEntryFixture,commitBody} from './fixtures/acceptance-entry.mjs';
import {binding,explicitAcceptanceBackend} from './fixtures/acceptance-readiness.mjs';
import {meta} from './fixtures/storage-data.mjs';
const scope=(f,backend=explicitAcceptanceBackend())=>({projectId:f.p.projectId,policyHash:f.policyHash,principalId:f.policy.backendPrincipalId,backendRef:f.policy.backendRef,runnerId:f.policy.runnerId,backend});
const work=(f,extra={})=>f.call('listAcceptancePreparationWork',{principalId:f.policy.backendPrincipalId,projectId:f.p.projectId,policyHash:f.policyHash,...extra});
const current=(f,p)=>f.call('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId});
const barrier=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function until(check){const deadline=Date.now()+10000;while(!await check()){assert.ok(Date.now()<deadline,'condition was not observed');await delay(20);}}

test('trusted acceptance consumer rejects unregistered, foreign, disabled and duplicate bindings before backend work',{timeout:180000},async t=>{
 const f=await acceptanceFixture(t),b=scope(f),create=(patch={})=>AcceptancePreparationConsumer.create(f.storage,{bindings:[{...b,...patch}]});
 assert.equal((await f.call('getAcceptancePreparationScope',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash})).policy.backendRef,b.backendRef);
 for(const [patch,code] of [[{principalId:'user_1'},'FORBIDDEN'],[{policyHash:'f'.repeat(64)},'ACCEPTANCE_BACKEND_NOT_CONFIGURED'],[{projectId:'prj_unregistered'},'ACCEPTANCE_BACKEND_NOT_CONFIGURED'],[{runnerId:'runner.other'},'ACCEPTANCE_CONSUMER_CONFIG_INVALID'],[{backendRef:'backend.other'},'ACCEPTANCE_CONSUMER_CONFIG_INVALID'],[{backend:{...b.backend,configured:false}},'ACCEPTANCE_CONSUMER_CONFIG_INVALID']])await assert.rejects(create(patch),{code});
 await assert.rejects(AcceptancePreparationConsumer.create(f.storage,{bindings:[b,b]}),{code:'ACCEPTANCE_CONSUMER_CONFIG_INVALID'});
 for(const options of [{bindings:[]},{bindings:[b],maxConcurrentProjects:3},{bindings:[b],pollIntervalMs:30001},{bindings:[b],pageSize:101}])await assert.rejects(AcceptancePreparationConsumer.create(f.storage,options));
 await assert.rejects(f.call('listAcceptancePreparationWork',{principalId:'user_1',projectId:b.projectId,policyHash:b.policyHash}),{code:'FORBIDDEN'});assert.deepEqual(b.backend.counts,{preflight:0,prepare:0,inspect:0});
});

test('terminal history does not occupy the work page; concurrent ticks share one original preparation dispatch',{timeout:240000},async t=>{
 const f=await acceptanceFixture(t);
 for(let i=0;i<21;i++){const p=await f.call('beginAcceptancePreparation',await f.request()),r=await f.call('getRun',{runId:f.p.runId});await f.call('failUnsentAcceptancePreparation',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+r.resourceRevision+'"',operationId:p.operationId,requestHash:p.requestHash});}
 const p=await f.call('beginAcceptancePreparation',await f.request()),page=await work(f,{limit:1});assert.equal(page.items.length,1);assert.equal(page.items[0].preparation.operationId,p.operationId);assert.equal(page.nextSequence,null);assert.equal((await f.call('listAcceptancePreparations',{principalId:f.policy.backendPrincipalId,projectId:f.p.projectId,policyHash:f.policyHash,limit:1})).items[0].preparation.state,'FAILED');
 const backend=explicitAcceptanceBackend(),entered=barrier(),release=barrier(),prepare=backend.prepare.bind(backend);backend.prepare=async(...args)=>{const o=await prepare(...args);entered.resolve();await release.promise;return o;};
 t.after(()=>release.resolve());
 const consumer=await AcceptancePreparationConsumer.create(f.storage,{bindings:[scope(f,backend)]});t.after(()=>consumer.stop());const pass=consumer.tick();await entered.promise;assert.equal(consumer.tick(),pass);assert.equal(consumer.tick(),pass);release.resolve();await pass;
 const first=await f.call('getAcceptanceReadiness',binding(f,p));assert.equal(first.state,'READY');assert.equal(backend.counts.prepare,1);await consumer.tick();assert.equal(backend.counts.inspect,1);assert.equal((await f.call('getAcceptanceReadiness',binding(f,p))).proofHash,first.proofHash);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT accepted_release_id FROM projects').accepted_release_id,null);
});

test('consumer recovery retains original dispatch after grant ACK loss and observation after committed ACK loss',{timeout:240000},async t=>{
 for(const phase of ['markAcceptancePreparationSent','recordAcceptancePreparationObservation'])await t.test(phase,async t=>{
  const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),backend=explicitAcceptanceBackend();let dropped=false;
  const storage={async request(method,input){const result=await f.call(method,input);if(!dropped&&method===phase){dropped=true;throw Error('explicit private ACK loss; do not expose this text');}return result;}};
  const first=await AcceptancePreparationConsumer.create(storage,{bindings:[scope(f,backend)]});await first.tick();assert.equal(dropped,true);assert.equal(first.lastError,'ACCEPTANCE_RECOVERY_UNAVAILABLE');await first.stop();await f.reopen();
  const saved=await f.call('getAcceptanceReadiness',binding(f,p)),second=await AcceptancePreparationConsumer.create(f.storage,{bindings:[scope(f,backend)]});t.after(()=>second.stop());await second.tick();assert.equal(backend.counts.prepare,phase==='markAcceptancePreparationSent'?0:1);assert.equal(backend.counts.inspect,1);
  const after=await f.call('getAcceptanceReadiness',binding(f,p));if(phase==='recordAcceptancePreparationObservation'){assert.equal(saved.state,'READY');assert.equal(after.proofHash,saved.proofHash);assert.equal(after.sequence,saved.sequence+1);}else{assert.equal(after.state,'UNAVAILABLE');assert.equal(after.reasonCode,'FIXTURE_ORIGINAL_UNCERTAIN');assert.equal(after.proof,null);}
  assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
});

test('health expires on real reads; only the trusted periodic consumer refreshes the immutable original proof',{timeout:180000},async t=>{
 const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),backend=explicitAcceptanceBackend(),consumer=await AcceptancePreparationConsumer.create(f.storage,{bindings:[scope(f,backend)],pollIntervalMs:1000});t.after(()=>consumer.stop());
 await consumer.tick();const initial=await f.call('getAcceptanceReadiness',binding(f,p));await delay(31050);const expired=await f.call('getAcceptanceReadiness',binding(f,p));assert.equal(expired.reasonCode,'ACCEPTANCE_HEALTH_EXPIRED');assert.equal(backend.counts.inspect,0);assert.equal(expired.proofHash,initial.proofHash);
 consumer.start();assert.throws(()=>consumer.start(),/only start once/);await until(async()=>(await f.call('getAcceptanceReadiness',binding(f,p))).state==='READY');const recovered=await f.call('getAcceptanceReadiness',binding(f,p));assert.equal(recovered.proofHash,initial.proofHash);assert.ok(recovered.sequence>initial.sequence);assert.equal(backend.counts.prepare,1);await until(()=>backend.counts.inspect>=2);
 const stop=consumer.stop();assert.equal(consumer.stop(),stop);await stop;const inspected=backend.counts.inspect;await consumer.tick();assert.equal(backend.counts.inspect,inspected);assert.throws(()=>consumer.start(),/only start once/);
});

test('stop during preflight leaves PREPARED; stop during original execution revokes new authorization and drains the active call',{timeout:240000},async t=>{
 for(const phase of ['preflight','prepare'])await t.test(phase,async t=>{
  const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),backend=explicitAcceptanceBackend(),entered=barrier(),release=barrier();let allowed;
  t.after(()=>release.resolve());
  if(phase==='preflight'){backend.preflight=async()=>{backend.counts.preflight++;entered.resolve();await release.promise;};}else{backend.prepare=async(_p,authorize)=>{backend.counts.prepare++;entered.resolve();await release.promise;allowed=await authorize();return {state:'UNKNOWN',errorCode:'FIXTURE_DRAINED_ORIGINAL',checkedAt:new Date().toISOString()};};}
  const consumer=await AcceptancePreparationConsumer.create(f.storage,{bindings:[scope(f,backend)]}),pass=consumer.tick();await entered.promise;let drained=false;const stopping=consumer.stop().then(()=>{drained=true;});await Promise.resolve();assert.equal(drained,false);assert.ok(await f.call('getRun',{runId:f.p.runId}));release.resolve();await pass;await stopping;
  assert.equal((await current(f,p)).state,phase==='preflight'?'PREPARED':'SENT');if(phase==='preflight')assert.equal(backend.counts.prepare,0);else assert.equal(allowed,false);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
});

test('bounded project rotation and concurrency do not let one failed scope starve another actual Worker',{timeout:240000},async t=>{
 const fs=[];for(let i=0;i<3;i++){const f=await acceptanceFixture(t);f.prepared=await f.call('beginAcceptancePreparation',await f.request());fs.push(f);}
 const reads=[],route={request(method,input){const f=fs.find(f=>input.projectId===f.p.projectId||input.operationId===f.prepared.operationId);assert.ok(f,'known original scope');if(method==='listAcceptancePreparationWork')reads.push(f.p.projectId);return f.call(method,input);}},bindings=fs.map(f=>scope(f)),rotating=await AcceptancePreparationConsumer.create(route,{bindings,maxScopesPerPass:1});
 bindings[0].backend.preflight=async()=>{throw Error('Pinned function should not be replaced');}; // The installed methods are snapshots.
 await rotating.tick();await rotating.tick();await rotating.tick();assert.deepEqual(reads,fs.map(f=>f.p.projectId));await rotating.stop();
 let active=0,max=0;const inspections=new Map(),entered=barrier(),release=barrier();t.after(()=>release.resolve());const fresh=fs.map(f=>{const backend=explicitAcceptanceBackend();backend.inspect=async()=>{inspections.set(f.p.projectId,(inspections.get(f.p.projectId)??0)+1);active++;max=Math.max(max,active);if(active===2)entered.resolve();await release.promise;active--;return {state:'UNKNOWN',errorCode:'FIXTURE_ORIGINAL_PENDING',checkedAt:new Date().toISOString()};};return scope(f,backend);});
 const concurrent=await AcceptancePreparationConsumer.create(route,{bindings:fresh,maxConcurrentProjects:2}),pass=concurrent.tick();await entered.promise;assert.equal(max,2);release.resolve();await pass;await concurrent.stop();assert.equal(max,2);assert.equal(active,0);
 assert.deepEqual([...inspections.values()],[1,1,1]);const failing={...route,request(method,input){if(method==='listAcceptancePreparationWork'&&input.projectId===fs[0].p.projectId)throw Error('private fixture path');return route.request(method,input);}},resilient=await AcceptancePreparationConsumer.create(failing,{bindings:fresh});await resilient.tick();await resilient.stop();assert.equal(resilient.lastError,'ACCEPTANCE_RECOVERY_UNAVAILABLE');assert.equal(inspections.get(fs[0].p.projectId),1);assert.equal(inspections.get(fs[1].p.projectId),2);assert.equal(inspections.get(fs[2].p.projectId),2);
});

test('ABORTING and actual committed T5 originals are excluded from preparation work and never inspected',{timeout:240000},async t=>{
 const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),sent=(await f.call('markAcceptancePreparationSent',f.bound(p))).preparation,r=await f.call('getRun',{runId:f.p.runId});
 await f.call('requestAcceptanceAbort',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+r.resourceRevision+'"',preparationOperationId:p.operationId,requestHash:p.requestHash,expectedPreparationRevision:sent.revision,reason:'Explicit abort fixture; no cleanup asserted.',confirmation:'ABORT_ACCEPTANCE_PREPARATION'});assert.deepEqual((await work(f)).items,[]);
 const backend=explicitAcceptanceBackend(),consumer=await AcceptancePreparationConsumer.create(f.storage,{bindings:[scope(f,backend)]});await consumer.tick();await consumer.stop();assert.deepEqual(backend.counts,{preflight:0,prepare:0,inspect:0});
 const g=await acceptanceEntryFixture(t),prepared=await g.call('beginAcceptancePreparation',await g.request());await g.ready(prepared.operationId);const response=await g.httpGet(g.base+'/preparations/'+prepared.operationId),publicView=await response.json(),accepted=await g.httpPost('/api/v1/candidates/'+g.candidate.candidateId+':accept',commitBody(publicView),{match:response.headers.get('etag')});assert.equal(accepted.status,202,await accepted.clone().text());assert.deepEqual((await work(g)).items,[]);
 const b=explicitAcceptanceBackend(),c=await AcceptancePreparationConsumer.create(g.storage,{bindings:[scope(g,b)]});await c.tick();await c.stop();assert.deepEqual(b.counts,{preflight:0,prepare:0,inspect:0});assert.equal(g.get('SELECT count(*) n FROM releases').n,1);assert.equal(g.get('SELECT state FROM release_publications').state,'PENDING');
});
