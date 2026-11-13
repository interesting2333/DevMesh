import test from 'node:test';import assert from 'node:assert/strict';import {setTimeout as delay} from 'node:timers/promises';
import {startPlatform} from '../packages/platform-core/dist/index.mjs';
import {openLocalStorage} from '../packages/blob-store/dist/index.mjs';
import {previewHostFixture} from './fixtures/preview-host.mjs';
import {previewScope,barrier} from './fixtures/preview-consumer.mjs';
import {ControlledPreviewBackend} from './fixtures/preview-lifecycle.mjs';
test('host defaults preview lifecycle off; invalid scopes and later startup failure perform no backend work and release storage',{timeout:240000},async t=>{
 const h=await previewHostFixture(t),{f}=h,server=await h.start();assert.equal(server.previewLifecycle,undefined);assert.equal(server.inputApi,undefined);assert.equal((await server.services.local.storage.request('getPreviewEffect',{principalId:f.principalId,operationId:f.preview.operationId})).state,'PREPARED');await server.stop();
 let factories=0;await assert.rejects(startPlatform({...h.config,storage:undefined},{previewLifecycle:()=>{factories++;return {bindings:[previewScope(f)]};}}),/Preview lifecycle requires/);assert.equal(factories,0);
 for(const patch of [{principalId:'user_1'},{runnerId:'runner.foreign'},{backendRef:'backend.foreign'},{policyHash:'f'.repeat(64)}]){await assert.rejects(h.start({previewLifecycle:()=>({bindings:[{...previewScope(f),...patch}]})}));const local=await openLocalStorage(h.options);await local.close();}
 await assert.rejects(h.start({previewLifecycle:()=>({bindings:[previewScope(f)]}),mcp:()=>{throw Error('explicit later startup failure');}}),/later startup failure/);const local=await openLocalStorage(h.options);await local.close();assert.deepEqual(f.backend.starts,[]);assert.deepEqual(f.backend.queries,[]);
});
test('host stops new preview authorization immediately, drains execution before closing storage and restarts with original inspection',{timeout:240000},async t=>{
 const h=await previewHostFixture(t),{f}=h,entered=barrier(),release=barrier();let allowed;
 f.backend.execute=async(_e,_d,authorize)=>{entered.resolve();await release.promise;allowed=await authorize();throw Error('explicit original execution drained');};
 const server=await h.start({previewLifecycle:()=>({bindings:[previewScope(f)],pollIntervalMs:1000})});let stopping,drained=false;
 try{await entered.promise;assert.ok(server.previewLifecycle);assert.equal(server.inputApi,undefined);assert.equal((await fetch('http://127.0.0.1:'+server.address.port+'/readyz')).status,200);stopping=server.stop();assert.equal(server.stop(),stopping);void stopping.then(()=>{drained=true;});await delay(20);assert.equal(drained,false);assert.ok(await server.services.local.storage.request('getRun',{runId:f.p.runId}));}finally{release.resolve();await (stopping??server.stop());}
 assert.equal(allowed,false);await assert.rejects(server.services.local.storage.request('getRun',{runId:f.p.runId}));
 const backend=new ControlledPreviewBackend(),next=await h.start({previewLifecycle:()=>({bindings:[previewScope(f,backend)]})});await next.previewLifecycle.tick();await next.stop();assert.deepEqual(backend.starts,[]);assert.equal(backend.queries.length,1);
 const local=await openLocalStorage(h.options);try{assert.equal((await local.storage.request('getPreviewEffect',{principalId:f.principalId,operationId:f.preview.operationId})).state,'UNKNOWN');assert.equal((await local.storage.request('getRun',{runId:f.p.runId})).terminalOutcome,null);}finally{await local.close();}
});
