import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {generatedFixture} from './fixtures/generated-conversation.mjs';

const path=f=>'/conversations/'+f.id+'/execution-details';
test('execution details project durable files, checks and safe activity facts without creating executions',async t=>{
 const f=await generatedFixture(t);
 assert.deepEqual((await f.call(path(f))).body,{conversationId:f.id,currentInputRevision:0,currentGoal:'',previousResult:null,previousPreview:null,sessionCount:0,sessions:[],selected:null});
 await f.input();await f.runTurn();
 const before=f.sql('SELECT (SELECT count(*) FROM assistant_steps) steps,(SELECT count(*) FROM assistant_tool_calls) tools,(SELECT count(*) FROM conversation_messages) messages,(SELECT count(*) FROM operations) operations');
 const {response,body}=await f.call(path(f));assert.equal(response.status,200);assert.equal(body.currentInputRevision,1);assert.equal(body.sessionCount,1);
 const s=body.selected;assert.equal(s.task.state,'READY');assert.equal(s.task.verified,true);assert.equal(s.task.files[0].path,'index.html');assert.equal(s.goal,'创建一个英语学习网站html');assert.match(s.reply,/英语学习网站已生成/);assert.equal(s.modelSteps,3);assert.equal(s.toolCalls,2);assert.equal(s.totalActivities,6);assert.equal(s.activities.length,6);
 assert(s.activities.some(a=>a.tool==='project_write'&&a.path==='index.html'&&a.state==='SUCCEEDED'));
 assert(s.activities.some(a=>a.tool==='project_check'&&a.check==='html'&&a.exitCode===0));
 for(const a of s.activities)assert(Object.keys(a).every(k=>['id','kind','state','startedAt','updatedAt','stepNo','tool','path','check','exitCode'].includes(k)));
 assert(!JSON.stringify(body).includes(f.root));assert(!('workspace' in s));assert(!('request' in s));
 await f.call(path(f));assert.deepEqual(f.sql('SELECT (SELECT count(*) FROM assistant_steps) steps,(SELECT count(*) FROM assistant_tool_calls) tools,(SELECT count(*) FROM conversation_messages) messages,(SELECT count(*) FROM operations) operations'),before);
});

test('execution details enforce conversation authorization and reject a session from another conversation',async t=>{
 const f=await generatedFixture(t);await f.input();await f.runTurn();const first=(await f.call(path(f))).body.selected.task.sessionId;
 assert.equal((await f.call(path(f),{headers:{authorization:'Bearer test_other'}})).response.status,404);
 const second=(await f.call('/conversations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({clientConversationId:randomUUID()})})).body.result.conversationId;
 assert.equal((await f.call('/conversations/'+second+'/execution-details?sessionId='+first)).response.status,404);
 assert.equal((await f.call(path(f)+'?other=bad')).response.status,422);
 assert.equal((await f.call(path(f)+'?sessionId=missing')).response.status,404);
});

test('current PLAN and explicitly selected historical EDIT retain their own goal, mode and file version',async t=>{
 const f=await generatedFixture(t);await f.input();await f.runTurn();const original=(await f.call(path(f))).body.selected;
 await f.input('先分析下一轮如何改进','PLAN');
 const queued=(await f.call(path(f))).body;
 assert.equal(queued.currentGoal,'先分析下一轮如何改进');
 assert.equal(queued.previousResult,original.task.sessionId);
 assert.equal(queued.previousPreview,original.task.sessionId);
 assert.equal(queued.sessions[0].goal,original.goal);
 assert.equal(queued.sessions[0].startedAt,original.createdAt);
 await f.runTurn();const latest=(await f.call(path(f))).body;
 assert.equal(latest.currentInputRevision,2);assert.equal(latest.sessionCount,2);assert.equal(latest.selected.task.mode,'READ');assert.equal(latest.selected.goal,'先分析下一轮如何改进');assert.equal(latest.selected.toolCalls,0);
 const historical=(await f.call(path(f)+'?sessionId='+original.task.sessionId)).body;assert.equal(historical.currentInputRevision,2);assert.equal(historical.selected.task.inputRevision,1);assert.equal(historical.selected.task.mode,'EDIT');assert.equal(historical.selected.goal,original.goal);assert.deepEqual(historical.selected.task.files,original.task.files);
 assert.equal(f.sql("SELECT count(*) n FROM assistant_tool_calls WHERE name='project_write'")[0].n,1);
});

test('pending and unknown model steps remain visible as unresolved durable facts',async t=>{
 const f=await generatedFixture(t);await f.input();const turn=await f.storage.request('claimConversationTurn',{workerId:'details.fixture'}),claim={turnId:turn.turnId,claimToken:turn.claimToken};
 const session=await f.storage.request('beginAssistantSession',{...claim,mode:'EDIT'});
 await f.storage.request('sendAssistantStep',{...claim,sessionId:session.sessionId,stepNo:1,request:{messages:[{role:'system',content:'private system prompt'}]},reservedTokens:1,tokenLimit:100000});
 let value=(await f.call(path(f))).body;assert.equal(value.selected.task.state,'RUNNING');assert.equal(value.selected.activities.find(a=>a.kind==='MODEL').state,'SENT');assert(!JSON.stringify(value).includes('private system prompt'));
 await f.storage.request('finishAssistantSession',{...claim,sessionId:session.sessionId,state:'UNKNOWN',result:{},errorCode:'ASSISTANT_MODEL_UNKNOWN'});
 value=(await f.call(path(f))).body;assert.equal(value.selected.task.state,'UNKNOWN');assert.equal(value.selected.task.verified,false);assert.equal(value.selected.modelSteps,1);assert.equal(f.sql('SELECT count(*) n FROM assistant_steps')[0].n,1);
});
