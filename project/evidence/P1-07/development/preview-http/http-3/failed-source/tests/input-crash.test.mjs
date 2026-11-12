import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {fixture,content} from './fixtures/storage-data.mjs';
import {waitForProcessMessage} from './fixtures/process.mjs';
for(const mode of ['before-commit','after-commit'])test(`real T1 controller death ${mode} preserves atomic facts and original-key recovery`,{timeout:240000},async t=>{
  const f=await fixture(t),bodyHash=await content(f.storage,'真实进程提交断点',f.root);
  const request={meta:{principalId:'user_1',scopeId:'projects.create',idempotencyKey:randomUUID()},name:'T1 崩溃验证',baseCommit:'b'.repeat(40),bodyHash,attachmentIds:[],clientDraftId:randomUUID()};
  await f.storage.close();const marker=join(f.root,'input-cutpoint.txt'),path=join(f.root,'input-crash.json');writeFileSync(path,JSON.stringify({mode,options:f.options,request,marker}));
  const child=fork(fileURLToPath(new URL('./fixtures/input-crash-controller.mjs',import.meta.url)),[path],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});let diagnostics='';child.stderr.on('data',bytes=>{diagnostics+=bytes;});
  try{assert.equal((await waitForProcessMessage(child,'Input T1 crash controller',()=>diagnostics)).stage,mode);}
  finally{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');assert.equal(child.kill('SIGKILL'),true);await exited;}}
  assert.ok(readFileSync(marker,'utf8'));
  let recoveryToken;
  if(mode==='before-commit'){const db=new DatabaseSync(f.options.databasePath);db.exec('DROP TRIGGER test_input_fault');db.close();}
  else recoveryToken=JSON.parse(readFileSync(f.options.databasePath+'.writer.lock','utf8')).token;
  const storage=await f.reopen(recoveryToken?{recoveryToken}:{}),initial=await storage.request('inspect',{});
  for(const table of ['projects','project_members','user_tasks','runs','input_messages','input_processing','events','outbox'])assert.equal(initial.counts[table],mode==='before-commit'?0:1,table);
  const original=await storage.request('lookupInputOperation',request.meta);assert.equal(original===null,mode==='before-commit');
  const first=await storage.request('createInputProject',request);if(original)assert.deepEqual(first,original);
  assert.deepEqual(await storage.request('createInputProject',request),first);
  const info=await storage.request('inspect',{});assert.equal(info.counts.projects,1);assert.equal(info.counts.outbox,1);assert.equal(info.counts.events,1);assert.equal(info.counts.input_processing,1);assert.deepEqual(info.foreignKeyErrors,[]);
});
