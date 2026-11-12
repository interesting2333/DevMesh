import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { registryFixture,prepareDispatch,holdTestGrant } from './fixtures/a2a-data.mjs';

test('failed receipt transaction leaves no Task, Inbox or accepted work',async t=>{
 const f=await registryFixture(t),p=await prepareDispatch(f,f.registry),path=join(f.local.dataRoot,'db/devmesh.sqlite'),db=new DatabaseSync(path);
 try{db.exec("CREATE TRIGGER test_reject_receipt BEFORE INSERT ON accepted_work BEGIN SELECT RAISE(ABORT,'injected-receipt-cut'); END;");
 await assert.rejects(f.storage.request('acceptA2AWork',p.request));const info=await f.storage.request('inspect',{});assert.equal(info.counts.a2a_tasks,0);assert.equal(info.counts.delegation_inbox,0);assert.equal(info.counts.accepted_work,0);
 db.exec('DROP TRIGGER test_reject_receipt');const receipt=await f.storage.request('acceptA2AWork',p.request);assert.equal(receipt.state,'submitted');}finally{db.close();}
});
test('lost receipt acknowledgement and process restart return original task without new acceptance',async t=>{
 const f=await registryFixture(t),p=await prepareDispatch(f,f.registry);holdTestGrant(f,p.attemptId);const original=await f.storage.request('acceptA2AWork',p.request);
 await f.local.close();await f.reopen();const recovered=await f.storage.request('acceptA2AWork',p.request);assert.equal(recovered.taskId,original.taskId);assert.equal(recovered.revision,1);
 const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'runtime.original'});assert.equal(claim.taskId,original.taskId);
 await f.local.close();await f.reopen();assert.equal((await f.storage.request('recoverAcceptedWork',{})).reconcileCount,1);
 assert.deepEqual(await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'runtime.restart'}),[]);
 assert.equal((await f.storage.request('getA2ATask',{callerId:'orchestrator',endpointId:'builtin.developer',taskId:original.taskId})).state,'working');
 const info=await f.storage.request('inspect',{});assert.equal(info.counts.a2a_tasks,1);assert.equal(info.counts.accepted_work,1);
});
test('failed memory refresh closes admission and rebuilds from committed generation',async t=>{
 const f=await registryFixture(t),before=f.registry.version;const request=f.registry.storage.request.bind(f.registry.storage);
 f.registry.storage.request=(method,payload)=>method==='getRegistrySnapshot'?Promise.reject(new Error('injected projection failure')):request(method,payload);
 await assert.rejects(f.registry.refresh(),/projection failure/);assert.equal(f.registry.ready,false);assert.throws(()=>f.registry.version,/projection is unavailable/);
 f.registry.storage.request=request;await f.registry.refresh();assert.deepEqual(f.registry.version,before);
});
