import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {pipelineTools,PipelineCoordinator,workflowToolAuthority,serveMcp,McpToolClient,runtimeMcpTools} from '../packages/mcp-tools/dist/index.mjs';
import {RunnerClient,RunnerPolicy,RunnerManager,RunnerMaterials,serveRunner} from '../packages/runner/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {fixture as runnerFixture,image,until} from './fixtures/runner.mjs';

const op=()=> 'op_'+randomUUID().replaceAll('-','');
async function fixture(t){
  const f=await httpFixture(t),names=['pipeline.start','pipeline.get','pipeline.stop','pipeline.by-operation','pipeline.logs','pipeline.artifacts'];
  const p=await prepareDispatch(f,f.registry,{allowedTools:names.map(n=>n.replaceAll('.','_'))});
  await f.storage.request('acceptA2AWork',p.request);await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'pipeline.fixture'});
  const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));let permit;
  try{permit=JSON.parse(db.prepare('SELECT permit_json FROM execution_grants WHERE attempt_id=?').get(p.attemptId).permit_json);}finally{db.close();}
  const r=await runnerFixture(t),relative='workspaces/'+p.attemptId;await mkdir(join(r.layout.dataRoot,relative));
  const policy=new RunnerPolicy({...r.policy.config,commands:{install:['pnpm','install','--offline'],build:['pnpm','build']},workspaces:{workspace_01:{attemptId:p.attemptId,ownerKind:'workflowAttempt',resourceId:'workspace_01',relativePath:relative}}});
  const manager=new RunnerManager(r.layout.store,policy,r.backend,r.authority,new RunnerMaterials(r.layout.dataRoot),{pollIntervalMs:10000});
  const runnerSecret='pipeline-runner-local-test-secret',http=await serveRunner(manager,{identities:[{controllerId:'controller.local',credentialRef:'runner.local'}],credentials:async()=>runnerSecret});r.cleanup.push(()=>http.close());await manager.start();
  const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner.local',async()=>runnerSecret),limits={cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:10000};
  const definition={definitionId:'check-and-build',version:'v1',stages:['install','build'].map((kind,i)=>({stageId:'stage.'+i,kind,imageDigest:image,resourceLimits:limits,networkPolicyRef:'none',outputSpec:[]}))};
  async function service(storage){
    const tools=pipelineTools(storage,runner,[definition]),secret='pipeline-mcp-local-test-secret',authority=workflowToolAuthority(storage,new Map([['pipeline.controller',new Set(names)]]));
    const server=await serveMcp({serviceId:'pipeline.local',version:'1.0.0',identities:[{controllerId:'pipeline.controller',credentialRef:'pipeline.local',allowedTools:names}],credentials:async()=>secret,authority,tools});
    const client=new McpToolClient({endpointId:'pipeline.local',endpoint:server.endpoint,credentialRef:'pipeline.local',credentials:async()=>secret});await client.connect();
    let closed=false;const close=async()=>{if(closed)return;closed=true;await client.close();await server.close();};t.after(close);
    return {client,tools,close,call:(name,args,key=op())=>client.call(name,key,permit,args)};
  }
  const coordinator=new PipelineCoordinator(f.storage,runner),s=await service(f.storage);
  const start=(key=op())=>s.call('pipeline.start',{definitionId:definition.definitionId,workspaceRef:'workspace_01'},key);
  async function exit(jobId,code=0){
    await manager.tick();await until(async()=>(await runner.get(jobId)).state==='RUNNING');
    const fact=r.backend.facts.get(jobId);r.backend.facts.set(jobId,{...fact,state:'exited',pid:0,exitCode:code,finishedAt:new Date().toISOString()});
    await manager.tick();await until(async()=>(await runner.get(jobId)).state==='EXITED');
  }
  return {...f,p,permit,runner,r,coordinator,service,start,exit,definition,...s};
}

test('pipeline MCP freezes independent stages and returns real Runner log/output facts',async t=>{
  const f=await fixture(t),key=op(),created=await f.start(key);assert.equal(created.state,'QUEUED');assert.equal(f.client.snapshot.server.name,'pipeline.local');
  assert.equal((await f.start(key)).pipelineId,created.pipelineId);assert.equal(created.stages.length,2);
  await assert.rejects(f.call('pipeline.start',{definitionId:'production-deploy',workspaceRef:'workspace_01'}));
  await f.coordinator.tick();let p=await f.call('pipeline.get',{pipelineId:created.pipelineId});
  assert.ok(p.stages[0].jobId);assert.equal(p.stages[1].state,'PENDING');assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
  const original=p.stages[0].operationId;await f.exit(p.stages[0].jobId);await f.coordinator.tick();await f.coordinator.tick();
  p=await f.call('pipeline.get',{pipelineId:created.pipelineId});assert.ok(p.stages[1].jobId);assert.notEqual(p.stages[1].operationId,original);assert.equal(p.definitionHash,created.definitionHash);
  await f.exit(p.stages[1].jobId);await f.coordinator.tick();p=await f.call('pipeline.get',{pipelineId:created.pipelineId});assert.equal(p.state,'SUCCEEDED');assert.ok(p.stages.every(s=>s.exitCode===0));
  const log=await f.call('pipeline.logs',{pipelineId:p.pipelineId,ordinal:0,offset:0,limit:65536});assert.equal(Buffer.from(log.data,'base64').toString(),'controlled backend log\n');
  const outputs=await f.call('pipeline.artifacts',{pipelineId:p.pipelineId});assert.equal(outputs.stages.length,2);assert.ok(outputs.stages.every(s=>s.outputs[0].sha256.length===64));
  assert.equal((await f.r.layout.store.request('inspect',{})).jobs,2);
});

test('a failed stage prevents later jobs and explicit stop before dispatch starts no Runner job',async t=>{
  const f=await fixture(t),created=await f.start();await f.coordinator.tick();let p=await f.call('pipeline.get',{pipelineId:created.pipelineId});
  await f.exit(p.stages[0].jobId,1);await f.coordinator.tick();await f.coordinator.tick();p=await f.call('pipeline.get',{pipelineId:created.pipelineId});
  assert.equal(p.state,'FAILED');assert.equal(p.stages[1].state,'SKIPPED');assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
  const second=await f.start();const stopped=await f.call('pipeline.stop',{pipelineId:second.pipelineId});assert.equal(stopped.state,'CANCELLED');
  await f.coordinator.tick();assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
});

test('lost Runner acknowledgement and process restart recover the original stage without a second start',async t=>{
  const f=await fixture(t),created=await f.start(),native=globalThis.fetch;let starts=0;
  globalThis.fetch=async(input,init)=>{const result=await native(input,init);if(String(input instanceof Request?input.url:input).endsWith('/runner/v1/jobs')&&init?.method==='POST'){starts++;assert.ok((await result.json()).jobId);throw Error('lost after Runner commit');}return result;};
  try{await f.coordinator.tick();}finally{globalThis.fetch=native;}
  let p=await f.call('pipeline.get',{pipelineId:created.pipelineId});assert.equal(p.state,'OUTCOME_UNKNOWN');assert.equal(p.stages[0].jobId,null);assert.equal(starts,1);
  const stageOperation=p.stages[0].operationId,job=await f.runner.byOperation(stageOperation);
  await f.close();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),coordinator=new PipelineCoordinator(reopened.storage,f.runner),s=await f.service(reopened.storage);
  await coordinator.tick();p=await s.call('pipeline.get',{pipelineId:created.pipelineId});assert.equal(p.stages[0].jobId,job.jobId);assert.equal(p.stages[0].operationId,stageOperation);assert.equal(p.stages[1].state,'PENDING');
  assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
});

test('an unresolved original send keeps later stages blocked and is never replayed',async t=>{
  const f=await fixture(t),created=await f.start();
  await f.storage.request('markPipelineStageSent',{pipelineId:created.pipelineId,ordinal:0});
  await f.coordinator.tick();await f.coordinator.tick();let p=await f.call('pipeline.get',{pipelineId:created.pipelineId});
  assert.equal(p.state,'OUTCOME_UNKNOWN');assert.equal(p.stages[1].state,'PENDING');assert.equal((await f.r.layout.store.request('inspect',{})).jobs,0);
  p=await f.call('pipeline.stop',{pipelineId:created.pipelineId});assert.equal(p.state,'OUTCOME_UNKNOWN');assert.equal(p.stages[1].state,'SKIPPED');
  await f.coordinator.tick();assert.equal((await f.r.layout.store.request('inspect',{})).jobs,0);
});

test('lost MCP creation response is repaired through the original pipeline operation',async t=>{
  const f=await fixture(t),start=runtimeMcpTools(f.client,f.tools.filter(t=>t.name==='pipeline.start'))[0],key=op(),native=globalThis.fetch;let sends=0;
  globalThis.fetch=async(input,init)=>{
    const result=await native(input,init),body=typeof init?.body==='string'?JSON.parse(init.body):null;
    if(body?.params?.name==='pipeline.start'){sends++;assert.ok((await result.json()).result);throw Error('MCP reply lost after durable pipeline creation');}
    return result;
  };
  try{assert.equal((await start.execute(key,{definitionId:f.definition.definitionId,workspaceRef:'workspace_01'},{permit:f.permit},new AbortController().signal)).state,'OUTCOME_UNKNOWN');}finally{globalThis.fetch=native;}
  assert.equal(sends,1);const recovered=await start.query(key,{permit:f.permit});assert.equal(recovered.state,'SUCCEEDED');
  assert.equal(recovered.value.result.operationId,key);assert.equal(recovered.value.result.state,'QUEUED');
  assert.equal((await f.r.layout.store.request('inspect',{})).jobs,0);
});
