import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {ExecutionGrantLease} from '../packages/agent-runtime/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {meta} from './fixtures/storage-data.mjs';

test('a current host renews bounded leases while stale claims, expanded scopes, pause and expiry remain denied',{timeout:90000},async t=>{
  const cleanup=[];t.after(async()=>{for(const fn of cleanup.toReversed())await fn();});const f=await httpFixture({after:fn=>cleanup.push(fn)});
  const p=await prepareDispatch(f,f.registry,{allowedTools:['repo_commit']});await f.storage.request('acceptA2AWork',p.request);
  const [{endpointId,taskId,workerId,claimToken}]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'lease.fixture'}),claim={endpointId,taskId,workerId,claimToken};
  const host=await f.storage.request('getExecutionHost',claim),original=structuredClone(host.permit);let current;
  const lease=new ExecutionGrantLease(f.storage,claim,value=>{current=value;});await lease.start();cleanup.push(()=>lease.stop());
  await assert.rejects(f.storage.request('renewExecutionHost',{...claim,claimToken:'stale.claim'}),{code:'EXECUTION_HOST_CLAIM_CHANGED'});
   const admitted=structuredClone(current);await f.storage.request('renewExecutionHost',claim);
   await f.storage.request('authorizeMcpAction',{permit:admitted,toolName:'repo.commit',action:'write'});
   await delay(16050);assert.equal(lease.signal.aborted,false);assert.ok(Date.parse(original.expiresAt)<Date.now());assert.ok(Date.parse(current.expiresAt)>Date.now());assert.ok(Date.parse(current.expiresAt)<=Date.now()+15000);assert.equal(current.notBefore,original.notBefore);
  const refreshed=await f.storage.request('refreshMcpPermit',{permit:original,toolName:'repo.commit',action:'write'});assert.equal(refreshed.grantId,original.grantId);assert.equal(refreshed.runEpoch,original.runEpoch);assert.deepEqual(refreshed.resources,original.resources);
  await assert.rejects(f.storage.request('refreshMcpPermit',{permit:{...original,resources:[...original.resources,{kind:'workspace',resourceId:'outside',access:'write'}]},toolName:'repo.commit',action:'write'}));
  const run=await f.storage.request('getRun',{runId:p.runId});await f.storage.request('setControlIntent',{meta:meta(p.runId),runId:p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  await assert.rejects(f.storage.request('renewExecutionHost',claim),{code:'EXECUTION_PERMIT_INVALID'});await assert.rejects(f.storage.request('refreshMcpPermit',{permit:original,toolName:'repo.commit',action:'write'}));await lease.stop();
});

test('an expired persisted grant cannot be revived by its original valid worker claim',async t=>{
  const f=await httpFixture(t),p=await prepareDispatch(f,f.registry);await f.storage.request('acceptA2AWork',p.request);
  const [{endpointId,taskId,workerId,claimToken}]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'expired.fixture'}),claim={endpointId,taskId,workerId,claimToken};
  // Fault-inject an already expired durable grant, without altering the real TTL rule.
  const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));const time=new Date(Date.now()-1000).toISOString();try{db.prepare("UPDATE execution_grants SET expires_at=?,permit_json=json_set(permit_json,'$.notBefore',?,'$.expiresAt',?) WHERE attempt_id=?").run(time,new Date(Date.now()-16000).toISOString(),time,p.attemptId);}finally{db.close();}
  await assert.rejects(f.storage.request('renewExecutionHost',claim),{code:'EXECUTION_PERMIT_INVALID'});
});
