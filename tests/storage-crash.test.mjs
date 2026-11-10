import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fixture, content, meta, planned, admission } from './fixtures/storage-data.mjs';
import { openStorage } from '../packages/storage-sqlite/dist/index.mjs';

async function crashed(t, mode) {
  const f=await fixture(t);
  const contentHash=await content(f.storage,'受控崩溃测试需求',f.root);
  const context=mode==='after-unknown'?await planned(f.storage,f.root):undefined;
  const admitted=context?await admission(f.storage,context):undefined;
  const request=context?.input??{meta:meta(),name:'崩溃验证',baseCommit:'b'.repeat(40),contentHash,clientMessageId:'9930fa54-99c6-4cc6-bd70-79e9c6f49b07'};
  await f.storage.close();
  const config={mode,options:f.options,request,context,admission:admitted,marker:join(f.root,'cutpoint.txt'),controlMeta:meta('control')};
  const configPath=join(f.root,'crash-config.json');writeFileSync(configPath,JSON.stringify(config));
  const child=fork(fileURLToPath(new URL('./fixtures/storage-crash-controller.mjs',import.meta.url)),[configPath],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});
  let errors='';child.stderr.on('data',data=>{errors+=data;});
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
  const cutpoint=await Promise.race([once(child,'message').then(([message])=>message),once(child,'exit').then(([code])=>{throw new Error('Crash controller exited '+code+': '+errors);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Crash cutpoint timed out: '+errors)),10000);timer.unref();})]);
  assert.equal(cutpoint.stage,mode==='before-commit'?'before-commit':'after-commit');
  const exited=once(child,'exit');assert.equal(child.kill('SIGKILL'),true);await exited;
  assert.ok(readFileSync(config.marker,'utf8'));
  return {...f,request,config};
}

test('real process death before COMMIT rolls back project, operation, event and Outbox together',async t=>{
  const f=await crashed(t,'before-commit');
  const offline=new DatabaseSync(f.options.databasePath);offline.exec('DROP TRIGGER test_fault_before_event');offline.close();
  const storage=await f.reopen(),info=await storage.request('inspect',{});
  for(const table of ['projects','user_tasks','runs','operations','input_messages','events','outbox'])assert.equal(info.counts[table],0,table);
  assert.equal(await storage.request('lookupOperation',f.request.meta),null);
  const first=await storage.request('createProjectWithRun',f.request);
  assert.deepEqual(await storage.request('createProjectWithRun',f.request),first);
});

test('real process death after COMMIT recovers the exact original operation without duplicate creation',async t=>{
  const f=await crashed(t,'after-commit');
  await assert.rejects(openStorage(f.options),error=>error.code==='STORAGE_LOCKED');
  const lock=JSON.parse(readFileSync(f.options.databasePath+'.writer.lock','utf8'));
  const storage=await f.reopen({recoveryToken:lock.token});
  const original=await storage.request('lookupOperation',f.request.meta);assert.ok(original);
  assert.deepEqual(await storage.request('createProjectWithRun',f.request),original);
  const info=await storage.request('inspect',{});assert.equal(info.counts.projects,1);assert.equal(info.counts.events,1);assert.equal(info.counts.outbox,1);
});

test('pause saved before controller death remains paused after explicit lock recovery',async t=>{
  const f=await crashed(t,'after-pause');
  const lock=JSON.parse(readFileSync(f.options.databasePath+'.writer.lock','utf8'));
  const storage=await f.reopen({recoveryToken:lock.token});
  const project=(await storage.request('lookupOperation',f.request.meta)).result;
  const run=await storage.request('getRun',{runId:project.runId});
  assert.equal(run.controlGate,'PAUSED');assert.equal(run.runEpoch,2);
  assert.ok(await storage.request('lookupOperation',f.config.controlMeta));
});

test('real migration CLI creates no implicit DB and exits only after releasing its Worker',async t=>{
  const f=await fixture(t);await f.storage.close();
  const script=fileURLToPath(new URL('../scripts/db-migrate.mjs',import.meta.url));
  const child=spawn(process.execPath,[script,'--db',f.options.databasePath,'--store-id',f.options.storeId],{stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',data=>{output+=data;});
  const [code]=await once(child,'exit');assert.equal(code,0);assert.equal(JSON.parse(output).version,5);
  const reopened=await f.reopen();assert.equal((await reopened.request('inspect',{})).version,5);
});

test('unknown attempt survives controller death and still blocks a second dispatch',async t=>{
  const f=await crashed(t,'after-unknown');
  const lock=JSON.parse(readFileSync(f.options.databasePath+'.writer.lock','utf8'));
  const storage=await f.reopen({recoveryToken:lock.token});
  const admitted=await storage.request('lookupOperation',f.config.admission.meta);
  const attemptId=admitted.result.attemptIds[0];
  assert.equal((await storage.request('getAttempt',{attemptId})).state,'OUTCOME_UNKNOWN');
  await assert.rejects(storage.request('admitWorks',await admission(storage,f.config.context)),error=>error.code==='ACTIVE_ATTEMPT_EXISTS');
  assert.equal((await storage.request('inspect',{})).counts.role_slots,1);
  assert.ok(await storage.request('lookupOperation',f.config.controlMeta));
});
