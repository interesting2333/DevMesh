import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync,fork} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {TaskState,ListTasksRequest} from '../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/index.js';
import {PreparationRuntime,ModelError,providerConfigSchema,readPreparationGitSource} from '../packages/agent-runtime/dist/index.mjs';
import {mountInputApi} from '../packages/input-api/dist/index.mjs';
import {understandingView,understandingOutput,answerQuestionsInput} from '../packages/contracts/dist/index.js';
import {preparationClient} from '../packages/a2a-adapter/dist/index.mjs';
import {callerId,credential,httpFixture,serviceToken} from './fixtures/a2a-data.mjs';
import {meta,plan} from './fixtures/storage-data.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url)),sourcePath='templates/web-crud-v1/template.json';
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const timeout={timeout:120000};
const config=providerConfigSchema.parse({providerId:'controlled',endpoint:'http://127.0.0.1:1',model:'test-model',credentialRef:'test.model',capabilities:{revision:'v1',contextTokens:128000,maxOutputTokens:1024,toolCalls:false,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'}});
function question(id,ref){return {id,required:true,prompt:'选哪一项？',reason:'需要明确依据',sourceRefs:[ref],blockingScope:[],options:[{id:'yes',label:'是'},{id:'no',label:'否'}],defaultOption:'yes'};}
function output(ref,questions=[],conflicts=[]){return {schemaVersion:'devmesh.understanding.v1',role:'product',requirements:[{id:'requirement_1',statement:'提供可追溯工作台',sourceRefs:[ref],acceptance:['可读原文']}],assumptions:[],questions,conflicts};}
function architect(revision,workRevision=1){const draft=plan(['developer']);draft.requirementRevision=revision;Object.assign(draft.works[0],{workRevision,requirementIds:['requirement_1'],inputRefs:[],dependencies:[]});return {schemaVersion:'devmesh.architecture.v1',role:'architect',interfaces:[],planDraft:draft,risks:[],capabilityFit:{supported:true,gaps:[]}};}
const response=(value,tools=[])=>({content:JSON.stringify(value),toolCalls:tools,finishReason:'stop',requestId:'fixture-'+randomUUID(),usage:{inputTokens:50,outputTokens:60,source:'provider'},model:config.model,cost:null});

async function fixture(t){
  const f=await httpFixture(t,{preparation:true}),calls=[],results=[];
  const provider={config,async complete(request){
    assert.deepEqual(request.tools,[]);calls.push(JSON.parse(request.messages[1].content));
    const next=results.shift();if(next instanceof Error)throw next;
    assert.ok(next,'Unexpected model call');return response(next);
  }};
  const options={callerId,workerId:'prep.tests',tokenLimit:100000,maxInputBytes:256*1024,maxOutputTokens:1024,providers:{product:provider,architect:provider},bootstrap:{repositoryRoot:repo,paths:[sourcePath]}};
  const runtime=new PreparationRuntime(f.content,f.registry,credential,options);
  const api=mountInputApi(f.app,f.content,{enabled:true,baseline:{version:'1.0.0',baseCommit},identityResolver:r=>{
    const user=r.headers.authorization?.split(' ')[1];return ['user_1','viewer_1','other_1'].includes(user)?{principalId:user}:null;
  }});
  t.after(()=>api.stop());
  const signal=AbortSignal.timeout(90000);
  const call=async(path,body,headers={})=>{
    const r=await fetch(f.base+'/api/v1'+path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{authorization:'Bearer user_1','content-type':'application/json','idempotency-key':randomUUID(),...headers},signal});
    return {status:r.status,body:await r.json(),etag:r.headers.get('etag')};
  };
  const created=await call('/projects',{initialRequest:{text:'实现工作台，原始需求 🧪',attachmentIds:[]},clientDraftId:randomUUID()});
  assert.equal(created.status,201,JSON.stringify(created.body));const data=created.body.result,ref={kind:'message',messageId:data.messageId};
  const sql=(query,...args)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');return db.prepare(query).all(...args);}finally{db.close();}};
  const dispatch=async(purpose)=>{
    const jobs=await f.storage.request('listPreparationJobs',{});
    const job=jobs.find(j=>j.runId===data.runId&&j.purpose===purpose);assert.ok(job,JSON.stringify(jobs));
    await f.registry.checkHealth(f.manifest,credential);
    let task;try{task=await runtime.dispatch(job,signal);}catch(error){t.diagnostic(JSON.stringify({purpose,registry:await f.storage.request('getRegistrySnapshot',{})}));throw error;}
    assert.ok(task,JSON.stringify(sql('SELECT * FROM preparation_attempts')));
    return {job,task};
  };
  const claim=async(role)=>{const [c]=await f.storage.request('claimPreparationTasks',{endpointId:'builtin.'+role,workerId:options.workerId});assert.ok(c);return c;};
  const execute=async(role)=>runtime.execute(await claim(role),signal);
  const workspace=()=>call('/projects/'+data.projectId+'/workspace');
  const understand=(query='')=>call('/runs/'+data.runId+'/understanding'+query);
  const command=(suffix,body,etag,key=randomUUID())=>call('/runs/'+data.runId+'/'+suffix,body,{'if-match':etag,'idempotency-key':key});
  return {...f,...data,ref,call,sql,storageOptions:f.options,options,runtime,results,calls,signal,dispatch,claim,execute,workspace,understand,command};
}

test('strict understanding and answers require distinct sources and unique question IDs',()=>{
  const ref={kind:'message',messageId:'message_1'},q=question('question_1',ref);
  assert.equal(understandingOutput.safeParse(output(ref,[q])).success,true);
  assert.equal(understandingOutput.safeParse(output(ref,[q],[{id:'conflict',description:'矛盾',sourceRefs:[ref,ref],questionId:q.id}])).success,false);
  assert.equal(understandingOutput.safeParse(output(ref,[q,q])).success,false);
  assert.equal(understandingOutput.safeParse({...output(ref,[q]),providerSecret:'unexpected'}).success,false);
  const a={questionId:q.id,questionRevision:1,value:'yes'};
  assert.equal(answerQuestionsInput.safeParse({answers:[a,a]}).success,false);
  assert.equal(answerQuestionsInput.safeParse({answers:[{...a,value:'🧪'.repeat(35000)}]}).success,false);
});

test('workspace bootstrap selection overrides global paths and registers committed material in actual preparation',timeout,async t=>{
 let blockBootstrap=false;const f=await fixture(t),requested=[],runtime=new PreparationRuntime(f.content,f.registry,credential,{...f.options,bootstrap:{repositoryRoot:repo,paths:['does-not-exist.md']},workspaceBootstrap:async(principalId,runId,commit)=>{if(blockBootstrap)throw Error('External directory is unavailable after dispatch');requested.push({principalId,runId,commit});return {repositoryRoot:repo,paths:[sourcePath]};}}),job=(await f.storage.request('listPreparationJobs',{})).find(j=>j.runId===f.runId&&j.purpose==='UNDERSTAND');await f.registry.checkHealth(f.manifest,credential);await runtime.dispatch(job,f.signal);const context=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:job.jobId});assert.deepEqual(requested,[{principalId:'user_1',runId:f.runId,commit:baseCommit}]);assert(context.sources.some(s=>s.label==='git:'+sourcePath));assert.equal(context.sources.some(s=>s.label.includes('does-not-exist')),false);blockBootstrap=true;await runtime.dispatch({...job,state:'DISPATCHED'},f.signal);assert.equal(requested.length,1);
});

test('official A2A prepares sourced understanding and a draft with no automatic execution',timeout,async t=>{
  const f=await fixture(t),initial=await f.understand();
  assert.equal(initial.status,200);assert.equal(initial.body.pendingInputCount,1);assert.equal(initial.body.understanding,null);
  const {job,task}=await f.dispatch('UNDERSTAND'),context=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:job.jobId});
  const git=context.sources.find(s=>s.label==='git:'+sourcePath).ref,q=question('question_1',f.ref);
  const value=output(f.ref,[q],[{id:'different-source',description:'基线和需求需要确认',sourceRefs:[f.ref,git],questionId:q.id}]);
  value.requirements[0].sourceRefs.push(git);f.results.push(value);
  const endpoint=f.manifest.endpoints.find(e=>e.role==='product'),client=await f.factory.createFromUrl(f.base,'/internal/agents/product/agent-card.json');
  const send=await preparationClient(endpoint,serviceToken,f.signal);
  const repeat=await send(task.snapshot.history[0].parts[0].data);assert.equal(repeat.id,task.taskId);
  await assert.rejects(send({...task.snapshot.history[0].parts[0].data,basisHash:'f'.repeat(64)}));
  assert.equal((await client.getTask({id:task.taskId})).status.state,TaskState.TASK_STATE_SUBMITTED);
  const page=await client.listTasks(ListTasksRequest.fromJSON({pageSize:1}));assert.equal(page.totalSize,1);assert.equal(page.tasks[0].id,task.taskId);
  const result=await f.execute('product');assert.equal(result.requirementRevision,1,JSON.stringify(result));
  const stream=client.resubscribeTask({id:task.taskId});assert.equal((await stream.next()).value.payload.value.status.state,TaskState.TASK_STATE_COMPLETED);assert.equal((await stream.next()).done,true);
  assert.match(f.calls[0].materials.find(s=>s.ref.kind==='message').text,/原始需求 🧪/);
  const view=understandingView.parse((await f.understand()).body);
  assert.equal(view.questions[0].state,'OPEN');assert.equal(view.questions[0].answer,null);assert.equal(view.understanding.conflicts.length,1);
  const preparing=await f.dispatch('PLAN');assert.equal(preparing.task.state,'submitted');f.results.push(architect(1));
  const published=await f.execute('architect');assert.equal(published.planRevision,1,JSON.stringify(published));
  const snapshot=await f.workspace();assert.equal(snapshot.body.preparation.requiredOpenQuestions,1);assert.equal(snapshot.body.preparation.understandingAvailable,true);
  await assert.rejects(f.storage.request('confirmPlan',{meta:meta(f.runId),runId:f.runId,ifMatch:snapshot.etag,requirementRevision:1,planRevision:1,reviewHash:published.reviewHash}),e=>e.code==='REQUIRED_QUESTIONS_UNANSWERED');
  assert.equal(f.sql('SELECT COUNT(*) AS n FROM attempts')[0].n,0);
  assert.equal(f.sql('SELECT COUNT(*) AS n FROM plan_confirmations')[0].n,0);
  assert.equal(f.sql('SELECT preparation_tokens_used AS n FROM runs WHERE run_id=?',f.runId)[0].n,220);
  assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('partial answers have CAS and original-key replay; interpretation retry reuses the frozen answers',timeout,async t=>{
  const f=await fixture(t);await f.dispatch('UNDERSTAND');f.results.push(output(f.ref,[question('question_1',f.ref),question('question_2',f.ref)]));assert.equal((await f.execute('product')).requirementRevision,1);
  const current=await f.workspace(),answer={questionId:'question_1',questionRevision:1,value:'no'},key=randomUUID();
  const stale=await f.command('questions:answer',{answers:[answer,{questionId:'question_2',questionRevision:2,value:'yes'}]},current.etag);
  assert.equal(stale.status,409,JSON.stringify(stale.body));assert.equal(stale.body.error.code,'QUESTION_SUPERSEDED');
  assert.equal(f.sql('SELECT count(*) AS n FROM clarification_answers')[0].n,0);
  const answered=await f.command('questions:answer',{answers:[answer]},current.etag,key);
  assert.equal(answered.status,202,JSON.stringify(answered.body));
  assert.equal((await f.command('questions:answer',{answers:[answer]},current.etag,key)).body.operationId,answered.body.operationId);
  assert.equal((await f.command('questions:answer',{answers:[answer]},current.etag)).status,412);
  const before=(await f.understand()).body;assert.deepEqual(before.questions.map(q=>q.state),['ANSWERED','OPEN']);assert.equal(before.answerInterventions,1);
  const original=await f.dispatch('INTERPRET');
  f.results.push(new ModelError('CONTROLLED_FAILURE',false,'known-failed'));
  assert.deepEqual(await f.execute('product'),{errorCode:'CONTROLLED_FAILURE'});
  const op=await f.call('/operations/'+original.job.operationId);assert.equal(op.body.status,'FAILED');assert.equal(op.body.result.errorCode,'CONTROLLED_FAILURE');
  const retried=await f.command('understanding:retry',{failedInterpretationOperationId:original.job.operationId},(await f.workspace()).etag);
  assert.equal(retried.status,202,JSON.stringify(retried.body));
  await f.dispatch('INTERPRET');f.results.push(output(f.ref,[question('question_2',f.ref)]));
  assert.equal((await f.execute('product')).requirementRevision,2);
  assert.deepEqual(f.calls[1].answers,f.calls[2].answers);
  assert.equal(f.sql('SELECT count(*) AS n FROM clarification_answers')[0].n,1);
  const after=(await f.understand()).body;assert.equal(after.answerInterventions,1);assert.equal(after.questions[0].questionRevision,2);
  const old=(await f.understand('?requirementRevision=1')).body;assert.equal(old.questions[0].state,'SUPERSEDED');assert.equal(old.questions[0].answer.value,'no');
  assert.equal((await f.call('/runs/'+f.runId+'/understanding',undefined,{authorization:'Bearer other_1'})).status,404);
  f.sql('INSERT INTO project_members(project_id,principal_id,role,created_at) VALUES(?,?,?,?)',f.projectId,'viewer_1','viewer',new Date().toISOString());
  assert.equal((await f.call('/runs/'+f.runId+'/understanding',undefined,{authorization:'Bearer viewer_1'})).status,200);
  const viewer=await f.call('/runs/'+f.runId+'/questions:answer',{answers:[{questionId:'question_2',questionRevision:2,value:'yes'}]},{authorization:'Bearer viewer_1','if-match':(await f.workspace()).etag});
  assert.equal(viewer.status,403);
  assert.throws(()=>f.sql("UPDATE clarification_answers SET value_json='null'"),/ANSWER_IMMUTABLE/);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,0);
});

test('stale model output and nonexistent sources cannot publish a requirement revision',timeout,async t=>{
  const f=await fixture(t);await f.dispatch('UNDERSTAND');const claim=await f.claim('product');
  const changed=await f.command('messages',{text:'新输入，原来的理解过期',attachmentIds:[],clientMessageId:randomUUID()},(await f.workspace()).etag);
  assert.equal(changed.status,202,JSON.stringify(changed.body));
  assert.deepEqual(await f.runtime.execute(claim,f.signal),{errorCode:'BASIS_SUPERSEDED'});
  assert.equal(f.calls.length,0);
  await f.dispatch('UNDERSTAND');f.results.push(output({kind:'message',messageId:'message_foreign'}));
  assert.deepEqual(await f.execute('product'),{errorCode:'SOURCE_REFERENCE_INVALID'});
  assert.equal((await f.understand()).body.understanding,null);
  assert.equal(f.sql('SELECT count(*) AS n FROM preparation_slots')[0].n,0);
});

test('unconfigured preparation waits and Git source reads only a fixed trusted commit',timeout,async t=>{
  const f=await fixture(t),[job]=await f.storage.request('listPreparationJobs',{});
  const off=new PreparationRuntime(f.content,f.registry,credential,{...f.options,providers:{}});
  assert.equal(await off.dispatch(job,f.signal),null);assert.equal(f.sql('SELECT count(*) AS n FROM preparation_attempts')[0].n,0);
  const bytes=await readPreparationGitSource(repo,baseCommit,sourcePath,64*1024,f.signal);
  assert.deepEqual(bytes,execFileSync('git',['show',baseCommit+':'+sourcePath],{cwd:repo}));
  await assert.rejects(readPreparationGitSource(repo,baseCommit,'../README.md',64*1024,f.signal));
  await assert.rejects(readPreparationGitSource(repo,'HEAD',sourcePath,64*1024,f.signal));
  await assert.rejects(readPreparationGitSource(repo,baseCommit,sourcePath,5,f.signal));
});

test('pause closes preparation execution but permits saving a partial answer',timeout,async t=>{
  const f=await fixture(t);await f.dispatch('UNDERSTAND');
  f.results.push(output(f.ref,[question('question_1',f.ref),question('question_2',f.ref)]));assert.equal((await f.execute('product')).requirementRevision,1);
  await f.dispatch('PLAN');const claim=await f.claim('architect'),current=await f.workspace();
  await f.storage.request('setControlIntent',{meta:meta(f.runId),runId:f.runId,ifMatch:current.etag,action:'pause'});
  assert.deepEqual(await f.runtime.execute(claim,f.signal),{errorCode:'PREPARATION_ADMISSION_CLOSED'});
  assert.equal(f.calls.length,1);
  const paused=await f.workspace();
  assert.notEqual(paused.body.run.controlGate,'OPEN');
  const saved=await f.command('questions:answer',{answers:[{questionId:'question_1',questionRevision:1,value:'yes'}]},paused.etag);
  assert.equal(saved.status,202,JSON.stringify(saved.body));
  assert.equal((await f.understand()).body.questions[1].state,'OPEN');
  assert.equal((await f.storage.request('listPreparationJobs',{})).length,0);
  assert.equal(f.sql('SELECT count(*) AS n FROM attempts')[0].n,0);
});

test('late architect response is retained but cannot replace a draft on a newer input basis',timeout,async t=>{
  const f=await fixture(t);await f.dispatch('UNDERSTAND');f.results.push(output(f.ref));assert.equal((await f.execute('product')).requirementRevision,1);
  await f.dispatch('PLAN');const claim=await f.claim('architect');
  const provider={config,async complete(){
    const changed=await f.command('messages',{text:'补充一项新约束',attachmentIds:[],clientMessageId:randomUUID()},(await f.workspace()).etag);
    assert.equal(changed.status,202);
    return response(architect(1));
  }};
  const runtime=new PreparationRuntime(f.content,f.registry,credential,{...f.options,providers:{architect:provider}});
  assert.deepEqual(await runtime.execute(claim,f.signal),{errorCode:'BASIS_SUPERSEDED'});
  assert.equal(f.sql("SELECT state FROM preparation_steps WHERE preparation_attempt_id=?",claim.preparationAttemptId)[0].state,'RESPONDED');
  assert.equal(f.sql('SELECT count(*) AS n FROM plan_revisions')[0].n,0);
});

test('two preparation roles share capacity with implementation and remain isolated from another A2A caller',timeout,async t=>{
  const f=await fixture(t);await f.dispatch('UNDERSTAND');f.results.push(output(f.ref));
  assert.equal((await f.execute('product')).requirementRevision,1);
  const planTask=(await f.dispatch('PLAN')).task;
  assert.equal((await f.command('messages',{text:'新增一个要求',attachmentIds:[],clientMessageId:randomUUID()},(await f.workspace()).etag)).status,202);
  const native=globalThis.fetch;let lost=0;
  globalThis.fetch=async(input,init)=>{
    const r=await native(input,init);
    if(String(input instanceof Request?input.url:input).endsWith('/internal/agents/product/a2a')&&init?.method==='POST'){
      const data=await r.json();assert.ok(data.result,JSON.stringify(data));lost++;
      throw new Error('Response lost after receiver committed');
    }
    return r;
  };
  try{await f.dispatch('UNDERSTAND');}finally{globalThis.fetch=native;}
  assert.equal(lost,1);
  assert.deepEqual(f.sql('SELECT role FROM preparation_slots ORDER BY role').map(row=>row.role),['architect','product']);
  assert.throws(()=>f.sql('INSERT INTO role_slots(run_id,role,attempt_id,activation_id) VALUES(?,?,?,?)',f.runId,'developer','attempt_missing','activation_missing'),/ROLE_CAPACITY_EXHAUSTED/);
  assert.equal((await f.storage.request('listPreparationJobs',{})).length,0);
  const foreign=await fetch(f.base+'/internal/agents/architect/a2a',{method:'POST',headers:{authorization:'Bearer devmesh-other-service-test-token','content-type':'application/json','A2A-Version':'1.0'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'GetTask',params:{id:planTask.taskId}}),signal:f.signal});
  const envelope=await foreign.json();assert.ok(envelope.error,JSON.stringify(envelope));assert.notEqual(envelope.error.code,-32601);assert.equal(envelope.result,undefined);
});

for(const cut of ['sent','responded'])test('preparation process kill after '+cut+' recovers without replaying the model',timeout,async t=>{
  const f=await fixture(t);const {job,task}=await f.dispatch('UNDERSTAND');
  await f.agents.stop();await f.local.close();
  const cfg=join(f.root,'preparation-crash.json');
  writeFileSync(cfg,JSON.stringify({options:f.storageOptions,config,cut,result:response(output(f.ref))}));
  const child=fork(fileURLToPath(new URL('./fixtures/preparation-crash-controller.mjs',import.meta.url)),[cfg],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});
  let errors='';child.stderr.on('data',b=>{errors+=b;});
  try{
    const [at]=await Promise.race([once(child,'message'),once(child,'exit').then(([code])=>{throw Error('Preparation child exited '+code+': '+errors);}),
      new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Preparation cutpoint timeout: '+errors)),45000);timer.unref();})]);
    assert.equal(at.stage,cut);
  }finally{
    if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}
  }
  const lock=JSON.parse(readFileSync(f.storageOptions.dataRoot+'.node.writer.lock','utf8'));
  const opened=await f.reopen({recoveryToken:lock.token}),storage=opened.storage;
  const recovered=await storage.request('recoverPreparations',{});
  const claims=await storage.request('claimPreparationTasks',{endpointId:'builtin.product',workerId:'prep.recovered'});
  if(cut==='sent'){
    assert.equal(recovered.unresolved,1);assert.equal(claims.length,0);
    assert.equal((await storage.request('getInputOperation',{principalId:'user_1',operationId:job.operationId})).status,'OUTCOME_UNKNOWN');
    assert.equal((await storage.request('getPreparationTask',{callerId,endpointId:'builtin.product',taskId:task.taskId})).state,'working');
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM preparation_slots')[0].n,1);
  }else{
    assert.deepEqual(recovered,{unresolved:0,notSent:0});assert.equal(claims.length,1);
    const runtime=new PreparationRuntime(opened.content,f.registry,credential,{...f.options,providers:{}});
    assert.equal((await runtime.execute(claims[0],f.signal)).requirementRevision,1);
    assert.equal((await storage.request('getPreparationTask',{callerId,endpointId:'builtin.product',taskId:task.taskId})).state,'completed');
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM preparation_slots')[0].n,0);
  }
  assert.equal(f.sql('SELECT COUNT(*) AS n FROM preparation_steps')[0].n,1);
});
