import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {setTimeout as delay} from 'node:timers/promises';
import {PreviewLifecycleConsumer} from '../packages/platform-core/dist/index.mjs';
import {previewConsumerFixture,previewScope,barrier} from './fixtures/preview-consumer.mjs';
import {ControlledPreviewBackend} from './fixtures/preview-lifecycle.mjs';
const create=(f,backend=f.backend,extra={})=>PreviewLifecycleConsumer.create(f.storage,{bindings:[previewScope(f,backend)],...extra});
async function until(check,timeout=10000){const deadline=Date.now()+timeout;while(!await check()){assert.ok(Date.now()<deadline,'condition not observed');await delay(30);}}

test('trusted preview consumer validates original registered identity, explicit bounds and duplicate projects before I/O',{timeout:180000},async t=>{
 const f=await previewConsumerFixture(t),b=previewScope(f);
 assert.equal((await f.call('getPreviewLifecycleScope',{principalId:f.principalId,projectId:f.p.projectId,policyHash:f.policyHash})).policy.runnerId,b.runnerId);
 for(const patch of [{principalId:'user_1'},{projectId:'prj_unregistered'},{policyHash:'f'.repeat(64)},{backendRef:'backend.foreign'},{runnerId:'runner.foreign'},{backend:{...f.backend,configured:false}}])await assert.rejects(PreviewLifecycleConsumer.create(f.storage,{bindings:[{...b,...patch}]}));
 for(const options of [{bindings:[]},{bindings:[b,b]},{bindings:[b],pageSize:21},{bindings:[b],pollIntervalMs:10001},{bindings:[b],maxConcurrentProjects:3},{bindings:[b],maxScopesPerPass:0}])await assert.rejects(PreviewLifecycleConsumer.create(f.storage,options));
 await assert.rejects(f.call('getPreviewLifecycleScope',{principalId:'user_1',projectId:f.p.projectId,policyHash:f.policyHash}),{code:'FORBIDDEN'});assert.deepEqual(f.backend.starts,[]);assert.deepEqual(f.backend.queries,[]);
});

test('ticks coalesce, active preview pages rotate, terminal history stays outside work and adapter methods are pinned',{timeout:180000},async t=>{
 const f=await previewConsumerFixture(t),entered=barrier(),release=barrier(),execute=f.backend.execute.bind(f.backend);
 f.backend.execute=async(...args)=>{entered.resolve();await release.promise;return execute(...args);};
 const c=await create(f);let pass;
 try{pass=c.tick();await entered.promise;assert.equal(c.tick(),pass);release.resolve();await pass;}finally{release.resolve();await pass;await c.stop();}
 const first=await f.view(f.preview.previewId),stop=await f.call('stopPreviewIntent',f.stopInput(first)),stopper=await create(f);try{await stopper.tick();}finally{await stopper.stop();}assert.equal((await f.readEffect(stop.stopOperationId)).state,'SUCCEEDED');
 const p=await f.create(),prepare=await create(f);try{await prepare.tick();}finally{await prepare.stop();}
 const q=await f.create(),reads=[],storage={async request(m,i){const r=await f.call(m,i);if(m==='listPreviewLifecycles')reads.push(r.items.map(x=>x.lifecycle.preview.previewId));return r;}},adapter={configured:true,preflight:f.backend.preflight.bind(f.backend),execute:f.backend.execute.bind(f.backend),inspect:f.backend.inspect.bind(f.backend)},rotating=await PreviewLifecycleConsumer.create(storage,{bindings:[previewScope(f,adapter)],pageSize:1});
 adapter.preflight=async()=>{throw Error('replacement public method must not be installed');};
 try{await rotating.tick();await rotating.tick();await rotating.tick();}finally{await rotating.stop();}
 assert.deepEqual(reads,[[p.preview.previewId],[q.preview.previewId],[p.preview.previewId]]);assert.equal(f.backend.starts.length,3);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT count(*) n FROM datasets').n,3);
});

test('lost dispatch and committed runtime ACKs retain original operation across actual Worker reopen',{timeout:240000},async t=>{
 for(const phase of ['markPreviewEffectSent','recordPreviewRuntimeObservation'])await t.test(phase,async t=>{
  const f=await previewConsumerFixture(t);let dropped=false;const storage={async request(m,i){const r=await f.call(m,i);if(m===phase&&!dropped){dropped=true;throw Error('explicit private ACK loss');}return r;}},c=await PreviewLifecycleConsumer.create(storage,{bindings:[previewScope(f)]});await c.tick();await c.stop();assert.equal(c.lastError,'PREVIEW_RECOVERY_UNAVAILABLE');await f.reopen();
  const recovered=await create(f);try{await recovered.tick();}finally{await recovered.stop();}
  assert.equal(f.backend.starts.length,phase==='markPreviewEffectSent'?0:1);assert.equal((await f.readEffect(f.preview.operationId)).state,phase==='markPreviewEffectSent'?'UNKNOWN':'SUCCEEDED');assert.equal(f.get('SELECT count(*) n FROM previews').n,1);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 });
});

test('stop during preflight prevents dispatch; stop during execute denies final authorization and drains the real promise',{timeout:240000},async t=>{
 for(const phase of ['preflight','execute'])await t.test(phase,async t=>{
  const f=await previewConsumerFixture(t),entered=barrier(),release=barrier();let allowed;
  if(phase==='preflight')f.backend.preflight=async()=>{entered.resolve();await release.promise;};
  else f.backend.execute=async(_e,_d,authorize)=>{entered.resolve();await release.promise;allowed=await authorize();throw Error('explicit original call drained');};
  const c=await create(f),pass=c.tick();let stop,drained=false;
  try{await entered.promise;stop=c.stop().then(()=>{drained=true;});assert.equal(c.stop(),c.stop());await delay(20);assert.equal(drained,false);assert.ok(await f.call('getRun',{runId:f.p.runId}));}finally{release.resolve();await pass;await (stop??c.stop());}
  assert.equal((await f.readEffect(f.preview.operationId)).state,phase==='preflight'?'PREPARED':'UNKNOWN');if(phase==='execute')assert.equal(allowed,false);assert.deepEqual(f.backend.starts,[]);await c.tick();assert.throws(()=>c.start(),/only start once/);
 });
});

test('scope rotation, at most two unfinished projects and scan failure isolation use three actual control Workers',{timeout:240000},async t=>{
 const fs=[];for(let i=0;i<3;i++)fs.push(await previewConsumerFixture(t));
 const route={request(m,i){const f=fs.find(f=>i.projectId===f.p.projectId||i.previewId===f.preview.previewId||i.operationId===f.preview.operationId);assert.ok(f,'known original scope');return f.call(m,i);}},reads=[],tracked={request(m,i){if(m==='listPreviewLifecycles')reads.push(i.projectId);return route.request(m,i);}},bindings=fs.map(f=>previewScope(f)),rotating=await PreviewLifecycleConsumer.create(tracked,{bindings,maxScopesPerPass:1});
 try{await rotating.tick();await rotating.tick();await rotating.tick();}finally{await rotating.stop();}assert.deepEqual(reads,fs.map(f=>f.p.projectId));
 let active=0,maximum=0;const entered=barrier(),release=barrier(),calls=new Map(),fresh=fs.map(f=>{const b=new ControlledPreviewBackend(),inspect=b.inspect.bind(b);b.inspect=async e=>{active++;maximum=Math.max(maximum,active);calls.set(f.p.projectId,(calls.get(f.p.projectId)??0)+1);if(active===2)entered.resolve();try{await release.promise;return inspect(e);}finally{active--;}};return previewScope(f,b);}),c=await PreviewLifecycleConsumer.create(route,{bindings:fresh}),pass=c.tick();
 try{await entered.promise;assert.equal(maximum,2);}finally{release.resolve();await pass;await c.stop();}assert.equal(active,0);assert.equal(maximum,2);
 const failing={request(m,i){if(m==='listPreviewLifecycles'&&i.projectId===fs[0].p.projectId)throw Error('private path must not be exposed');return route.request(m,i);}},resilient=await PreviewLifecycleConsumer.create(failing,{bindings:fresh});await resilient.tick();await resilient.stop();assert.equal(resilient.lastError,'PREVIEW_RECOVERY_UNAVAILABLE');assert.deepEqual(fs.map(f=>calls.get(f.p.projectId)),[1,2,2]);
});

test('actual timer refreshes expired health and stops one original at real expiry while explicit release ownership is protected',{timeout:180000},async t=>{
 const f=await previewConsumerFixture(t,{expiresInMs:62000}),g=await previewConsumerFixture(t,{expiresInMs:62000}),route={request(m,i){const x=i.projectId===f.p.projectId||i.previewId===f.preview.previewId||i.operationId&&f.get('SELECT 1 FROM preview_effects WHERE operation_id=?',i.operationId)?f:g;return x.call(m,i);}},c=await PreviewLifecycleConsumer.create(route,{bindings:[previewScope(f),previewScope(g)],pollIntervalMs:1000});
 try{
  await c.tick();const original=await f.readEffect(f.preview.operationId);
  // Explicit ownership projection only; this insert is not a T5 acceptance.
  g.run('INSERT INTO releases(release_id,project_id,run_id,candidate_id,candidate_revision,acceptance_operation_id,manifest_hash,prepared_data_ref,accepted_by,accepted_at) VALUES(?,?,?,?,?,?,?,?,?,?)','release_preview_owned_fixture',g.p.projectId,g.p.runId,g.candidate.candidateId,g.candidate.revision,g.d.operationId,g.candidate.manifestHash,g.d.datasetId,'user_1',new Date().toISOString());g.run('UPDATE projects SET accepted_release_id=? WHERE project_id=?','release_preview_owned_fixture',g.p.projectId);
  await delay(31050);assert.equal((await f.view(f.preview.previewId)).availability,'UNAVAILABLE');assert.deepEqual(await f.readEffect(f.preview.operationId),original);
  c.start();assert.throws(()=>c.start(),/only start once/);await until(async()=>(await f.view(f.preview.previewId)).availability==='AVAILABLE');
  await until(async()=>(await f.view(f.preview.previewId)).state==='EXPIRED',45000);assert.equal(f.backend.starts.length,1);assert.equal(f.backend.stops.length,1);assert.equal((await f.lifecycle(f.preview.previewId)).stopEffect.state,'SUCCEEDED');assert.equal((await f.call('getPreviewDataset',{principalId:'user_1',runId:f.p.runId,datasetId:f.d.datasetId})).state,'READY');
  await until(()=>Date.now()>Date.parse(g.preview.expiresAt)+1100,15000);assert.equal(g.backend.stops.length,0);assert.equal((await g.view(g.preview.previewId)).state,'READY');assert.equal(g.get('SELECT accepted_release_id FROM projects').accepted_release_id,'release_preview_owned_fixture');assert.deepEqual(await f.readEffect(f.preview.operationId),original);
 }finally{await c.stop();}
});

test('trusted consumer composes actual dataset, Runner journal and loopback health; recorded stop survives owner removal without deleting data',{timeout:240000},async t=>{
 const f=await previewConsumerFixture(t,{runner:true}),c=await create(f);
 try{
  await c.tick();assert.equal((await f.view(f.preview.previewId)).availability,'AVAILABLE');assert.deepEqual(f.local.mutations(),['NETWORK_CREATE','CREATE','START']);
  const e=await f.readEffect(f.d.operationId),app=f.local.data.app(e);app.mutate({kind:'create',key:'preview_consumer_data_retention',input:{title:'停止后保留的数据',description:'actual SQLite',status:'doing'}});app.close();const path=f.local.data.paths.resolve(e.request).databasePath,bytes=await readFile(path);
  const stopping=await f.call('stopPreviewIntent',f.stopInput(await f.view(f.preview.previewId)));f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');await c.tick();assert.equal((await f.readEffect(stopping.stopOperationId)).state,'SUCCEEDED');assert.deepEqual(f.local.mutations(),['NETWORK_CREATE','CREATE','START','STOP']);assert.deepEqual(await readFile(path),bytes);assert.equal((await f.lifecycle(f.preview.previewId)).preview.state,'STOPPED');
  await f.reopen();const recovered=await create(f);try{await recovered.tick();}finally{await recovered.stop();}assert.deepEqual(f.local.mutations(),['NETWORK_CREATE','CREATE','START','STOP']);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);
 }finally{await c.stop();}
});
