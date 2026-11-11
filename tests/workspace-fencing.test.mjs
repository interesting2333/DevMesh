import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {RunnerClient,RunnerManager,RunnerMaterials,serveRunner,openRunnerStorage} from '../packages/runner/dist/index.mjs';
import {LocalRunnerWorkspaceFencer} from '../packages/code-workspaces/dist/index.mjs';
import {fixture as runnerFixture,request,until} from './fixtures/runner.mjs';

const op=()=> 'op_'+randomUUID().replaceAll('-','');
async function fixture(t,index=1){
  const f=await runnerFixture(t,{manager:{pollIntervalMs:600000}}),base=request(index,{timeoutMs:60000}),key='runner-fencing-fixture-service-secret';
  const heartbeat=()=>{base.permit.expiresAt=new Date(Date.now()+15000).toISOString();f.current.set(base.permit.grantId,structuredClone(base.permit));};heartbeat();const timer=setInterval(heartbeat,5000);timer.unref();f.cleanup.push(async()=>clearInterval(timer));
  f.authority.verifyWorkspace=(controllerId,permit,workspaceRef)=>f.authority.verify(controllerId,{workspaceRef,permit},permit);
  const options={identities:[{controllerId:'controller.local',credentialRef:'fixture.local'},{controllerId:'controller.other',credentialRef:'fixture.other'}],credentials:async ref=>ref==='fixture.other'?key+'-other':key};
  const serve=async manager=>{const http=await serveRunner(manager,options);return {http,client:new RunnerClient('http://127.0.0.1:'+http.address.port,'fixture.local',options.credentials)};};
  await f.manager.start();const {http,client}=await serve(f.manager);f.cleanup.push(()=>http.close());
  const startRequest=()=>({...base,operationId:op(),permit:{...base.permit,notBefore:new Date(Math.max(Date.parse(base.permit.notBefore),Date.parse(base.permit.expiresAt)-15000)).toISOString()}});
  const fenceRequest=()=>({operationId:op(),parentOperationId:op(),workspaceRef:base.workspaceRef,permit:structuredClone(base.permit),holderToken:randomUUID()});
  return {...f,base,client,http,serve,startRequest,fenceRequest};
}

test('a durable Runner fence blocks job admission, protects holder identity and survives a real store reopen',async t=>{
  const f=await fixture(t),request=f.fenceRequest(),first=await f.client.acquireWorkspaceFence(request);assert.equal(first.state,'ACTIVE');assert.equal((await f.client.acquireWorkspaceFence(request)).fenceId,first.fenceId);
  await assert.rejects(f.client.start(f.startRequest()),{status:423});assert.equal((await f.layout.store.request('inspect',{})).jobs,0);
  await assert.rejects(f.client.releaseWorkspaceFence(first.fenceId,{holderToken:randomUUID(),requestHash:first.requestHash}),{status:403});assert.equal((await f.client.getWorkspaceFence(first.fenceId)).state,'ACTIVE');
  const other=new RunnerClient('http://127.0.0.1:'+f.http.address.port,'fixture.other',async()=> 'runner-fencing-fixture-service-secret-other');await assert.rejects(other.getWorkspaceFence(first.fenceId),{status:404});
  await f.http.close();await f.layout.close();const layout=await openRunnerStorage({dataRoot:f.layout.dataRoot,controlDataRoot:join(f.root,'control'),backupRoot:join(f.root,'backup'),runnerId:'runner.test'}),manager=new RunnerManager(layout.store,f.policy,f.backend,f.authority,new RunnerMaterials(layout.dataRoot),{pollIntervalMs:600000});await manager.start();const reopened=await f.serve(manager);f.cleanup.push(async()=>{await reopened.http.close();await layout.close();});
  assert.equal((await reopened.client.workspaceFenceByOperation(request.operationId)).fenceId,first.fenceId);await assert.rejects(reopened.client.start(f.startRequest()),{status:423});
  const release={holderToken:first.holderToken,requestHash:first.requestHash};assert.equal((await reopened.client.releaseWorkspaceFence(first.fenceId,release)).state,'RELEASED');
  const next=await reopened.client.acquireWorkspaceFence(f.fenceRequest());await reopened.client.releaseWorkspaceFence(first.fenceId,release);assert.equal((await reopened.client.getWorkspaceFence(next.fenceId)).state,'ACTIVE');
  await reopened.client.releaseWorkspaceFence(next.fenceId,{holderToken:next.holderToken,requestHash:next.requestHash});assert.equal((await reopened.client.start(f.startRequest())).state,'QUEUED');assert.equal((await layout.store.request('inspect',{})).jobs,1);
});

test('queued and unknown original Runner jobs keep their workspace unavailable for Git fencing',async t=>{
  const f=await fixture(t),queued=await f.client.start(f.startRequest());await assert.rejects(f.client.acquireWorkspaceFence(f.fenceRequest()),{status:409});
  const cancelled=await f.client.stop(queued.jobId);assert.equal(cancelled.state,'EXITED');assert.equal(cancelled.stopEvidence.neverDispatched,true);
  const fence=await f.client.acquireWorkspaceFence(f.fenceRequest());await f.client.releaseWorkspaceFence(fence.fenceId,{holderToken:fence.holderToken,requestHash:fence.requestHash});
  const active=await f.client.start(f.startRequest());await f.manager.tick();await until(async()=>(await f.client.get(active.jobId)).state==='RUNNING');f.backend.unknownStop=true;await f.client.stop(active.jobId);await f.manager.tick();
  await assert.rejects(f.client.acquireWorkspaceFence(f.fenceRequest()),{status:409});assert.notEqual((await f.client.get(active.jobId)).state,'EXITED');assert.equal(f.backend.starts.length,1);
  f.revoked.add(f.base.permit.activationId);await assert.rejects(f.client.acquireWorkspaceFence(f.fenceRequest()),{status:403});assert.equal((await f.layout.store.request('inspect',{})).jobs,2);
});

test('local filesystem and Runner fences recover lost replies without resending writes and bind an independent repo path',async t=>{
  const f=await fixture(t,7);await mkdir(join(f.root,'control'),{recursive:true});
  const options={mode:'local-development',runner:f.client,controlDataRoot:join(f.root,'control'),runnerDataRoot:f.layout.dataRoot,backupRoot:join(f.root,'backup')},fencer=new LocalRunnerWorkspaceFencer(options),input={kind:'workspace',directoryRoot:f.layout.dataRoot,resourceId:f.base.workspaceRef,operationId:op(),permit:f.base.permit},signal=new AbortController().signal,native=globalThis.fetch;let starts=0,releases=0,original;
  globalThis.fetch=async(value,init)=>{const result=await native(value,init),url=String(value instanceof Request?value.url:value);if(init?.method==='POST'&&url.endsWith('/workspace-fences')){starts++;original=await result.json();throw Error('fence reply lost after commit');}return result;};
  let lease;try{lease=await fencer.acquire(input,signal);}finally{globalThis.fetch=native;}
  assert.equal(starts,1);assert.equal((await f.client.activeWorkspaceFence(input.resourceId)).fenceId,original.fenceId);await assert.rejects(new LocalRunnerWorkspaceFencer(options).acquire(input,signal),{code:'STORAGE_LOCKED'});
  const binding=await f.layout.store.request('workspaceBinding',{workspaceRef:input.resourceId});assert.equal(binding.relativePath,'workspaces/'+f.base.permit.attemptId+'/repo');await mkdir(join(f.layout.dataRoot,binding.relativePath),{recursive:true});await assert.rejects(f.client.start(f.startRequest()),{status:423});
  globalThis.fetch=async(value,init)=>{const result=await native(value,init);if(init?.method==='POST'&&String(value instanceof Request?value.url:value).endsWith(':release')){releases++;assert.equal((await result.json()).state,'RELEASED');throw Error('release reply lost after commit');}return result;};
  try{await lease.release();}finally{globalThis.fetch=native;}assert.equal(releases,1);assert.equal((await f.client.getWorkspaceFence(original.fenceId)).state,'RELEASED');
  const next=await new LocalRunnerWorkspaceFencer(options).acquire(input,signal);await lease.release();assert.notEqual((await f.client.activeWorkspaceFence(input.resourceId)).fenceId,original.fenceId);await next.release();assert.equal((await f.client.start(f.startRequest())).state,'QUEUED');
});
