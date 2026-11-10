import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryFixture,prepareDispatch } from './fixtures/a2a-data.mjs';
import { DatabaseSync } from 'node:sqlite';
for(const mode of ['model-sent','tool-sent'])test('real Runtime SIGKILL after '+mode+' preserves uncertainty and cannot replay',async t=>{
 let notify;const cutpoint=new Promise(resolve=>notify=resolve);
 const server=createServer(async(req,res)=>{for await(const _chunk of req){/* consume actual HTTP request */}if(mode==='model-sent'){notify({stage:mode});return;}res.end(JSON.stringify({id:'crash-response',model:'test.model',choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[{id:'crash_call',type:'function',function:{name:'repo_read',arguments:'{"path":"README.md"}'}}]}}],usage:{prompt_tokens:40,completion_tokens:20}}));});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const f=await registryFixture(t),p=await prepareDispatch(f,f.registry,{outputSchemaId:'devmesh.development-result.v1',allowedTools:['repo_read']});await f.storage.request('acceptA2AWork',p.request);
 const db=new DatabaseSync(join(f.local.dataRoot,'db','devmesh.sqlite'));const g=db.prepare('SELECT * FROM execution_grants WHERE attempt_id=?').get(p.attemptId),permit=JSON.parse(g.permit_json);permit.expiresAt=new Date(Date.now()+180000).toISOString();db.prepare('UPDATE execution_grants SET expires_at=?,permit_json=? WHERE grant_id=?').run(permit.expiresAt,JSON.stringify(permit),g.grant_id);db.close();
 await f.local.close();const config=join(f.root,'runtime-crash.json');writeFileSync(config,JSON.stringify({options:f.options,endpointId:p.delegation.endpointId,provider:{providerId:'test.provider',endpoint:'http://127.0.0.1:'+server.address().port,model:'test.model',credentialRef:'fixture.key',capabilities:{revision:'fixture.v1',contextTokens:32768,maxOutputTokens:4096,toolCalls:true,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'}}}));
 const child=fork(fileURLToPath(new URL('./fixtures/runtime-crash-controller.mjs',import.meta.url)),[config],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});let errors='';child.stderr.on('data',b=>errors+=b);child.on('message',value=>notify(value));
 try{const stage=await Promise.race([cutpoint,once(child,'exit').then(([code])=>{throw Error('Runtime exited '+code+': '+errors);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Runtime cutpoint timeout: '+errors)),90000);timer.unref();})]);assert.equal(stage.stage,mode);}
 finally{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}}
 const lock=JSON.parse(readFileSync(f.options.dataRoot+'.node.writer.lock','utf8'));await f.reopen({recoveryToken:lock.token});
 assert.equal((await f.storage.request('recoverAcceptedWork',{})).reconcileCount,1);const recovery=await f.storage.request('recoverRuntimeActivations',{});assert.equal(recovery.activations,1);assert.equal(recovery.tools,mode==='tool-sent'?1:0);
 assert.equal((await f.storage.request('claimAcceptedWork',{endpointId:p.delegation.endpointId,workerId:'runtime.recovered'})).length,0);
 const session=await f.sessions.ensure('user_1',p.runId,p.attemptId),step=await f.storage.request('getModelStep',{principalId:'user_1',sessionId:session.sessionId,stepNo:1});assert.equal(step.state,mode==='model-sent'?'SENT':'RESPONDED');
 if(mode==='tool-sent')assert.equal((await f.storage.request('getRuntimeTool',{activationId:p.delegation.activationId,stepNo:1,toolCallId:'crash_call'})).state,'OUTCOME_UNKNOWN');
 assert.deepEqual(await f.storage.request('recoverRuntimeActivations',{}),{activations:0,tools:0});
});
