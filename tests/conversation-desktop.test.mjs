import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {planConversation} from './fixtures/conversation-desktop.mjs';
import {inputFixture} from './fixtures/input-data.mjs';

test('direct plan confirmation binds the exact plan and records one atomic decision without another model turn',async t=>{
 const f=await planConversation(t),before=f.calls.length,result=await f.storage.request('confirmConversationPlan',f.command);
 assert.equal(result.status,'SUCCEEDED');assert.deepEqual(await f.storage.request('confirmConversationPlan',f.command),result);assert.equal(f.calls.length,before);
 assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM decisions')[0].n,1);assert.equal(f.sql('SELECT count(*) n FROM conversation_turns')[0].n,1);
 assert.equal((await f.view()).messages.filter(m=>m.text==='确认方案 v1').length,1);
 await assert.rejects(f.storage.request('confirmConversationPlan',{...f.command,body:{...f.body,inputRevision:0}}),e=>e.code==='IDEMPOTENCY_KEY_REUSED');
});
test('stale input, resource and plan hashes cannot grant execution',async t=>{
 const f=await planConversation(t);
 for(const body of [{...f.body,inputRevision:0},{...f.body,basis:{...f.body.basis,resourceRevision:f.body.basis.resourceRevision+1}},{...f.body,basis:{...f.body.basis,reviewHash:'f'.repeat(64)}}])await assert.rejects(f.storage.request('confirmConversationPlan',{...f.command,meta:{...f.command.meta,idempotencyKey:randomUUID()},body}),e=>['BASIS_SUPERSEDED','PRECONDITION_FAILED','PLAN_SUPERSEDED'].includes(e.code));
 assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal((await f.view()).messages.length,2);
});
test('required clarification blocks a direct confirmation',async t=>{const f=await planConversation(t,{questions:true});await assert.rejects(f.storage.request('confirmConversationPlan',f.command),e=>e.code==='REQUIRED_QUESTIONS_UNANSWERED');assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);});
test('paused confirmation stays paused and a later unprocessed paused instruction cannot confirm the old plan',async t=>{
 const first=await planConversation(t);first.sql("UPDATE conversations SET state='PAUSED',manual_pause=1 WHERE conversation_id=?",first.id);first.sql("UPDATE runs SET control_gate='PAUSED' WHERE run_id=?",first.runId);await first.storage.request('confirmConversationPlan',first.command);assert.equal((await first.view()).conversation.state,'PAUSED');assert.equal(first.sql('SELECT control_gate FROM runs WHERE run_id=?',first.runId)[0].control_gate,'PAUSED');
 const second=await planConversation(t);second.sql("UPDATE conversations SET state='PAUSED',manual_pause=1 WHERE conversation_id=?",second.id);second.sql("UPDATE runs SET control_gate='PAUSED' WHERE run_id=?",second.runId);
 await second.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:second.id,idempotencyKey:randomUUID()},conversationId:second.id,body:{clientMessageId:randomUUID(),text:'先调整范围，不要继续原方案',attachmentIds:[],executionMode:'PLAN'}});
 await assert.rejects(second.storage.request('confirmConversationPlan',{...second.command,body:{...second.body,inputRevision:(await second.view()).conversation.inputRevision}}),e=>e.code==='BASIS_SUPERSEDED');assert.equal(second.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);
});
test('a conversation write failure rolls back plan confirmation, decisions and scheduling, then the original key can succeed',async t=>{
 const f=await planConversation(t),before=f.sql('SELECT count(*) n FROM outbox')[0].n;
 f.sql("CREATE TRIGGER desktop_confirmation_fault BEFORE INSERT ON conversation_messages WHEN NEW.text='确认方案 v1' BEGIN SELECT RAISE(ABORT,'controlled failure'); END");
 await assert.rejects(f.storage.request('confirmConversationPlan',f.command));assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM decisions')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM outbox')[0].n,before);
 assert.equal(await f.storage.request('lookupOperation',f.command.meta),null);f.sql('DROP TRIGGER desktop_confirmation_fault');assert.equal((await f.storage.request('confirmConversationPlan',f.command)).status,'SUCCEEDED');
});
test('confirmation replay reauthorizes current membership',async t=>{const f=await planConversation(t);await f.storage.request('confirmConversationPlan',f.command);f.sql("UPDATE project_members SET role='viewer' WHERE principal_id='user_1' AND project_id=?",f.projectId);await assert.rejects(f.storage.request('confirmConversationPlan',f.command),e=>e.code==='FORBIDDEN');f.sql("DELETE FROM project_members WHERE principal_id='user_1' AND project_id=?",f.projectId);await assert.rejects(f.storage.request('getConversation',{principalId:'user_1',conversationId:f.id}),e=>e.code==='RESOURCE_NOT_FOUND');});
test('manual titles use compare-and-set, survive automatic goal binding and replay once',async t=>{
 const f=await planConversation(t),old=(await f.view()).conversation.title;assert.equal(old,'开发来源导航与权限验证');
 const command={meta:{principalId:'user_1',scopeId:f.id,idempotencyKey:randomUUID()},conversationId:f.id,body:{name:'我的来源工作台',previousName:old}},receipt=await f.storage.request('renameConversation',command);assert.deepEqual(await f.storage.request('renameConversation',command),receipt);
 await assert.rejects(f.storage.request('renameConversation',{...command,meta:{...command.meta,idempotencyKey:randomUUID()},body:{name:'另页旧名称',previousName:old}}),e=>e.code==='CONVERSATION_TITLE_CHANGED');
 await f.storage.request('bindConversationRun',{...f.claim,projectId:f.projectId,runId:f.runId});assert.equal((await f.view()).conversation.title,'我的来源工作台');assert.equal(f.sql('SELECT title_kind FROM conversations')[0].title_kind,'MANUAL');
});
test('HTTP rename and plan context retain privacy, status and admission rules',async t=>{
 let open=true;const f=await inputFixture(t,{conversations:{admission:()=>open,capabilities:()=>({model:true,preparation:true,execution:false,reason:'EXECUTION_NOT_CONFIGURED'})}}),create=await f.call('/conversations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({clientConversationId:randomUUID()})}),id=create.body.result.conversationId;
 assert.equal((await f.call('/conversations/'+id+'/work-context')).body,null);open=false;
 const rename=await f.call('/conversations/'+id+'/rename',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({name:'仅修改会话名称',previousName:'新任务'})});assert.equal(rename.response.status,202);
 const other=await f.call('/conversations/'+id+'/work-context',{headers:{authorization:'Bearer test_other'}});assert.equal(other.response.status,404);
 const blocked=await f.call('/conversations/'+id+'/plan-confirmations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:'{}'});assert.equal(blocked.response.status,503);
});
test('v56 migration preserves populated v55 conversations and rolls back a late title migration failure',()=>{
 const db=new DatabaseSync(':memory:'),m=readMigrations().filter(v=>v.version<=56);try{applyMigrations(db,m,'desktop.migration',1,55);db.prepare("INSERT INTO conversations(conversation_id,owner_id,client_id,title,execution_mode,state,created_at,updated_at) VALUES(?,?,?,?,'PLAN','IDLE',?,?)").run('conv_preserved','user_1',randomUUID(),'已保存的任务',new Date().toISOString(),new Date().toISOString());
 const before=db.prepare('SELECT * FROM conversations').all(),schema=db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all(),broken=m.map(v=>v.version===56?{...v,sql:v.sql+'\nSELECT * FROM desktop_late_failure;'}:v);
 assert.throws(()=>applyMigrations(db,broken,'desktop.migration'));assert.deepEqual(db.prepare('SELECT * FROM conversations').all(),before);assert.deepEqual(db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all(),schema);applyMigrations(db,m,'desktop.migration');const [{title_kind,...saved}]=db.prepare('SELECT * FROM conversations').all();assert.equal(title_kind,'INPUT');assert.deepEqual(saved,{...before[0]});assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
