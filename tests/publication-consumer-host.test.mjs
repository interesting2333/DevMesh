import test from 'node:test';import assert from 'node:assert/strict';
import {openLocalStorage} from '../packages/blob-store/dist/index.mjs';
import {startPlatform} from '../packages/platform-core/dist/index.mjs';
import {publicationHostFixture} from './fixtures/publication-host.mjs';
import {publicationScope,explicitPublicationBackend,barrier} from './fixtures/publication-consumer.mjs';

test('host defaults publication off; invalid bindings or a later startup failure release resources without starting publication',{timeout:240000},async t=>{
 const h=await publicationHostFixture(t),{f}=h,backend=explicitPublicationBackend(),server=await h.start();assert.equal(server.releasePublication,undefined);assert.equal(server.inputApi,undefined);assert.equal((await server.services.local.storage.request('getReleasePublication',f.subject)).state,'PENDING');await server.stop();let factories=0;
 await assert.rejects(startPlatform({...h.config,storage:undefined},{releasePublication:()=>{factories++;return {bindings:[publicationScope(f,backend)]};}}),/requires durable storage/);assert.equal(factories,0);
 for(const patch of [{principalId:'user_1'},{runnerId:'runner.other'},{policyHash:'f'.repeat(64)}]){await assert.rejects(h.start({releasePublication:()=>({bindings:[{...publicationScope(f,backend),...patch}]})}));const local=await openLocalStorage(h.options);await local.close();}
 await assert.rejects(h.start({releasePublication:()=>({bindings:[publicationScope(f,backend)]}),mcp:()=>{throw Error('Explicit later startup failure');}}),/later startup failure/);const reopened=await openLocalStorage(h.options);await reopened.close();assert.deepEqual(backend.counts,{preflight:0,publish:0,inspect:0,resume:0});
});

test('explicit publication runs without new acceptance entry; stop drains and restart continues the original journal instead of publish',{timeout:240000},async t=>{
 const entered=barrier(),release=barrier();t.after(()=>release.resolve());const h=await publicationHostFixture(t),{f}=h,backend=explicitPublicationBackend({resume:true,complete:false});let finalAllowed;
 backend.publish=async(_p,authorize)=>{backend.counts.publish++;entered.resolve();await release.promise;finalAllowed=await authorize();return {state:'UNKNOWN',errorCode:'FIXTURE_STOPPED_ORIGINAL_ROUTE',checkedAt:new Date().toISOString()};};
 const server=await h.start({releasePublication:()=>({bindings:[publicationScope(f,backend)],pollIntervalMs:1000})});await entered.promise;assert.equal(server.inputApi,undefined);assert.equal(server.acceptancePreparation,undefined);assert.equal((await fetch('http://127.0.0.1:'+server.address.port+'/readyz')).status,200);
 const stopping=server.stop();assert.equal(server.stop(),stopping);let drained=false;void stopping.then(()=>{drained=true;});await Promise.resolve();assert.equal(drained,false);assert.ok(await server.services.local.storage.request('getReleasePublication',f.subject));release.resolve();await stopping;assert.equal(finalAllowed,false);await assert.rejects(server.services.local.storage.request('getReleasePublication',f.subject));
 const local=await openLocalStorage(h.options);try{const p=await local.storage.request('getReleasePublication',f.subject);assert.equal(p.state,'UNKNOWN');assert.equal(p.errorCode,'FIXTURE_STOPPED_ORIGINAL_ROUTE');assert.equal((await local.storage.request('getRun',{runId:p.runId})).terminalOutcome,'COMPLETED');}finally{await local.close();}
 const recovered=explicitPublicationBackend({resume:true}),next=await h.start({releasePublication:()=>({bindings:[publicationScope(f,recovered)]})});await next.releasePublication.tick();assert.equal((await next.services.local.storage.request('getReleasePublication',f.subject)).state,'PUBLISHED');await next.stop();assert.equal(recovered.counts.publish,0);assert.equal(recovered.counts.inspect,1);assert.equal(recovered.counts.resume,1);
});
