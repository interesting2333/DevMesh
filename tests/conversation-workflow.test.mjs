import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';
import {ConversationRuntime,providerConfigSchema,ModelError} from '../packages/agent-runtime/dist/index.mjs';
import {workbenchPlanningFixture} from './fixtures/workbench-planning.mjs';
import {admission} from './fixtures/storage-data.mjs';

export const decision=(reply='已理解你的问题。',extra={})=>({reply,intent:'QUERY',action:'NONE',goal:'',planOnly:false,answers:[],...extra});
export const provider=(complete)=>({config:providerConfigSchema.parse({providerId:'conversation.test',model:'fixture',endpoint:'http://127.0.0.1:1',credentialRef:'fixture.key',capabilities:{revision:'v1',contextTokens:65536,maxOutputTokens:4096,toolCalls:false,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'}}),complete:async(request,signal)=>({content:JSON.stringify(await complete(request,signal)),toolCalls:[],finishReason:'stop',requestId:randomUUID(),usage:{inputTokens:20,outputTokens:20,source:'provider'},model:'fixture',cost:null})});
async function h(t,model,extra={}){
 const f=await inputFixture(t),runtime=new ConversationRuntime(f.storage,f.content,{baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},provider:()=>model,preparation:()=>true,execution:()=>false,...extra});
 const createKey=randomUUID(),creation={meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:createKey},body:{clientConversationId:randomUUID()}};
 const created=await f.storage.request('createConversation',creation),id=created.result.conversationId;
 const input=(text='为什么需要权限设计？',mode='EXECUTE',key=randomUUID())=>({meta:{principalId:'user_1',scopeId:id,idempotencyKey:key},conversationId:id,body:{clientMessageId:randomUUID(),text,attachmentIds:[],executionMode:mode}});
 const view=()=>f.storage.request('getConversation',{principalId:'user_1',conversationId:id});
 const process=async()=>{const turn=await f.storage.request('claimConversationTurn',{workerId:'fixture'});assert(turn);await runtime.process(turn,new AbortController().signal);return turn;};
 return {...f,runtime,id,input,view,process,creation,created};
}

test('conversation intake is idempotent, isolated and ordered; actual assistant reply persists without creating a project',async t=>{
 const f=await h(t,provider(()=>decision('权限可以按员工、处理人和管理员划分。'))),body=f.input();
 assert.deepEqual(await f.storage.request('createConversation',f.creation),f.created);
 const saved=await f.storage.request('appendConversationMessage',body);assert.deepEqual(await f.storage.request('appendConversationMessage',body),saved);
 await assert.rejects(f.storage.request('appendConversationMessage',{...body,body:{...body.body,text:'different'}}),e=>e.code==='IDEMPOTENCY_KEY_REUSED');
 await assert.rejects(f.storage.request('getConversation',{principalId:'user_2',conversationId:f.id}),e=>e.code==='RESOURCE_NOT_FOUND');
 await f.process();const v=await f.view();assert.equal(v.messages.length,2);assert.equal(v.messages[1].role,'assistant');assert.match(v.messages[1].text,/员工/);assert.equal(v.conversation.projectId,null);assert.equal(f.sql('SELECT count(*) n FROM projects')[0].n,0);assert.equal(v.conversation.state,'IDLE');
});

test('late model response is superseded by a new instruction and cannot apply a development action',async t=>{
 let started,release;const ready=new Promise(r=>started=r),wait=new Promise(r=>release=r);
 const f=await h(t,provider(async()=>{started();await wait;return decision('开始创建应用。',{intent:'DEVELOP',action:'DEVELOP',goal:'一个看板'});}));
 await f.storage.request('appendConversationMessage',f.input('创建看板'));const turn=await f.storage.request('claimConversationTurn',{workerId:'fixture'});const working=f.runtime.process(turn,new AbortController().signal);await ready;
 await f.storage.request('appendConversationMessage',f.input('先只讨论，不要开发','PLAN'));release();await working;
 assert.equal(f.sql('SELECT count(*) n FROM projects')[0].n,0);assert.equal((await f.view()).messages.length,2);assert.equal(f.sql('SELECT state FROM conversation_turns WHERE turn_id=?',turn.turnId)[0].state,'SUPERSEDED');
});

test('development delegates actual input with the original identity, binds a Run and preserves PLAN mode',async t=>{
 const f=await h(t,provider(()=>decision('我会先梳理工单功能与实现方案。',{intent:'DEVELOP',action:'DEVELOP',goal:'内部工单系统'})));
 await f.storage.request('appendConversationMessage',f.input('先提供工单系统方案','PLAN'));const turn=await f.process();const v=await f.view();assert(v.conversation.projectId&&v.conversation.runId);assert.equal(v.conversation.executionMode,'PLAN');assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM conversation_plan_admissions')[0].n,0);
 assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,1);assert.equal(f.sql('SELECT state FROM conversation_turns WHERE turn_id=?',turn.turnId)[0].state,'DONE');
 await assert.rejects(f.storage.request('prepareConversationAction',{turnId:turn.turnId,claimToken:turn.claimToken,action:{kind:'CREATE',goal:'different'}}));
});

test('unknown model outcome stays unknown across recovery and does not automatically call the provider again',async t=>{
 let calls=0;const model=provider(()=>{calls++;throw new ModelError('MODEL_NETWORK',false,'unknown');}),f=await h(t,model);
 await f.storage.request('appendConversationMessage',f.input());await f.process();assert.equal((await f.view()).conversation.state,'UNKNOWN');await f.storage.request('recoverConversationTurns',{});assert.equal(await f.storage.request('claimConversationTurn',{workerId:'fixture'}),null);assert.equal(calls,1);
});

test('missing model is an explicit saved-input block; consulting never fabricates a processing result',async t=>{
 const f=await h(t,undefined);await f.storage.request('appendConversationMessage',f.input());await f.process();const v=await f.view();assert.equal(v.conversation.state,'BLOCKED');assert.equal(v.conversation.blockReason,'MODEL_NOT_CONFIGURED');assert.equal(v.messages.length,1);assert.equal(f.sql('SELECT count(*) n FROM projects')[0].n,0);
});

test('execution authorization admits the exact real plan without fabricating a manual confirmation',async t=>{
 const f=await workbenchPlanningFixture(t),created=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:randomUUID()},body:{clientConversationId:randomUUID(),projectId:f.projectId}}),id=created.result.conversationId;
 await f.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body:{clientMessageId:randomUUID(),text:'按原需求完成研发和验证',attachmentIds:[],executionMode:'EXECUTE'}});
 const turn=await f.storage.request('claimConversationTurn',{workerId:'fixture'}),claim={turnId:turn.turnId,claimToken:turn.claimToken};await f.storage.request('markConversationModelSent',{...claim,request:{fixture:'trusted model output'},reservedTokens:1,tokenLimit:100000});await f.storage.request('saveConversationResponse',{...claim,response:decision('我会按本次任务授权推进。')});await f.storage.request('bindConversationRun',{...claim,projectId:f.projectId,runId:f.runId});await f.storage.request('completeConversationTurn',{...claim,state:'WORKING'});
 const runtime=new ConversationRuntime(f.storage,f.content,{baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},provider:()=>provider(()=>decision()),preparation:()=>true,execution:()=>true});await runtime.observe();
 assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM conversation_plan_admissions')[0].n,1);
 const review=await f.storage.request('getPlanReview',{principalId:'user_1',runId:f.runId});assert.equal(review.confirmation,null);assert(review.executionAuthorization);assert.equal(review.canConfirm,false);assert((await f.storage.request('nextScheduledWork',{limit:10})).some(c=>c.runId===f.runId));
});

test('PLAN mode stays unadmitted until a clear confirmation; exact saved plan confirmation then uses the original domain operation',async t=>{
 const f=await workbenchPlanningFixture(t),created=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:randomUUID()},body:{clientConversationId:randomUUID(),projectId:f.projectId}}),id=created.result.conversationId;
 const append=text=>f.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body:{clientMessageId:randomUUID(),text,attachmentIds:[],executionMode:'PLAN',observedPlan:{runId:f.runId,planRevision:f.review.planRevision,requirementRevision:f.review.requirementRevision,reviewHash:f.review.reviewHash,resourceRevision:f.review.resourceRevision}}});
 await append('先只给计划');const t1=await f.storage.request('claimConversationTurn',{workerId:'fixture'}),claim={turnId:t1.turnId,claimToken:t1.claimToken};await f.storage.request('markConversationModelSent',{...claim,request:{fixture:true},reservedTokens:1,tokenLimit:100000});await f.storage.request('saveConversationResponse',{...claim,response:decision('方案已整理，等待审阅。')});await f.storage.request('bindConversationRun',{...claim,projectId:f.projectId,runId:f.runId});await f.storage.request('completeConversationTurn',{...claim,state:'WORKING'});
 const runtime=new ConversationRuntime(f.storage,f.content,{baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},provider:()=>provider(()=>decision('我会按已确认方案继续。',{intent:'CONFIRM',action:'CONFIRM'})),preparation:()=>true,execution:()=>true});await runtime.observe();assert.equal((await f.storage.request('getConversation',{principalId:'user_1',conversationId:id})).conversation.state,'WAITING_CONFIRMATION');assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM conversation_plan_admissions')[0].n,0);
 await append('确认当前方案并开始执行');const t2=await f.storage.request('claimConversationTurn',{workerId:'fixture'});await runtime.process(t2,new AbortController().signal);assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM conversation_plan_admissions')[0].n,0);
});

test('pause retains later messages without scheduling them; explicit resume handles the new input once',async t=>{
 const f=await h(t,provider(()=>decision()));await f.storage.request('appendConversationMessage',f.input());await f.process();let view=await f.view();const key=randomUUID(),paused=await f.runtime.control('user_1',f.id,{action:'PAUSE',revision:view.conversation.revision},key);assert.equal((await f.view()).conversation.state,'PAUSED');assert.deepEqual(await f.runtime.control('user_1',f.id,{action:'PAUSE',revision:view.conversation.revision},key),paused);
 await f.storage.request('appendConversationMessage',f.input('暂停期间补充的内容'));assert.equal(await f.storage.request('claimConversationTurn',{workerId:'fixture'}),null);view=await f.view();await f.runtime.control('user_1',f.id,{action:'RESUME',revision:view.conversation.revision},randomUUID());await f.process();assert.equal((await f.view()).messages.filter(m=>m.role==='assistant').length,2);
});

async function bound(t,mode='EXECUTE',reply=()=>decision()){
 const f=await workbenchPlanningFixture(t),created=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:randomUUID()},body:{clientConversationId:randomUUID(),projectId:f.projectId}}),id=created.result.conversationId;
 const append=(text,extra={})=>f.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body:{clientMessageId:randomUUID(),text,attachmentIds:[],executionMode:mode,...extra}});
 await append('按当前目标推进');const turn=await f.storage.request('claimConversationTurn',{workerId:'fixture'}),claim={turnId:turn.turnId,claimToken:turn.claimToken};await f.storage.request('markConversationModelSent',{...claim,request:{fixture:true},reservedTokens:1,tokenLimit:100000});await f.storage.request('saveConversationResponse',{...claim,response:decision()});await f.storage.request('bindConversationRun',{...claim,projectId:f.projectId,runId:f.runId});await f.storage.request('completeConversationTurn',{...claim,state:'WORKING'});
 const runtime=new ConversationRuntime(f.storage,f.content,{baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},provider:()=>provider(reply),preparation:()=>true,execution:()=>true});
 const view=()=>f.storage.request('getConversation',{principalId:'user_1',conversationId:id});
 const process=async()=>{const turn=await f.storage.request('claimConversationTurn',{workerId:'fixture'});assert(turn);await runtime.process(turn,new AbortController().signal);return turn;};
 return {...f,id,append,runtime,view,process};
}

test('confirmation without the displayed exact plan basis cannot authorize an unseen plan',async t=>{
 const f=await bound(t,'PLAN',()=>decision('开始执行。',{intent:'CONFIRM',action:'CONFIRM'}));await f.runtime.observe();await f.append('修改吧');await f.process();assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal((await f.view()).conversation.blockReason,'CONVERSATION_CONFIRMATION_REQUIRED');
});

test('scope change waits for actual pause, creates a new input, and can publish a new requirement and plan revision',async t=>{
 const f=await bound(t,'EXECUTE',()=>decision('我会在当前工作收尾后增加筛选，并重新整理方案。',{intent:'ADJUST',action:'UPDATE',goal:'保留来源导航，增加状态筛选'}));await f.runtime.observe();await f.append('再增加状态筛选');await f.process();assert.equal((await f.view()).conversation.state,'PAUSING');assert.equal(f.sql('SELECT applied_operation_id FROM conversation_changes')[0].applied_operation_id,null);
 await f.runtime.advanceChanges();const run=await f.storage.request('getRun',{runId:f.runId});assert.equal(run.controlGate,'OPEN');assert.equal(run.currentPlanRevision,null);assert.equal(run.phase,'UNDERSTANDING');assert(f.sql('SELECT applied_operation_id FROM conversation_changes')[0].applied_operation_id);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,2);
 const job=await f.dispatch('UNDERSTAND'),context=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:job.jobId});const ref=context.sources.filter(s=>s.ref.kind==='message').at(-1).ref;
 const result=await f.execute('product',{...f.product,requirements:[{...f.product.requirements[0],statement:'来源导航和状态筛选',sourceRefs:[ref]}]});assert.equal(result.requirementRevision,2);
 const planning=await f.dispatch('PLAN'),pctx=await f.storage.request('getPreparationContext',{principalId:'user_1',jobId:planning.jobId}),draft=structuredClone(f.draft);draft.requirementRevision=2;draft.works.forEach(w=>w.workRevision=2);draft.works[0].goal='实现来源导航与状态筛选';draft.works[0].inputRefs=[pctx.sources.find(s=>s.label.startsWith('git:')).ref];
 const planned=await f.execute('architect',{schemaVersion:'devmesh.architecture.v1',role:'architect',interfaces:[],planDraft:draft,risks:[],capabilityFit:{supported:true,gaps:[]}});assert.equal(planned.planRevision,2);assert.equal(f.sql('SELECT count(*) n FROM plan_revisions')[0].n,2);assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);
});

test('active attempts prevent scope adoption and cannot be relabelled as physically paused',async t=>{
 const f=await bound(t,'EXECUTE',()=>decision('会等待旧工作安全收尾。',{intent:'ADJUST',action:'UPDATE',goal:'在导航基础上增加筛选'}));await f.runtime.observe();const input=await admission(f.storage,{...f,requirements:{requirements:f.product.requirements}}),target=await f.registry.resolveRole('developer');input.works[0].endpoint={endpointId:target.config.endpointId,revision:target.config.revision,cardHash:target.config.cardHash,registryGenerationId:f.registry.version.generationId};await f.storage.request('admitWorks',input);await f.append('增加筛选');await f.process();await f.runtime.advanceChanges();
 assert.equal((await f.storage.request('getRun',{runId:f.runId})).controlGate,'PAUSING');assert.equal(f.sql('SELECT applied_operation_id FROM conversation_changes')[0].applied_operation_id,null);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,1);
});

test('resume interprets instructions saved during pause before reopening the old plan',async t=>{
 const f=await bound(t,'EXECUTE',()=>decision('恢复时会先采用新要求。',{intent:'ADJUST',action:'UPDATE',goal:'导航增加状态筛选'}));await f.runtime.observe();await f.runtime.control('user_1',f.id,{action:'PAUSE',revision:(await f.view()).conversation.revision},randomUUID());await f.runtime.advanceChanges();await f.runtime.observe();assert.equal((await f.view()).conversation.state,'PAUSED');
 await f.append('恢复时增加筛选');const resumeKey=randomUUID(),body={action:'RESUME',revision:(await f.view()).conversation.revision};const receipt=await f.runtime.control('user_1',f.id,body,resumeKey);assert.equal((await f.storage.request('getRun',{runId:f.runId})).controlGate,'PAUSED');await f.process();await f.runtime.advanceChanges();assert.equal((await f.storage.request('getRun',{runId:f.runId})).currentPlanRevision,null);assert.deepEqual(await f.runtime.control('user_1',f.id,body,resumeKey),receipt);
});

test('permission downgrade blocks conversation writes, claims and automatic plan authorization',async t=>{
 const f=await bound(t);f.sql("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",f.projectId);assert.equal((await f.view()).canWrite,false);await assert.rejects(f.append('新增要求'),e=>e.code==='FORBIDDEN');await f.runtime.observe();assert.equal(f.sql('SELECT count(*) n FROM conversation_plan_admissions')[0].n,0);assert.equal(await f.storage.request('claimConversationTurn',{workerId:'fixture'}),null);
});

test('a natural-language restriction to planning pauses previously authorized implementation',async t=>{
 const f=await bound(t,'EXECUTE',()=>decision('我会先暂停实现，只讨论方案。',{planOnly:true}));await f.runtime.observe();await f.append('先只讨论方案，不要改代码');await f.process();assert.equal((await f.view()).conversation.executionMode,'PLAN');assert.equal((await f.storage.request('getRun',{runId:f.runId})).controlGate,'PAUSING');
});

test('actual cancellation reaches a terminal conversation and subsequent consulting can still receive a reply',async t=>{
 const f=await bound(t);await f.runtime.control('user_1',f.id,{action:'CANCEL',revision:(await f.view()).conversation.revision},randomUUID());await f.runtime.advanceChanges();await f.runtime.observe();assert.equal((await f.view()).conversation.state,'CANCELLED');await f.append('刚才为什么取消了？');await f.process();assert.equal((await f.view()).messages.filter(m=>m.role==='assistant').length,2);
});

test('completed Run uses the actual COMPLETED terminal outcome and projects completion only once',async t=>{
 const f=await bound(t);
 // Explicit terminal snapshot fixture for projection only, not delivery evidence.
 f.sql("UPDATE runs SET terminal_outcome='COMPLETED',ended_at=? WHERE run_id=?",new Date().toISOString(),f.runId);await f.runtime.observe();await f.runtime.observe();const view=await f.view();assert.equal(view.conversation.state,'COMPLETED');assert.equal(view.messages.filter(m=>m.text.startsWith('本轮执行已完成')).length,1);
});

test('closing conversation intake preserves reads and original operation lookup',async t=>{
 const f=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'}),conversations:{admission:()=>false,capabilities:()=>({model:false,preparation:false,execution:false,reason:'MODEL_NOT_CONFIGURED'}),control:async()=>{throw Error('unused');}}});
 const key=randomUUID(),created=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:key},body:{clientConversationId:randomUUID()}});
 const blocked=await fetch(f.origin+'/api/v1/conversations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({clientConversationId:randomUUID()})});assert.equal(blocked.status,503);assert.equal((await blocked.json()).error.code,'CONVERSATION_ADMISSION_CLOSED');
 assert.equal((await fetch(f.origin+'/api/v1/conversations/'+created.result.conversationId)).status,200);assert.equal((await fetch(f.origin+'/api/v1/conversation-operations/'+key+'?scope=conversations.create')).status,200);assert.equal(f.sql('SELECT count(*) n FROM conversations')[0].n,1);
});
