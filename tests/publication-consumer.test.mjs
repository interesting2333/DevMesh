// Actual control Worker, accepted T5 and publication transactions. Backend
// physical retirement/fence/service/route/health statements are explicit fixtures.
import test from 'node:test';import assert from 'node:assert/strict';import {setTimeout as delay} from 'node:timers/promises';
import {ReleasePublicationConsumer} from '../packages/platform-core/dist/index.mjs';
import {committedPublicationFixture,dispatchPublication,publicationRecord,publishedObservation,seedSourcePublication} from './fixtures/release-publication.mjs';
import {publicationScope,explicitPublicationBackend,barrier} from './fixtures/publication-consumer.mjs';
const work=(f,extra={})=>f.call('listReleasePublicationWork',{principalId:f.policy.backendPrincipalId,projectId:f.p.projectId,policyHash:f.policyHash,...extra});
const state=f=>f.call('getReleasePublication',f.subject),accepted=f=>Object.fromEntries(['releases','acceptance_commits','release_promotion_outbox','projects'].map(name=>[name,f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
async function until(check){const deadline=Date.now()+10000;while(!await check()){assert.ok(Date.now()<deadline,'condition not observed');await delay(20);}}

test('publication consumer validates explicit original policy/actor/Runner and rejects disabled or duplicate scopes before effects',{timeout:180000},async t=>{
 const f=await committedPublicationFixture(t),backend=explicitPublicationBackend(),b=publicationScope(f,backend),create=patch=>ReleasePublicationConsumer.create(f.storage,{bindings:[{...b,...patch}]});
 for(const [patch,code]of [[{principalId:'user_1'},'FORBIDDEN'],[{projectId:'prj_foreign'},'ACCEPTANCE_BACKEND_NOT_CONFIGURED'],[{policyHash:'f'.repeat(64)},'ACCEPTANCE_BACKEND_NOT_CONFIGURED'],[{runnerId:'runner.foreign'},'RELEASE_CONSUMER_CONFIG_INVALID'],[{backendRef:'backend.foreign'},'RELEASE_CONSUMER_CONFIG_INVALID'],[{backend:{...backend,configured:false}},'RELEASE_CONSUMER_CONFIG_INVALID']])await assert.rejects(create(patch),{code});
 for(const options of [{bindings:[]},{bindings:[b,b]},{bindings:[b],maxConcurrentProjects:3},{bindings:[b],pollIntervalMs:0},{bindings:[b],pageSize:21}])await assert.rejects(ReleasePublicationConsumer.create(f.storage,options),{code:'RELEASE_CONSUMER_CONFIG_INVALID'});
 await assert.rejects(work(f,{principalId:'user_1'}),{code:'FORBIDDEN'});assert.deepEqual(backend.counts,{preflight:0,publish:0,inspect:0,resume:0});assert.equal((await state(f)).state,'PENDING');
});

test('published history and superseded metadata never occupy a current work page; the original history query stays complete',{timeout:180000},async t=>{
 const f=await committedPublicationFixture(t),first=f.publication,done=(await dispatchPublication(f)).publication;await f.call('recordReleasePublicationObservation',publicationRecord(done,publishedObservation(done)));assert.deepEqual((await work(f,{limit:1})).items,[]);
 await seedSourcePublication(f);const next=f.publication,page=await work(f,{limit:1});assert.equal(page.items.length,1);assert.equal(page.items[0].publication.releaseId,next.releaseId);assert.equal(page.nextSequence,null);
 const history=await f.call('listReleasePublications',{principalId:f.policy.backendPrincipalId,projectId:f.p.projectId,policyHash:f.policyHash,limit:1});assert.equal(history.items[0].publication.releaseId,first.releaseId);assert.equal(history.items[0].publication.state,'PUBLISHED');assert.ok(history.nextSequence);
 // Explicit pointer projection fixture only; not another legitimate T5 iteration.
 f.run('UPDATE projects SET accepted_release_id=? WHERE project_id=?',first.releaseId,f.p.projectId);assert.deepEqual((await work(f)).items,[]);f.run('UPDATE projects SET accepted_release_id=? WHERE project_id=?',next.releaseId,f.p.projectId);
 assert.equal((await work(f)).items[0].publication.releaseId,next.releaseId);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('concurrent publication ticks share one grant, publish once and preserve the original accepted receipt and closed-source semantics',{timeout:180000},async t=>{
 const f=await committedPublicationFixture(t),before=accepted(f),backend=explicitPublicationBackend(),entered=barrier(),release=barrier(),publish=backend.publish.bind(backend);t.after(()=>release.resolve());backend.publish=async(...args)=>{const o=await publish(...args);entered.resolve();await release.promise;return o;};
 const consumer=await ReleasePublicationConsumer.create(f.storage,{bindings:[publicationScope(f,backend)]});t.after(()=>consumer.stop());const pass=consumer.tick();await entered.promise;assert.equal(consumer.tick(),pass);release.resolve();await pass;await consumer.tick();const p=await state(f);assert.equal(p.state,'PUBLISHED');assert.equal(backend.counts.publish,1);assert.equal(backend.counts.inspect,0);assert.deepEqual(accepted(f),before);assert.equal((await f.call('commitReleaseAcceptance',f.commitInput)).result.publicationState,'PENDING');assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',p.request.preparation.target.datasetId).state,'OPEN');assert.equal(f.get('SELECT count(*) n FROM release_publication_proofs').n,1);
});

test('lost grant and committed publication ACK recover only the original Release and never repeat the publish method',{timeout:240000},async t=>{
 for(const phase of ['beginReleasePublication','recordReleasePublicationObservation'])await t.test(phase,async t=>{
  const f=await committedPublicationFixture(t),before=accepted(f),backend=explicitPublicationBackend({resume:true});let dropped=false;
  const storage={async request(method,input){const result=await f.call(method,input);if(!dropped&&method===phase){dropped=true;throw Error('explicit lost publication ACK with private details');}return result;}};
  const first=await ReleasePublicationConsumer.create(storage,{bindings:[publicationScope(f,backend)]});await first.tick();assert.equal(dropped,true);assert.equal(first.lastError,'RELEASE_RECOVERY_UNAVAILABLE');await first.stop();await f.reopen();const second=await ReleasePublicationConsumer.create({request:(m,i)=>f.call(m,i)},{bindings:[publicationScope(f,backend)]});t.after(()=>second.stop());await second.tick();assert.equal((await state(f)).state,'PUBLISHED');assert.equal(backend.counts.publish,phase==='beginReleasePublication'?0:1);assert.equal(backend.counts.resume,phase==='beginReleasePublication'?1:0);assert.equal(backend.counts.inspect,phase==='beginReleasePublication'?1:0);assert.deepEqual(accepted(f),before);assert.equal(f.get('SELECT count(*) n FROM release_publication_proofs').n,1);
 });
});

test('route failure retains accepted facts and CLOSED target; independent periodic continuation uses the same original Release',{timeout:180000},async t=>{
 const f=await committedPublicationFixture(t),before=accepted(f),backend=explicitPublicationBackend({resume:true,complete:false}),consumer=await ReleasePublicationConsumer.create(f.storage,{bindings:[publicationScope(f,backend)],pollIntervalMs:1000});t.after(()=>consumer.stop());await consumer.tick();assert.equal((await state(f)).state,'UNKNOWN');assert.deepEqual(accepted(f),before);assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.prepared.request.target.datasetId).state,'CLOSED');
 consumer.start();assert.throws(()=>consumer.start(),/only start once/);await until(()=>backend.counts.resume>0);assert.equal((await state(f)).state,'UNKNOWN');backend.complete=true;await until(async()=>(await state(f)).state==='PUBLISHED');assert.equal(backend.counts.publish,1);assert.ok(backend.counts.inspect>=2);assert.deepEqual(accepted(f),before);const stopping=consumer.stop();assert.equal(consumer.stop(),stopping);await stopping;const counts={...backend.counts};await consumer.tick();assert.deepEqual(backend.counts,counts);assert.throws(()=>consumer.start(),/only start once/);
});

test('a backend without continuation stays UNKNOWN and a runtime-disabled backend performs no new scan or effect',{timeout:180000},async t=>{
 const f=await committedPublicationFixture(t),backend=explicitPublicationBackend({complete:false});let scans=0;const storage={request(method,input){if(method==='listReleasePublicationWork')scans++;return f.call(method,input);}},consumer=await ReleasePublicationConsumer.create(storage,{bindings:[publicationScope(f,backend)]});await consumer.tick();await consumer.tick();assert.equal((await state(f)).state,'UNKNOWN');assert.deepEqual(backend.counts,{preflight:1,publish:1,inspect:1,resume:0});backend.configured=false;const prior=scans;await consumer.tick();await consumer.stop();assert.equal(scans,prior);assert.equal(consumer.lastError,'RELEASE_PUBLICATION_BACKEND_NOT_CONFIGURED');
});

test('stop in preflight, publish, inspect or resume drains the original call and closes both dispatch authorization kinds',{timeout:300000},async t=>{
 for(const phase of ['preflight','publish','inspect','resume'])await t.test(phase,async t=>{
  const f=await committedPublicationFixture(t),backend=explicitPublicationBackend({resume:true,complete:false}),entered=barrier(),release=barrier();t.after(()=>release.resolve());let allowed;
  if(['inspect','resume'].includes(phase))await dispatchPublication(f);
  const unknown=()=>({state:'UNKNOWN',errorCode:'FIXTURE_DRAINED_PUBLICATION',checkedAt:new Date().toISOString()});
  backend[phase]=async(_p,authorize)=>{backend.counts[phase]++;entered.resolve();await release.promise;if(authorize)allowed=await authorize();return phase==='preflight'?undefined:unknown();};
  const consumer=await ReleasePublicationConsumer.create(f.storage,{bindings:[publicationScope(f,backend)]}),pass=consumer.tick();await entered.promise;let drained=false;const stop=consumer.stop().then(()=>{drained=true;});await Promise.resolve();assert.equal(drained,false);assert.ok(await f.call('getRun',{runId:f.p.runId}));release.resolve();await pass;await stop;assert.equal((await state(f)).state,phase==='preflight'?'PENDING':'UNKNOWN');if(phase==='preflight')assert.equal(backend.counts.publish,0);if(phase==='publish'||phase==='resume')assert.equal(allowed,false);if(phase==='inspect')assert.equal(backend.counts.resume,0);assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.prepared.request.target.datasetId).state,'CLOSED');
 });
});

test('project rotation and two-call concurrency remain bounded and a scan error cannot starve other actual Workers',{timeout:240000},async t=>{
 const fs=[];for(let i=0;i<3;i++)fs.push(await committedPublicationFixture(t));const reads=[],route={request(method,input){const f=fs.find(f=>input.projectId===f.p.projectId||input.releaseId===f.publication.releaseId);assert.ok(f);if(method==='listReleasePublicationWork')reads.push(f.p.projectId);return f.call(method,input);}},bindings=fs.map(f=>publicationScope(f,explicitPublicationBackend({complete:false}))),rotating=await ReleasePublicationConsumer.create(route,{bindings,maxScopesPerPass:1});
 await rotating.tick();await rotating.tick();await rotating.tick();assert.deepEqual(reads,fs.map(f=>f.p.projectId));await rotating.stop();let active=0,max=0;const inspected=new Map(),entered=barrier(),release=barrier();t.after(()=>release.resolve());
 const next=fs.map(f=>{const b=explicitPublicationBackend({complete:false});b.inspect=async()=>{inspected.set(f.p.projectId,(inspected.get(f.p.projectId)??0)+1);active++;max=Math.max(max,active);if(active===2)entered.resolve();await release.promise;active--;return {state:'UNKNOWN',errorCode:'FIXTURE_ORIGINAL_UNAVAILABLE',checkedAt:new Date().toISOString()};};return publicationScope(f,b);}),concurrent=await ReleasePublicationConsumer.create(route,{bindings:next}),pass=concurrent.tick();await entered.promise;assert.equal(max,2);release.resolve();await pass;await concurrent.stop();assert.equal(max,2);assert.equal(active,0);
 const faulty={request(method,input){if(method==='listReleasePublicationWork'&&input.projectId===fs[0].p.projectId)throw Error('private path must not escape');return route.request(method,input);}},resilient=await ReleasePublicationConsumer.create(faulty,{bindings:next});await resilient.tick();await resilient.stop();assert.equal(resilient.lastError,'RELEASE_RECOVERY_UNAVAILABLE');assert.equal(inspected.get(fs[0].p.projectId),1);assert.equal(inspected.get(fs[1].p.projectId),2);assert.equal(inspected.get(fs[2].p.projectId),2);
});
