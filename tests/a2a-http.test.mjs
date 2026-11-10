import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { TaskState,Task,ListTasksRequest } from '../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/index.js';
import { httpFixture,prepareDispatch,SendMessageRequest,Message,serviceToken } from './fixtures/a2a-data.mjs';

test('official 1.0 HTTP client reads authenticated cards and one durable task for concurrent repeated sends',async t=>{
 const f=await httpFixture(t),p=await prepareDispatch(f,f.registry);
 const replies=await Promise.all(Array.from({length:5},()=>f.client.sendMessage(p.params)));const ids=replies.map(r=>r.id);assert.equal(new Set(ids).size,1);
 const task=await f.client.getTask({id:ids[0]});assert.equal(task.status.state,TaskState.TASK_STATE_SUBMITTED);
 const list=await f.client.listTasks(ListTasksRequest.fromJSON({pageSize:1,historyLength:0}));assert.equal(list.totalSize,1);assert.equal(list.tasks[0].history.length,0);assert.equal(list.nextPageToken,'');
 const info=await f.storage.request('inspect',{});assert.equal(info.counts.a2a_tasks,1);assert.equal(info.counts.delegation_inbox,1);assert.equal(info.counts.accepted_work,1);
 const changed=SendMessageRequest.fromJSON({...SendMessageRequest.toJSON(p.params),message:{...Message.toJSON(p.message),messageId:randomUUID()}});await assert.rejects(f.client.sendMessage(changed),/IDEMPOTENCY_KEY_REUSED/);
 assert.equal((await fetch(f.base+'/internal/agents/developer/agent-card.json')).status,401);
 const other=await fetch(f.base+'/internal/agents/developer/a2a',{method:'POST',headers:{'Content-Type':'application/json','A2A-Version':'1.0',Authorization:'Bearer devmesh-other-service-test-token'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'GetTask',params:{id:ids[0]}})});assert.ok((await other.json()).error);
});
test('official SSE sends durable snapshot, observes cancellation and releases on disconnect',async t=>{
 const f=await httpFixture(t),p=await prepareDispatch(f,f.registry),stream=f.client.sendMessageStream(p.params);
 const first=await stream.next();assert.equal(first.value.payload.value.status.state,TaskState.TASK_STATE_SUBMITTED);const id=first.value.payload.value.id;
 const canceled=await f.client.cancelTask({id});assert.equal(canceled.status.state,TaskState.TASK_STATE_CANCELED);
 const last=await stream.next();assert.equal(last.value.payload.value.id,id);assert.equal(last.value.payload.value.status.state,TaskState.TASK_STATE_CANCELED);assert.equal((await stream.next()).done,true);
 const resub=f.client.resubscribeTask({id});assert.equal((await resub.next()).value.payload.value.status.state,TaskState.TASK_STATE_CANCELED);assert.equal((await resub.next()).done,true);
});
test('active cancellation records intent until stop is verified and consumer token is current',async t=>{
 const f=await httpFixture(t),p=await prepareDispatch(f,f.registry),reply=await f.client.sendMessage(p.params),id=reply.id;
 const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'runtime'});assert.equal(claim.taskId,id);
 const intent=await f.client.cancelTask({id});assert.equal(intent.status.state,TaskState.TASK_STATE_WORKING);assert.equal(intent.metadata.cancelRequested,true);
 const snapshot={...Task.toJSON(reply),id,status:{state:'TASK_STATE_CANCELED',timestamp:new Date().toISOString()}};
 await assert.rejects(f.storage.request('settleAcceptedWork',{...claim,state:'canceled',snapshot}),e=>e.code==='SCHEMA_INVALID');
 const {delegation:_delegation,...key}=claim;
 await assert.rejects(f.storage.request('settleAcceptedWork',{...key,state:'canceled',snapshot}),e=>e.code==='STOP_NOT_VERIFIED');
 await f.storage.request('settleAcceptedWork',{...key,state:'canceled',snapshot,stopVerified:true});assert.equal((await f.client.getTask({id})).status.state,TaskState.TASK_STATE_CANCELED);
});
test('invalid service, forged authority and unsupported private protocol cannot create work',async t=>{
 const f=await httpFixture(t),p=await prepareDispatch(f,f.registry),wire=SendMessageRequest.toJSON(p.params);wire.message.parts[0].data.runEpoch+=1;
 await assert.rejects(f.client.sendMessage(SendMessageRequest.fromJSON(wire)),/EXECUTION_PERMIT_INVALID/);
 const r=await fetch(f.base+'/internal/agents/developer/a2a',{method:'POST',headers:{'Content-Type':'application/json','A2A-Version':'1.0',Authorization:'Bearer '+serviceToken},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'PrivateExecute',params:{}})});assert.equal((await r.json()).error.code,-32601);
 assert.equal((await f.storage.request('inspect',{})).counts.a2a_tasks,0);
});
test('real fifteen-second grant issuance and expired authority cannot create accepted work',async t=>{
 const f=await httpFixture(t),p=await prepareDispatch(f,f.registry),db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));
 try{const grant=db.prepare('SELECT * FROM execution_grants WHERE attempt_id=?').get(p.attemptId),permit=JSON.parse(grant.permit_json);
 assert.equal(Date.parse(permit.expiresAt)-Date.parse(permit.notBefore),15000);
 permit.notBefore=new Date(Date.now()-2000).toISOString();permit.expiresAt=new Date(Date.now()-1000).toISOString();
 db.prepare('UPDATE execution_grants SET expires_at=?,permit_json=? WHERE grant_id=?').run(permit.expiresAt,JSON.stringify(permit),grant.grant_id);
 await assert.rejects(f.client.sendMessage(p.params),/EXECUTION_PERMIT_INVALID/);
 assert.equal((await f.storage.request('inspect',{})).counts.accepted_work,0);
 }finally{db.close();}
});
