import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from '../packages/agent-runtime/node_modules/zod/index.js';
import { AgentRuntime,DeepSeekProvider,RuntimeConsumer } from '../packages/agent-runtime/dist/index.mjs';
import { registryFixture,httpFixture,prepareDispatch } from './fixtures/a2a-data.mjs';
import { meta,canonical,hash } from './fixtures/storage-data.mjs';

const capabilities={revision:'local.protocol.v1',contextTokens:32768,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'};
const final={schemaVersion:'devmesh.development-result.v1',role:'developer',baseCommit:'b'.repeat(40),resultCommit:'c'.repeat(40),changedFiles:['src/board.ts'],checkRefs:[],unverified:['Local transport fixture only'],handoffProposal:null};
const answer=(content=JSON.stringify(final),calls=[])=>({id:'local-response',model:'test.model',choices:[{index:0,finish_reason:calls.length?'tool_calls':'stop',message:{role:'assistant',content,tool_calls:calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:c.args}}))}}],usage:{prompt_tokens:50,completion_tokens:25}});
async function providerFixture(t,handle,extra={}){
 const requests=[];const server=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;requests.push(JSON.parse(body));await handle(requests,req,res);});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const provider=new DeepSeekProvider({providerId:'test.provider',endpoint:'http://127.0.0.1:'+server.address().port,model:'test.model',credentialRef:'test.model.ref',capabilities,requestTimeoutMs:120000,...extra},async()=>'local-fixture-secret');return {provider,requests};
}
async function setup(t,handle,tool,extra={}){
 let db;t.after(()=>db?.close());
 const f=await registryFixture(t),p=await providerFixture(t,handle,extra),d=await prepareDispatch(f,f.registry,{outputSchemaId:final.schemaVersion,allowedTools:tool?[tool.name]:[],requestTimeoutMs:p.provider.config.requestTimeoutMs});
 const request=f.storage.request.bind(f.storage);f.storage.request=async(method,input)=>{try{return await request(method,input);}catch(e){t.diagnostic(method+': '+e.message);throw e;}};
 db=new DatabaseSync(join(f.local.dataRoot,'db','devmesh.sqlite'));
 // Protocol fixtures use a longer initial lease to isolate runtime behavior from
 // host load. Production admission still issues the original bounded lease.
 const grant=db.prepare('SELECT * FROM execution_grants WHERE attempt_id=?').get(d.attemptId),permit=JSON.parse(grant.permit_json);permit.expiresAt=new Date(Date.now()+180000).toISOString();db.prepare('UPDATE execution_grants SET expires_at=?,permit_json=? WHERE grant_id=?').run(permit.expiresAt,canonical(permit),grant.grant_id);
 const accepted=await f.storage.request('acceptA2AWork',d.request),[c]=await f.storage.request('claimAcceptedWork',{endpointId:d.delegation.endpointId,workerId:'runtime.test',limit:1}),claim={endpointId:c.endpointId,taskId:c.taskId,workerId:c.workerId,claimToken:c.claimToken};
 const runtime=new AgentRuntime(f.storage,f.content,[p.provider],tool?[tool]:[]);
 return {...f,...p,...d,accepted,claim,runtime,db};
}
const schema=z.strictObject({path:z.string().min(1)});
const call={id:'call_1',name:'repo_read',args:'{"path":"README.md"}'};

test('real HTTP loop persists request/response/tool result, freezes config and publishes only a role candidate',async t=>{
 let executions=0,operationId,f;
 const tool={name:'repo_read',description:'Read a file',schema,effectClass:'READ',async execute(id,args){executions++;operationId=id;assert.equal(args.path,'README.md');const rows=f.db.prepare('SELECT state,response_hash FROM runtime_tool_calls').all();assert.equal(rows[0].state,'SENT');assert.ok(rows[0].response_hash);return {state:'SUCCEEDED',value:'read result'};},async query(){throw Error('Query is unnecessary');}};
 f=await setup(t,(rs,_req,res)=>res.end(JSON.stringify(rs.length===1?answer('',[call]):answer())),tool);
 const host=await f.storage.request('getExecutionHost',f.claim),result=await f.runtime.execute(f.claim);assert.equal(result.state,'completed',JSON.stringify(result));assert.equal(executions,1);assert.match(operationId,/^op_/);assert.equal(f.requests.length,2);
 assert.equal(f.requests[1].messages.at(-1).role,'tool');assert.equal(f.requests[1].messages.at(-1).tool_call_id,call.id);
 const session=await f.storage.request('getSession',{principalId:host.principalId,sessionId:result.sessionId});assert.equal(session.lastStepNo,2);
 const a=f.db.prepare('SELECT * FROM runtime_activations').get();assert.equal(a.state,'FINISHED');assert.equal(a.tokens_used,150);assert.equal(a.config_hash,hash(canonical(JSON.parse(a.config_json))));assert.ok(JSON.parse(a.config_json).toolSchemas[0].parameters);
 assert.equal((await f.storage.request('accountRuntimeModel',{activationId:host.activationId,stepNo:2})).tokensUsed,150);
 assert.throws(()=>f.db.prepare('UPDATE runtime_activations SET token_limit=token_limit+1').run(),/RUNTIME_CONFIGURATION_IMMUTABLE/);
 await assert.rejects(f.storage.request('assertRuntimeActivation',{activationId:host.activationId,reservedTokens:1}),e=>e.code==='RUNTIME_NOT_RUNNING');
 await assert.rejects(f.storage.request('markRuntimeToolSent',{activationId:host.activationId,operationId}),e=>e.code==='TOOL_ALREADY_SENT');
 assert.deepEqual(await f.storage.request('publishRuntimeResult',{activationId:host.activationId,stepNo:2,contentHash:result.candidate.sha256,output:final}),result.candidate);
 const bytes=await f.content.readText('user_1',{kind:'artifact',artifactId:result.candidate.artifactId});assert.deepEqual(JSON.parse(bytes),final);
 assert.notEqual((await f.storage.request('getAttempt',{attemptId:f.attemptId})).state,'SUCCEEDED');assert.deepEqual((await f.storage.request('inspect',{})).foreignKeyErrors,[]);
 await assert.rejects(f.storage.request('beginRuntimeActivation',{...f.claim,activationId:host.activationId,principalId:'another.user',sessionId:result.sessionId,configHash:a.config_hash,config:JSON.parse(a.config_json),maxSteps:40,tokenLimit:100000}),e=>e.code==='EXECUTION_HOST_CLAIM_CHANGED');
});
test('all complete tool arguments validate before any call can execute',async t=>{
 let executions=0;const tool={name:call.name,description:'read',schema,effectClass:'READ',async execute(){executions++;return {state:'SUCCEEDED',value:''};},async query(){return {state:'OUTCOME_UNKNOWN'};}};
 const f=await setup(t,(_r,_q,res)=>res.end(JSON.stringify(answer('',[call,{...call,id:'call_2',args:'{"path":'}]))),tool);
 const result=await f.runtime.execute(f.claim);assert.equal(result.code,'TOOL_ARGUMENTS_INVALID');assert.equal(result.state,'failed');assert.equal(executions,0);assert.equal(f.db.prepare('SELECT count(*) n FROM runtime_tool_calls').get().n,0);assert.equal(f.db.prepare('SELECT state FROM model_steps').get().state,'RESPONDED');
});
test('complete response commit failure prevents tool admission and retains model uncertainty',async t=>{
 let executions=0;const tool={name:call.name,description:'read',schema,effectClass:'READ',async execute(){executions++;return {state:'SUCCEEDED',value:''};},async query(){return {state:'OUTCOME_UNKNOWN'};}};
 const f=await setup(t,(_r,_q,res)=>res.end(JSON.stringify(answer('',[call]))),tool);
 f.db.exec("CREATE TRIGGER cut_response BEFORE UPDATE OF response_content_hash ON model_steps WHEN NEW.response_content_hash IS NOT NULL BEGIN SELECT RAISE(ABORT,'disk-cut'); END");
 const result=await f.runtime.execute(f.claim);assert.equal(result.state,'reconcile');assert.equal(executions,0);assert.equal(f.db.prepare('SELECT state FROM model_steps').get().state,'SENT');assert.equal(f.db.prepare('SELECT unknown_usage FROM runtime_activations').get().unknown_usage,1);
});
test('result message survives final acknowledgement failure and repairs operation without query or execution',async t=>{
 let executions=0,queries=0;const tool={name:call.name,description:'write',schema,effectClass:'NONIDEMPOTENT_WRITE',async execute(){executions++;return {state:'SUCCEEDED',value:{written:true}};},async query(){queries++;return {state:'OUTCOME_UNKNOWN'};}};
 const f=await setup(t,(_r,_q,res)=>res.end(JSON.stringify(answer('',[call]))),tool);
 f.db.exec("CREATE TRIGGER cut_tool_ack BEFORE UPDATE OF state ON runtime_tool_calls WHEN NEW.state='SUCCEEDED' BEGIN SELECT RAISE(ABORT,'ack-cut'); END");
 const result=await f.runtime.execute(f.claim);assert.equal(result.state,'reconcile');const host=await f.storage.request('getExecutionHost',f.claim);assert.equal(executions,1);
 f.db.exec('DROP TRIGGER cut_tool_ack');const repaired=await f.runtime.reconcileTool(host,1,call.id,tool.name);assert.equal(repaired.state,'SUCCEEDED');assert.equal(executions,1);assert.equal(queries,0);
});
test('unknown write only queries original operation and cannot be replayed on recovery',async t=>{
 let executions=0,queries=0,known=false,original;const tool={name:call.name,description:'write',schema,effectClass:'NONIDEMPOTENT_WRITE',async execute(id){executions++;original=id;throw Error('connection lost');},async query(id){queries++;assert.equal(id,original);return known?{state:'SUCCEEDED',value:'confirmed by original id'}:{state:'OUTCOME_UNKNOWN'};}};
 const f=await setup(t,(_r,_q,res)=>res.end(JSON.stringify(answer('',[call]))),tool);
 const result=await f.runtime.execute(f.claim);assert.equal(result.state,'reconcile');const host=await f.storage.request('getExecutionHost',f.claim);assert.equal(executions,1);known=true;
 assert.equal((await f.runtime.reconcileTool(host,1,call.id,tool.name)).state,'SUCCEEDED');assert.equal(executions,1);assert.equal(queries,2);
 assert.equal((await f.runtime.execute(f.claim)).code,'RUNTIME_RESUME_REQUIRES_RECONCILIATION');assert.equal(f.requests.length,1);assert.equal(executions,1);
});
test('pause during provider response closes the next tool admission',async t=>{
 let f,executions=0;const tool={name:call.name,description:'read',schema,effectClass:'READ',async execute(){executions++;return {state:'SUCCEEDED',value:''};},async query(){return {state:'OUTCOME_UNKNOWN'};}};
 f=await setup(t,async(_r,_q,res)=>{const run=await f.storage.request('getRun',{runId:f.runId});await f.storage.request('setControlIntent',{meta:meta(f.runId),runId:f.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});res.end(JSON.stringify(answer('',[call])));},tool);
 const result=await f.runtime.execute(f.claim);assert.equal(result.code,'EXECUTION_PERMIT_INVALID');assert.equal(executions,0);assert.equal(f.db.prepare('SELECT count(*) n FROM runtime_results').get().n,0);
});
test('provider timeout leaves SENT and unknown cost, rather than automatically retrying',async t=>{
 const f=await setup(t,()=>{},undefined,{requestTimeoutMs:50});const result=await f.runtime.execute(f.claim);assert.equal(result.state,'reconcile');assert.equal(result.code,'MODEL_TIMEOUT');assert.equal(f.requests.length,1);assert.equal(f.db.prepare('SELECT state FROM model_steps').get().state,'SENT');assert.equal(f.db.prepare('SELECT unknown_usage FROM runtime_activations').get().unknown_usage,1);
});
test('token reservation prevents a network call and missing provider has an explicit outcome',async t=>{
 const f=await setup(t,(_r,_q,res)=>res.end(JSON.stringify(answer())));const low=new AgentRuntime(f.storage,f.content,[f.provider],[],1);assert.equal((await low.execute(f.claim)).code,'MODEL_BUDGET_EXCEEDED');assert.equal(f.requests.length,0);
 const missing=new AgentRuntime(f.storage,f.content,[]);assert.equal((await missing.execute(f.claim)).code,'MODEL_NOT_CONFIGURED');
});
test('A2A HTTP acceptance reaches optional consumer and returns durable candidate without business success',async t=>{
 let consumer;t.after(()=>consumer?.stop());const f=await httpFixture(t),p=await providerFixture(t,(_r,_q,res)=>res.end(JSON.stringify(answer())));
 const d=await prepareDispatch(f,f.registry,{outputSchemaId:final.schemaVersion});const db=new DatabaseSync(join(f.local.dataRoot,'db','devmesh.sqlite'));try{const g=db.prepare('SELECT * FROM execution_grants WHERE attempt_id=?').get(d.attemptId),permit=JSON.parse(g.permit_json);permit.expiresAt=new Date(Date.now()+180000).toISOString();db.prepare('UPDATE execution_grants SET expires_at=?,permit_json=? WHERE grant_id=?').run(permit.expiresAt,canonical(permit),g.grant_id);}finally{db.close();}consumer=new RuntimeConsumer(f.storage,new AgentRuntime(f.storage,f.content,[p.provider]),['builtin.developer'],'runtime.http');await consumer.start();
 const accepted=await f.client.sendMessage(d.params);let task;for(let i=0;i<150;i++){task=await f.client.getTask({id:accepted.id});if(task.status?.state===3)break;await delay(20);}
 assert.equal(task.status.state,3);assert.equal(task.artifacts.length,1);assert.equal(p.requests.length,1);assert.notEqual((await f.storage.request('getAttempt',{attemptId:d.attemptId})).state,'SUCCEEDED');
 await consumer.stop();
});
