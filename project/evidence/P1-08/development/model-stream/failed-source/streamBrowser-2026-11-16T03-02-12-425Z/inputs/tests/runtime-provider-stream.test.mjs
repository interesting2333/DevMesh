import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setImmediate as turn} from 'node:timers/promises';
import {DeepSeekProvider} from '../packages/agent-runtime/dist/index.mjs';
const capabilities={revision:'sse.fixture.v1',contextTokens:32768,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'};
const request={messages:[{role:'user',content:'Return JSON.'}],tools:[],maxOutputTokens:2048,jsonOutput:true};
const chunk=(delta={},finish_reason=null,extra={})=>({id:'chat_stream_fixture',model:'fixture-model',choices:[{index:0,delta,finish_reason}],...extra});
const frame=value=>'data: '+JSON.stringify(value)+'\r\n\r\n',done='data: [DONE]\r\n\r\n';
async function fixture(t,handle,extra={}){
 const state={calls:0,requests:[]},server=createServer(async(req,res)=>{state.calls++;let body='';for await(const value of req)body+=value;state.requests.push(JSON.parse(body));res.setHeader('content-type','text/event-stream');await handle(req,res,state);});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const config={providerId:'deepseek',endpoint:'http://127.0.0.1:'+server.address().port,model:'fixture-model',credentialRef:'fixture.sse',capabilities,connectTimeoutMs:2000,requestTimeoutMs:3000,responseMode:'sse',...extra};
 return {state,config,provider:new DeepSeekProvider(config,async()=>'explicit-local-fixture')};
}

test('real SSE delivers UTF-8 content before completion, handles CRLF and terminal usage, then returns one complete response',async t=>{
 const emitted=Promise.withResolvers(),release=Promise.withResolvers();t.after(()=>release.resolve());
 const f=await fixture(t,async(_req,res)=>{const bytes=Buffer.from(': keepalive\r\n\r\n'+frame(chunk({role:'assistant',content:'中文 🧪'})));const at=bytes.indexOf(Buffer.from('中'));res.write(bytes.subarray(0,at+1));await turn();res.write(bytes.subarray(at+1));await release.promise;res.end(frame(chunk({},'stop',{usage:{prompt_tokens:12,completion_tokens:4}}))+done);});
 const deltas=[];let settled=false;const result=f.provider.complete(request,undefined,text=>{deltas.push(text);emitted.resolve();}).finally(()=>{settled=true;});await emitted.promise;assert.equal(settled,false);assert.equal(deltas.join(''),'中文 🧪');release.resolve();const value=await result;
 assert.equal(value.content,'中文 🧪');assert.deepEqual(value.usage,{inputTokens:12,outputTokens:4,source:'provider'});assert.equal(value.finishReason,'stop');assert.equal(f.state.calls,1);assert.equal(f.state.requests[0].stream,true);assert.deepEqual(f.state.requests[0].stream_options,{include_usage:true});assert.deepEqual(f.state.requests[0].thinking,{type:'disabled'});
});

test('tool argument fragments assemble once and never enter display callbacks',async t=>{
 const f=await fixture(t,(_req,res)=>res.end(frame(chunk({tool_calls:[{index:0,id:'call_1',type:'function',function:{name:'repo_read',arguments:'{"path":'}}]}))+frame(chunk({tool_calls:[{index:0,function:{arguments:'"README.md"}'}}]},'tool_calls'))+done));
 const observed=[],value=await f.provider.complete({...request,tools:[{name:'repo_read',description:'read',parameters:{type:'object'}}]},undefined,text=>observed.push(text));assert.deepEqual(observed,[]);assert.deepEqual(value.toolCalls,[{id:'call_1',name:'repo_read',arguments:'{"path":"README.md"}'}]);assert.equal(value.usage.source,'estimated');assert.equal(f.state.calls,1);
});

test('incomplete or invalid SSE has an unknown outcome and is never automatically repeated',async t=>{
 const cases=[
  ['missing DONE',frame(chunk({content:'partial'},'stop')),'MODEL_STREAM_INCOMPLETE'],
  ['missing finish',frame(chunk({content:'partial'}))+done,'MODEL_STREAM_INCOMPLETE'],
  ['identity changed',frame(chunk({content:'first'}))+frame(chunk({},'stop',{id:'another'}))+done,'MODEL_STREAM_ID_MISMATCH'],
  ['wrong model',frame(chunk({content:'foreign'},'stop',{model:'another'}))+done,'MODEL_ID_MISMATCH'],
  ['bad JSON','data: {broken}\n\n'+done,'MODEL_RESPONSE_INVALID'],
  ['invalid UTF8',Buffer.concat([Buffer.from('data: '),Buffer.from([0xff]),Buffer.from('\n\n')]),'MODEL_RESPONSE_INVALID'],
  ['reasoning rejected',frame(chunk({reasoning_content:'not public'},'stop'))+done,'MODEL_STREAM_UNSUPPORTED_DELTA'],
  ['unsupported server tool',frame(chunk({server_tool_calls:[{name:'unconfigured'}]},'stop'))+done,'MODEL_STREAM_UNSUPPORTED_DELTA'],
  ['data after finish',frame(chunk({content:'first'},'stop'))+frame(chunk({content:'later'},'stop'))+done,'MODEL_STREAM_AFTER_FINISH'],
  ['tool index gap',frame(chunk({tool_calls:[{index:1,id:'call_1',type:'function',function:{name:'tool',arguments:'{}'}}]},'tool_calls'))+done,'MODEL_TOOL_CALLS_INVALID'],
  ['duplicate tool id',frame(chunk({tool_calls:[0,1].map(index=>({index,id:'same',type:'function',function:{name:'tool',arguments:'{}'}}))},'tool_calls'))+done,'MODEL_TOOL_CALLS_INVALID'],
 ];
 for(const [name,body,code]of cases)await t.test(name,async sub=>{const observed=[],f=await fixture(sub,(_req,res)=>res.end(body));await assert.rejects(f.provider.complete(request,undefined,text=>observed.push(text)),error=>error.code===code&&error.outcome==='unknown');assert.equal(f.state.calls,1);if(['wrong model','reasoning rejected','unsupported server tool'].includes(name))assert.deepEqual(observed,[]);});
});

test('SSE response size and content type are bounded before exposing invalid content',async t=>{
 const observed=[],f=await fixture(t,(_req,res)=>res.end(frame(chunk({content:'x'.repeat(2000)},'stop'))+done),{maximumResponseBytes:1024});await assert.rejects(f.provider.complete(request,undefined,text=>observed.push(text)),e=>e.code==='MODEL_RESPONSE_TOO_LARGE'&&e.outcome==='unknown');assert.deepEqual(observed,[]);
 const wrong=await fixture(t,(_req,res)=>{res.setHeader('content-type','application/json');res.end('{}');});await assert.rejects(wrong.provider.complete(request),e=>e.code==='MODEL_RESPONSE_INVALID'&&e.outcome==='unknown');assert.equal(wrong.state.calls,1);
});

test('timeout and abort after a partial stream preserve unknown outcome without replay',async t=>{
 const f=await fixture(t,(_req,res)=>res.write(frame(chunk({content:'temporary'}))),{requestTimeoutMs:500});const deltas=[];await assert.rejects(f.provider.complete(request,undefined,text=>deltas.push(text)),e=>e.code==='MODEL_TIMEOUT'&&e.outcome==='unknown');assert.deepEqual(deltas,['temporary']);assert.equal(f.state.calls,1);
 const abort=new AbortController(),seen=Promise.withResolvers(),pending=f.provider.complete(request,abort.signal,()=>seen.resolve());await seen.promise;abort.abort();await assert.rejects(pending,e=>e.code==='MODEL_ABORTED'&&e.outcome==='unknown');assert.equal(f.state.calls,2);
});

test('a throwing display observer does not change the complete model outcome',async t=>{
 const f=await fixture(t,(_req,res)=>res.end(frame(chunk({content:'{"ok":true}'},'stop'))+done));const value=await f.provider.complete(request,undefined,()=>{throw Error('view unavailable');});assert.equal(value.content,'{"ok":true}');assert.equal(f.state.calls,1);
});

test('absent response mode retains the prior JSON configuration shape and request',async t=>{
 const f=await fixture(t,(_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'json',model:'fixture-model',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'{}'}}]}));});const config={...f.config};delete config.responseMode;const provider=new DeepSeekProvider(config,async()=>'fixture');assert.equal(Object.hasOwn(provider.config,'responseMode'),false);let observed=false;assert.equal((await provider.complete(request,undefined,()=>{observed=true;})).content,'{}');assert.equal(observed,false);assert.equal(f.state.requests[0].stream,false);assert.equal(Object.hasOwn(f.state.requests[0],'stream_options'),false);
});
