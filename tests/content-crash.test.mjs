import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFixture,createSession,messageTarget,meta,digest } from './fixtures/content-data.mjs';

for(const mode of ['after-stage','after-publish','after-commit'])test('real controller death '+mode+' preserves original bytes/reference semantics',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f),bytes=Buffer.from('进程崩溃时的原始正文 😀');
  const input={meta:meta(),target:messageTarget(ctx),expectedHash:digest(bytes),expectedSize:bytes.length,mimeType:'text/plain; charset=utf-8'};
  await f.local.close();
  const marker=join(f.root,'cutpoint.txt'),configPath=join(f.root,'crash.json');writeFileSync(configPath,JSON.stringify({options:f.options,mode,marker,input,body:bytes.toString('base64')}));
  const child=fork(fileURLToPath(new URL('./fixtures/content-crash-controller.mjs',import.meta.url)),[configPath],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});
  let errors='';child.stderr.on('data',b=>{errors+=b;});
  try{
    const result=await Promise.race([once(child,'message').then(([v])=>v),once(child,'exit').then(([code])=>{throw new Error('Controller exited '+code+': '+errors);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Crash cutpoint timeout: '+errors)),10000);timer.unref();})]);
    assert.equal(result.stage,mode);
  }finally{if(child.exitCode===null && child.signalCode===null){const exited=once(child,'exit');child.kill('SIGKILL');await exited;}}
  assert.equal(readFileSync(marker,'utf8'),mode);
  const lock=JSON.parse(readFileSync(f.options.dataRoot+'.node.writer.lock','utf8'));await f.reopen({recoveryToken:lock.token});
  const before=await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId});assert.equal(before.messages.length,mode==='after-commit'?1:0);
  const recovered=await f.content.recoverPublished();
  if(mode==='after-stage'){
    assert.equal(recovered.recovered.length,0);assert.equal(recovered.pending.length,1);
    assert.equal(existsSync(join(f.local.dataRoot,'artifacts/sha256',input.expectedHash.slice(0,2),input.expectedHash)),false);
  }else assert.equal(recovered.recovered.length,mode==='after-publish'?1:0);
  const original=await f.content.put(input,bytes);assert.equal(original.state,'REGISTERED');
  const messages=await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId});assert.equal(messages.messages.length,1);
  assert.equal(messages.messages[0].messageId,original.result.messageId);
  assert.equal(await f.content.readText('user_1',{kind:'message',messageId:original.result.messageId}),bytes.toString('utf8'));
});
