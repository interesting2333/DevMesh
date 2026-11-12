import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { registryFixture,manifest,checks,commit,prepareDispatch } from './fixtures/a2a-data.mjs';
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);

test('manifest versions are durable, atomic, idempotent and refuse historical startup rollback',async t=>{
 const f=await registryFixture(t),original=await f.storage.request('getRegistrySnapshot',{});
 const again=await commit(f.storage,f.manifest);assert.equal(again.generationId,original.generationId);
 await rejects(commit(f.storage,{...f.manifest,endpoints:f.manifest.endpoints.map(e=>({...e,allowedCallers:['changed']}))}),'ENDPOINT_REVISION_REUSED');
 const newer=manifest(undefined,'M2',2);const next=await commit(f.storage,newer);assert.notEqual(next.generationId,original.generationId);assert.equal(next.endpoints.filter(e=>e.lifecycle==='DRAINING').length,4);
 await rejects(commit(f.storage,f.manifest),'MANIFEST_ROLLBACK_FORBIDDEN');
 const bad={...newer,manifestRevision:'M3',endpoints:newer.endpoints.map(e=>({...e,address:e.address+'/changed'}))};await rejects(commit(f.storage,bad),'ENDPOINT_REVISION_REUSED');
 await f.local.close();await f.reopen();const restored=await f.storage.request('getRegistrySnapshot',{});assert.equal(restored.generationId,next.generationId);
 const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{assert.equal(db.prepare('SELECT count(*) n FROM registry_generations').get().n,2);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{db.close();}
});
test('late health only archives and lifecycle remains draining across identical restarts',async t=>{
 const f=await registryFixture(t),e=f.manifest.endpoints[2],old=await f.storage.request('issueEndpointProbe',{endpoint:e}),fresh=await f.storage.request('issueEndpointProbe',{endpoint:e});
 const result=(p,status)=>({checkId:p.checkId,status,observedCardHash:e.cardHash,checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),errorCode:null});
 const before=(await f.storage.request('getRegistrySnapshot',{})).projectionRevision;
 assert.equal((await f.storage.request('recordEndpointCheck',result(fresh,'UNHEALTHY'))).applied,true);
 const stale=await f.storage.request('recordEndpointCheck',result(old,'HEALTHY'));assert.equal(stale.applied,false);assert.equal(stale.projectionRevision,before+1);
 await f.registry.refresh();await rejects(f.registry.resolveRole('developer'),'ENDPOINT_UNAVAILABLE');
 await f.storage.request('setEndpointLifecycle',{actorId:'maintainer',endpointId:e.endpointId,revision:e.revision,lifecycle:'DRAINING',reason:'maintenance'});
 await commit(f.storage,f.manifest);await f.registry.refresh();await rejects(f.registry.resolveRole('developer'),'ENDPOINT_UNAVAILABLE');
});
test('outdated projection and expired or changed card facts close new admission',async t=>{
 const f=await registryFixture(t);await f.storage.request('setEndpointLifecycle',{actorId:'maintainer',endpointId:'builtin.tester',revision:1,lifecycle:'DRAINING',reason:'pause tests'});
 await rejects(f.registry.resolveRole('developer'),'REGISTRY_PROJECTION_STALE');assert.equal(f.registry.ready,false);await f.registry.refresh();
 const e=f.manifest.endpoints[2],probe=await f.storage.request('issueEndpointProbe',{endpoint:e});await f.storage.request('recordEndpointCheck',{checkId:probe.checkId,status:'HEALTHY',observedCardHash:'a'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),errorCode:null});await f.registry.refresh();await rejects(f.registry.resolveRole('developer'),'ENDPOINT_UNAVAILABLE');
});
test('registry import checks CAS and rolls back all newly inserted records',async t=>{
 const f=await registryFixture(t),next=manifest(undefined,'M2',2),probes=await checks(f.storage,next),before=await f.storage.request('getRegistrySnapshot',{});
 await rejects(f.storage.request('commitRegistry',{manifest:next,expectedProjectionRevision:before.projectionRevision-1,checks:probes}),'REGISTRY_VERSION_CHANGED');
 await rejects(f.storage.request('commitRegistry',{manifest:next,expectedProjectionRevision:before.projectionRevision,checks:probes.slice(1)}),'MANIFEST_CHECKS_INCOMPLETE');
 assert.deepEqual(await f.storage.request('getRegistrySnapshot',{}),before);
});
test('health expiration blocks dispatch even when the memory projection has not changed',async t=>{
 const f=await registryFixture(t),e=f.manifest.endpoints[2],probe=await f.storage.request('issueEndpointProbe',{endpoint:e});const time=Date.now();
 await f.storage.request('recordEndpointCheck',{checkId:probe.checkId,status:'HEALTHY',observedCardHash:e.cardHash,checkedAt:new Date(time).toISOString(),expiresAt:new Date(time+50).toISOString(),errorCode:null});await f.registry.refresh();await delay(70);await rejects(f.registry.resolveRole('developer'),'ENDPOINT_UNAVAILABLE');
});
test('dispatch admission freezes checked endpoint and rejects stale caller supplied route',async t=>{
 const f=await registryFixture(t),p=await prepareDispatch(f,f.registry);assert.ok(p.delegation.inputManifestId.startsWith('manifest_'));
 const record=await f.storage.request('acceptA2AWork',p.request);assert.equal(record.state,'submitted');
 await f.storage.request('setEndpointLifecycle',{actorId:'maintainer',endpointId:'builtin.developer',revision:1,lifecycle:'DRAINING',reason:'controlled update'});
 assert.equal((await f.storage.request('acceptA2AWork',p.request)).taskId,record.taskId);
 assert.equal((await f.storage.request('getA2ATask',{callerId:'orchestrator',endpointId:'builtin.developer',taskId:record.taskId})).taskId,record.taskId);
 const newer=manifest(undefined,'M2',2);await commit(f.storage,newer);await f.registry.refresh();assert.equal((await f.registry.resolveRole('developer')).config.revision,2);
});
