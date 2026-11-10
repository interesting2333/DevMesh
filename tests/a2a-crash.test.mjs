import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryFixture,prepareDispatch } from './fixtures/a2a-data.mjs';

for(const mode of ['after-receipt','after-claim'])test('real receiver death '+mode+' preserves task and prevents duplicate activation',async t=>{
 const f=await registryFixture(t),p=await prepareDispatch(f,f.registry);await f.local.close();
 const config=join(f.root,'a2a-crash.json');writeFileSync(config,JSON.stringify({options:f.options,mode,request:p.request}));
 const child=fork(fileURLToPath(new URL('./fixtures/a2a-crash-controller.mjs',import.meta.url)),[config],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});let errors='',receipt;child.stderr.on('data',b=>{errors+=b;});
 try{receipt=await Promise.race([once(child,'message').then(([v])=>v),once(child,'exit').then(([code])=>{throw new Error('Controller exited '+code+': '+errors);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Receiver cutpoint timeout: '+errors)),10000);timer.unref();})]);assert.equal(receipt.stage,mode);}
 finally{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}}
 const lock=JSON.parse(readFileSync(f.options.dataRoot+'.node.writer.lock','utf8'));await f.reopen({recoveryToken:lock.token});
 const recovery=await f.storage.request('recoverAcceptedWork',{});assert.equal(recovery.reconcileCount,mode==='after-claim'?1:0);
 const original=await f.storage.request('acceptA2AWork',p.request);assert.equal(original.taskId,receipt.taskId);
 const claims=await f.storage.request('claimAcceptedWork',{endpointId:p.request.endpointId,workerId:'runtime.restarted'});assert.equal(claims.length,mode==='after-claim'?0:1);
 const info=await f.storage.request('inspect',{});assert.equal(info.counts.a2a_tasks,1);assert.equal(info.counts.delegation_inbox,1);assert.equal(info.counts.accepted_work,1);
});
