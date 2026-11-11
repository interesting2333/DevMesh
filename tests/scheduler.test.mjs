import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {inspectPlan,planDraft,planReviewView} from '../packages/contracts/dist/index.js';
import {WorkflowScheduler} from '../packages/platform-core/dist/scheduler.mjs';
import {mountInputApi} from '../packages/input-api/dist/index.mjs';
import {scheduledWorkClient} from '../packages/a2a-adapter/dist/index.mjs';
import {callerId,credential,httpFixture,serviceToken} from './fixtures/a2a-data.mjs';
import {meta,plan,requirements} from './fixtures/storage-data.mjs';

const timeout={timeout:120000},baseCommit='a'.repeat(40);
function draft({valid=true}={}){
  const graph=plan(['developer','tester']),[dev,tester]=graph.works;
  dev.inputRefs=[];
  Object.assign(tester,{inputRefs:[{kind:'output',workId:dev.workId,outputSlot:dev.outputSpec[0].slot}],
    dependencies:[{workId:dev.workId,requiredOutcome:'success'}],outputSpec:[{slot:'verification.report',schemaId:'devmesh.test-result.v1'}],
    completionChecks:valid?[{kind:'required-tests-pass',checkId:'check_required'}]:[{kind:'artifact-exists',outputSlot:'verification.report'}]});
  return graph;
}
async function fixture(t){
  const f=await httpFixture(t),signal=AbortSignal.timeout(90000);
  f.app.disable('etag');
  const api=mountInputApi(f.app,f.content,{enabled:true,baseline:{version:'fixture.v1',baseCommit},identityResolver:r=>{
    const id=r.headers.authorization?.split(' ')[1];return ['user_1','user_2'].includes(id)?{principalId:id}:null;
  }});
  t.after(()=>api.stop());
  const call=async(path,body,headers={})=>{
    const r=await fetch(f.base+'/api/v1'+path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),
      headers:{authorization:'Bearer user_1','content-type':'application/json','idempotency-key':randomUUID(),...headers},signal});
    return {status:r.status,body:await r.json(),etag:r.headers.get('etag')};
  };
  const create=async(graph=draft(),name='调度项目')=>{
    const r=await call('/projects',{name,initialRequest:{text:'验收来源',attachmentIds:[]},clientDraftId:randomUUID()});
    assert.equal(r.status,201,JSON.stringify(r.body));
    const p=r.body.result,stored=await f.content.putJson(meta(p.runId),{kind:'content'},graph);
    const published=await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,
      requirements:requirements(),plan:graph,planContentHash:stored.expectedHash});
    return {...p,graph,reviewHash:published.result.reviewHash,revision:published.result.revision};
  };
  const getPlan=(p,suffix='',headers)=>call('/runs/'+p.runId+'/plans'+suffix,undefined,headers);
  const confirm=(p,etag='"r2"',headers={},hash=p.reviewHash)=>call('/runs/'+p.runId+'/plans/1:confirm',{requirementRevision:1,reviewHash:hash},{'if-match':etag,...headers});
  const sql=(query,...args)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
  const allocate=(prompts,overrides={})=>async c=>({runnerId:'runner.fixture',runnerCapacity:4,runnerLimits:{cpu:4,memoryMiB:4096,timeoutMs:600000},reservationKey:randomUUID(),maximumAttempts:5,maximumReservedMs:3000000,
    templateVersion:'fixture.v1',checkConfigHash:'b'.repeat(64),roleSnapshot:{role:c.work.role,revision:'fixture.v1',provider:'offline',model:'offline',
      promptArtifactId:prompts.get(c.runId),outputSchemaId:c.work.role==='developer'?'devmesh.development-result.v1':'devmesh.test-result.v1',
      allowedTools:[],maxSteps:2,contextLimitTokens:16000,outputReserveTokens:1000,requestTimeoutMs:30000,maxReadOnlyRetries:0},
    resources:[{kind:'snapshot',resourceId:'snap.'+c.runId,access:'read'}],...(typeof overrides==='function'?overrides(c):overrides)});
  const scheduler=(ps,overrides)=>new WorkflowScheduler(f.storage,f.registry,credential,{callerId,planResources:allocate(new Map(ps.map(p=>[p.runId,p.artifactId])),overrides)});
  return {...f,signal,call,create,getPlan,confirm,sql,scheduler};
}

test('graph validation locates a cycle, missing output and unsequenced write scopes',()=>{
  const graph=draft(),[a,b]=graph.works;
  a.dependencies=[{workId:b.workId,requiredOutcome:'success'}];b.inputRefs[0].outputSlot='missing';
  const facts={requirementIds:new Set(a.requirementIds),requireDelivery:true,hasArtifact:()=>false};
  const broken=inspectPlan(planDraft.parse(graph),facts);
  assert.ok(broken.issues.some(i=>i.code==='DAG_CYCLE'&&i.workId===a.workId));
  assert.ok(broken.issues.some(i=>i.code==='WORK_INPUT_UNRESOLVED'&&i.relatedWorkId===a.workId));
  assert.deepEqual(broken.topology,[]);
  a.dependencies=[];b.dependencies=[];b.inputRefs=[];b.role='developer';b.writeScope=['SRC'];
  assert.ok(inspectPlan(planDraft.parse(graph),facts).issues.some(i=>i.code==='WRITE_SCOPE_OVERLAP'));
  const good=inspectPlan(planDraft.parse(draft()),facts);
  assert.deepEqual(good.issues,[]);assert.deepEqual(good.topology.map(r=>r.layer),[0,1]);
});

test('plan HTTP reports missing tests and accepts only an exact authorized current review',timeout,async t=>{
  const f=await fixture(t),bad=await f.create(draft({valid:false})),p=await f.create();
  const badReview=planReviewView.parse((await f.getPlan(bad)).body);assert.equal(badReview.canConfirm,false);assert.equal(badReview.issues[0].code,'REQUIRED_TEST_MISSING');
  const invalid=await f.confirm(bad);assert.equal(invalid.status,422,JSON.stringify(invalid.body));assert.equal(invalid.body.error.details.issues[0].code,'REQUIRED_TEST_MISSING');
  assert.equal((await f.getPlan(p,'',{authorization:'Bearer user_2'})).status,404);
  const view=await f.getPlan(p);assert.equal(view.status,200);assert.equal(view.body.canConfirm,true);
  assert.equal((await f.confirm(p,view.etag,{},'c'.repeat(64))).body.error.code,'PLAN_SUPERSEDED');
  assert.deepEqual(await f.storage.request('nextScheduledWork',{}),[]);
  const key=randomUUID(),answer=await f.confirm(p,view.etag,{'idempotency-key':key});
  assert.equal(answer.status,202,JSON.stringify(answer.body));
  assert.equal((await f.confirm(p,view.etag,{'idempotency-key':key})).body.operationId,answer.body.operationId);
  assert.equal((await f.call('/operations/'+answer.body.operationId)).body.status,'SUCCEEDED');
  assert.equal((await f.getPlan(p)).body.confirmation.operationId,answer.body.operationId);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,0);
});

test('scheduler rotates between confirmed projects and needs verified predecessor output',timeout,async t=>{
  const f=await fixture(t),a=await f.create(draft(),'A'),b=await f.create(draft(),'B');
  assert.equal((await f.confirm(a)).status,202);assert.equal((await f.confirm(b)).status,202);
  const s=f.scheduler([a,b]),first=await s.tick(f.signal);
  assert.ok(first,JSON.stringify({error:s.lastError}));assert.equal(first.result.runId,a.runId);
  const aAttempt=first.result.attemptIds[0],dispatch=(await f.storage.request('listScheduledDispatches',{}))[0];
  const premature=await scheduledWorkClient(dispatch.endpoint,serviceToken,f.signal);
  await assert.rejects(premature(dispatch.delegation));
  const native=globalThis.fetch;let lost=0,sent;
  globalThis.fetch=async(input,init)=>{
    const r=await native(input,init);
    if(String(input instanceof Request?input.url:input).endsWith('/internal/agents/developer/a2a')&&init?.method==='POST'){
      assert.ok((await r.json()).result);lost++;throw new Error('Reply lost after commit');
    }
    return r;
  };
  try{sent=await s.send(dispatch,f.signal);}finally{globalThis.fetch=native;}
  assert.equal(lost,1);assert.equal(sent.state,'ACKED',JSON.stringify(sent));
  const second=await s.tick(f.signal);assert.equal(second.result.runId,b.runId);
  const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'fixture.verification'});
  assert.equal(claim.delegation.attemptId,aAttempt);
  const task=await f.storage.request('getA2ATask',{callerId,endpointId:claim.endpointId,taskId:claim.taskId});
  await f.storage.request('settleAcceptedWork',{endpointId:claim.endpointId,taskId:claim.taskId,workerId:claim.workerId,claimToken:claim.claimToken,
    state:'completed',snapshot:{...task.snapshot,status:{state:'TASK_STATE_COMPLETED',timestamp:new Date().toISOString()}}});
  assert.equal((await f.storage.request('getAttempt',{attemptId:aAttempt})).state,'VERIFYING');
  assert.deepEqual(await f.storage.request('nextScheduledWork',{}),[]);
  const evidence=f.sql('SELECT artifact_id,content_hash FROM artifacts WHERE artifact_id=?',a.artifactId)[0],ref={artifactId:evidence.artifact_id,sha256:evidence.content_hash};
  await f.storage.request('recordVerifiedWork',{meta:meta(a.runId),runId:a.runId,attemptId:aAttempt,outcome:'success',evidence:ref,
    outputs:[{slot:'implementation.commit',ref}],codeCommit:'c'.repeat(40)});
  const eligible=(await f.storage.request('nextScheduledWork',{}))[0];assert.equal(eligible.runId,a.runId);assert.equal(eligible.work.role,'tester');
  const third=await s.tick(f.signal);assert.equal(third.result.runId,a.runId);
  const saved=JSON.parse(f.sql('SELECT input_manifest_json FROM attempts WHERE attempt_id=?',third.result.attemptIds[0])[0].input_manifest_json);
  assert.equal(saved.codeCommit,'c'.repeat(40));assert.deepEqual(saved.artifacts,[ref]);
  assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('uncertain send keeps its original attempt and allows another project to proceed',timeout,async t=>{
  const f=await fixture(t),a=await f.create(draft(),'A'),b=await f.create(draft(),'B');
  assert.equal((await f.confirm(a)).status,202);assert.equal((await f.confirm(b)).status,202);
  const s=f.scheduler([a,b]),first=await s.tick(f.signal),attemptId=first.result.attemptIds[0];
  const [original]=await f.storage.request('listScheduledDispatches',{}),key={attemptId,callerId};
  assert.equal((await f.storage.request('markScheduledDispatchSent',key)).send,true);
  assert.equal((await s.send(original,f.signal)).state,'RECONCILE');
  assert.equal((await f.storage.request('markScheduledDispatchSent',key)).send,false);
  assert.equal((await f.storage.request('getAttempt',{attemptId})).state,'OUTCOME_UNKNOWN');
  assert.equal(f.sql('SELECT count(*) AS n FROM role_slots WHERE run_id=?',a.runId)[0].n,1);
  const next=await s.tick(f.signal);assert.equal(next.result.runId,b.runId);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts WHERE run_id=?',a.runId)[0].n,1);
});

test('runner capacity rejects a second admission atomically and paused confirmation never dispatches',timeout,async t=>{
  const f=await fixture(t),a=await f.create(draft(),'A'),b=await f.create(draft(),'B'),paused=await f.create(draft(),'Paused');
  await f.storage.request('setControlIntent',{meta:meta(paused.runId),runId:paused.runId,ifMatch:'"r2"',action:'pause'});
  const p=await f.confirm(paused,(await f.getPlan(paused)).etag);
  assert.equal(p.status,202,JSON.stringify(p.body));
  assert.equal(f.sql('SELECT count(*) AS n FROM outbox WHERE operation_id=?',p.body.operationId)[0].n,0);
  assert.equal((await f.confirm(a)).status,202);assert.equal((await f.confirm(b)).status,202);
  const s=f.scheduler([a,b],{runnerCapacity:1});
  assert.equal((await s.tick(f.signal)).result.runId,a.runId);
  assert.equal(await s.tick(f.signal),null);assert.equal(s.lastError,'RUNNER_CAPACITY_EXHAUSTED');
  assert.equal(f.sql('SELECT count(*) AS n FROM scheduler_run_budget')[0].n,1);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,1);
  assert.equal(f.sql('SELECT count(*) AS n FROM scheduled_dispatch_delivery WHERE state=?','ACKED')[0].n,1);
});

test('old plan remains readable and cannot be confirmed with the current resource revision',timeout,async t=>{
  const f=await fixture(t),p=await f.create();
  const next={...p.graph,requirementRevision:2},object=await f.content.putJson(meta(p.runId),{kind:'content'},next);
  await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:2,planRevision:2,
    requirements:requirements(),plan:next,planContentHash:object.expectedHash});
  const old=await f.getPlan(p,'?revision=1'),current=await f.getPlan(p);
  assert.equal(old.body.mode,'history');assert.equal(old.body.canConfirm,false);assert.equal(old.etag,null);
  assert.equal(current.body.planRevision,2);assert.equal(current.body.canConfirm,true);
  assert.equal((await f.confirm(p,current.etag)).body.error.code,'PLAN_SUPERSEDED');
});

test('unavailable Runner resources leave no admission facts and another project can proceed',timeout,async t=>{
  const f=await fixture(t),a=await f.create(draft(),'Too large'),b=await f.create(draft(),'Fits');
  assert.equal((await f.confirm(a)).status,202);assert.equal((await f.confirm(b)).status,202);
  const s=f.scheduler([a,b],c=>c.runId===a.runId?{runnerLimits:{cpu:0.5,memoryMiB:64,timeoutMs:1000}}:{});
  assert.equal((await s.tick(f.signal)).result.runId,b.runId);assert.equal(s.lastError,'RUNNER_RESOURCE_UNAVAILABLE');
  assert.equal(f.sql('SELECT count(*) AS n FROM scheduler_run_budget WHERE run_id=?',a.runId)[0].n,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts WHERE run_id=?',a.runId)[0].n,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM execution_grants WHERE run_id=?',a.runId)[0].n,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,1);
  assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('restart reconciles the original dispatched work without a second HTTP send',timeout,async t=>{
  const f=await fixture(t),a=await f.create();
  assert.equal((await f.confirm(a)).status,202);
  const s=f.scheduler([a]);await s.tick(f.signal);
  const [original]=await f.storage.request('listScheduledDispatches',{});
  const send=await scheduledWorkClient(original.endpoint,serviceToken,f.signal);
  assert.equal((await f.storage.request('markScheduledDispatchSent',{attemptId:original.attemptId,callerId})).send,true);
  const reply=await send(original.delegation);
  await f.agents.stop();await f.local.close();
  const reopened=await f.reopen(),recovery=new WorkflowScheduler(reopened.storage,f.registry,async()=>{throw new Error('A replay must not fetch credentials');},{callerId,planResources:async()=>null});
  const [saved]=await reopened.storage.request('listScheduledDispatches',{});
  assert.equal(saved.state,'SENT');assert.equal(saved.delegation.operationId,original.delegation.operationId);
  assert.deepEqual(await recovery.send(saved,f.signal),{state:'ACKED',taskId:reply.id});
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,1);
  assert.equal(f.sql('SELECT count(*) AS n FROM delegation_inbox')[0].n,1);
});

test('shutdown aborts an allocator in progress before admission',timeout,async t=>{
  const f=await fixture(t),a=await f.create();assert.equal((await f.confirm(a)).status,202);
  let entered;const started=new Promise(resolve=>{entered=resolve;});
  const s=new WorkflowScheduler(f.storage,f.registry,credential,{callerId,planResources:async(_candidate,signal)=>{
    entered();await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return null;
  }});
  s.start();await started;await s.stop();
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM outbox WHERE destination=?','builtin.developer')[0].n,0);
});

test('pause after admission but before send proves non-delivery and releases only that slot',timeout,async t=>{
  const f=await fixture(t),a=await f.create();assert.equal((await f.confirm(a)).status,202);
  const s=f.scheduler([a]);await s.tick(f.signal);
  const [original]=await f.storage.request('listScheduledDispatches',{}),view=await f.storage.request('getRun',{runId:a.runId});
  await f.storage.request('setControlIntent',{meta:meta(a.runId),runId:a.runId,ifMatch:`"r${view.resourceRevision}"`,action:'pause'});
  const stopped=await s.send(original,f.signal);assert.equal(stopped.state,'NOT_SENT');
  assert.equal(f.sql('SELECT count(*) AS n FROM delegation_inbox')[0].n,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM role_slots WHERE run_id=?',a.runId)[0].n,0);
  assert.ok((await f.storage.request('getAttempt',{attemptId:original.attemptId})).endedAt);
});
