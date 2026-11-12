import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DeepSeekProvider,estimateTokens,RoleRegistry,roleSchemas } from '../packages/agent-runtime/dist/index.mjs';
export const modelCapabilities={revision:'fixture.v1',contextTokens:32768,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'};
const request={messages:[{role:'system',content:'Return JSON.'},{role:'user',content:'检查资料'}],tools:[],maxOutputTokens:2048,jsonOutput:true};
const response=(message={role:'assistant',content:'{"done":true}'},reason='stop')=>({id:'chat_fixture_1',model:'fixture-model',choices:[{index:0,finish_reason:reason,message}],usage:{prompt_tokens:32,completion_tokens:10}});
async function fixture(t,handle){const server=createServer(handle);t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const config={providerId:'deepseek',endpoint:'http://127.0.0.1:'+server.address().port,model:'fixture-model',credentialRef:'test.provider',capabilities:modelCapabilities,connectTimeoutMs:2000,requestTimeoutMs:3000};return {config,server,provider:new DeepSeekProvider(config,async()=>'local-test-credential')};}

test('four roles resolve explicit frozen provider/model/schema and reject incompatible configuration',async t=>{
 const f=await fixture(t,(_req,res)=>res.end(JSON.stringify(response()))),registry=new RoleRegistry([f.provider]);
 const base={revision:'v1',provider:'deepseek',model:'fixture-model',promptArtifactId:'artifact_prompt',allowedTools:[],maxSteps:40,contextLimitTokens:8192,outputReserveTokens:2048,requestTimeoutMs:3000,maxReadOnlyRetries:2};
 for(const [role,outputSchemaId] of Object.entries(roleSchemas)){const resolved=registry.resolve({...base,role,outputSchemaId});assert.equal(resolved.provider,f.provider);assert.ok(Object.isFrozen(resolved.role));assert.ok(Object.isFrozen(resolved.role.allowedTools));}
 assert.throws(()=>registry.resolve({...base,role:'developer',outputSchemaId:roleSchemas.tester}));
 assert.throws(()=>registry.resolve({...base,role:'developer',outputSchemaId:roleSchemas.developer,model:'different-model'}),e=>e.code==='MODEL_CONFIGURATION_MISMATCH');
 assert.throws(()=>new RoleRegistry([f.provider,f.provider]),/Duplicate/);
});

test('real HTTP completion sends explicit model and thinking mode, returns public projection and provider usage',async t=>{
 let recorded;const f=await fixture(t,async(req,res)=>{let bytes='';for await(const chunk of req)bytes+=chunk;recorded={body:JSON.parse(bytes),auth:req.headers.authorization,path:req.url};res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response({role:'assistant',content:'{"done":true}',reasoning_content:'private chain text',api_key:'never persist'})));});
 const result=await f.provider.complete(request);assert.equal(result.content,'{"done":true}');assert.equal(result.cost,null);assert.equal(result.usage.source,'provider');assert.equal(recorded.auth,'Bearer local-test-credential');assert.equal(recorded.path,'/chat/completions');assert.deepEqual(recorded.body.thinking,{type:'disabled'});assert.equal(recorded.body.model,'fixture-model');assert.equal(JSON.stringify(result).includes('private chain text'),false);assert.equal(JSON.stringify(result).includes('never persist'),false);
});
test('complete tool arguments survive transport and truncation remains explicitly incomplete',async t=>{
 const f=await fixture(t,(_req,res)=>res.end(JSON.stringify(response({role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:'repo_read',arguments:'{"path":"README.md"}'}}]},'tool_calls'))));
 const result=await f.provider.complete({...request,tools:[{name:'repo_read',description:'read repository',parameters:{type:'object'}}]});assert.equal(result.toolCalls[0].arguments,'{"path":"README.md"}');assert.equal(result.finishReason,'tool_calls');
});
test('missing credentials and declared context limits prevent any network request',async t=>{
 let calls=0;const f=await fixture(t,(_req,res)=>{calls++;res.end(JSON.stringify(response()));});
 const missing=new DeepSeekProvider(f.config,async()=>undefined);await assert.rejects(missing.complete(request),e=>e.code==='MODEL_NOT_CONFIGURED'&&e.outcome==='not-sent');
 await assert.rejects(f.provider.complete({...request,messages:[{role:'user',content:'x'.repeat(40000)}]}),e=>e.code==='CONTEXT_LIMIT');assert.equal(calls,0);assert.ok(estimateTokens('中文')>=Buffer.byteLength('中文'));
 assert.throws(()=>new DeepSeekProvider({...f.config,capabilities:{...modelCapabilities,verification:'VERIFIED'}},async()=>''));
});
test('HTTP failures discard provider error bodies and do not automatically retry',async t=>{
 let calls=0;const f=await fixture(t,(_req,res)=>{calls++;res.statusCode=429;res.end('secret credential and provider stack details');});
 await assert.rejects(f.provider.complete(request),e=>e.code==='MODEL_RATE_LIMITED'&&e.retryable&&!e.message.includes('secret'));assert.equal(calls,1);
});
test('timeout, abort and truncated JSON report unknown requests without replay',async t=>{
 const f=await fixture(t,(_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{"id":"unfinished');});
 const fast=new DeepSeekProvider({...f.config,requestTimeoutMs:50},async()=>'local-test-credential');await assert.rejects(fast.complete(request),e=>e.code==='MODEL_TIMEOUT'&&e.outcome==='unknown');
 const abort=new AbortController();abort.abort();await assert.rejects(f.provider.complete(request,abort.signal),e=>e.code==='MODEL_ABORTED'&&e.outcome==='not-sent');
});
test('response schema, duplicate tool calls and size budgets fail before any consumer can execute tools',async t=>{
 let value=response({role:'assistant',content:null,tool_calls:[1,2].map(()=>({id:'duplicate',type:'function',function:{name:'repo_read',arguments:'{}'}}))},'tool_calls');
 const f=await fixture(t,(_req,res)=>res.end(JSON.stringify(value)));
 await assert.rejects(f.provider.complete(request),e=>e.code==='MODEL_TOOL_CALLS_INVALID');value={...response(),model:'different-model'};await assert.rejects(f.provider.complete(request),e=>e.code==='MODEL_ID_MISMATCH');
 value=response({role:'assistant',content:'x'.repeat(8000)});const bounded=new DeepSeekProvider({...f.config,maximumResponseBytes:1024},async()=>'local-test-credential');await assert.rejects(bounded.complete(request),e=>e.code==='MODEL_RESPONSE_TOO_LARGE');
});
