import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {fixture} from './fixtures/storage-data.mjs';
import {inputFixture} from './fixtures/input-data.mjs';

test('migration 7 backfills existing ownership and preserves the original project and backup',{timeout:240000},async t=>{
  const f=await fixture(t,{targetVersion:6});await f.storage.close();
  const db=new DatabaseSync(f.options.databasePath),time=new Date().toISOString();
  db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('prj_legacy','legacy_owner','旧项目',9,null,time);db.close();
  const storage=await f.reopen({targetVersion:7,backupDirectory:join(f.root,'backup')});const info=await storage.request('inspect',{});assert.equal(info.version,7);assert.equal(info.foreignKeyErrors.length,0);
  const check=new DatabaseSync(f.options.databasePath,{readOnly:true});
  try{assert.equal(check.prepare('SELECT role FROM project_members WHERE project_id=? AND principal_id=?').get('prj_legacy','legacy_owner').role,'owner');const p=check.prepare('SELECT * FROM projects WHERE project_id=?').get('prj_legacy');assert.equal(p.revision,9);assert.equal(p.created_at,time);assert.equal(p.updated_at,time);}
  finally{check.close();}
  const backup=new DatabaseSync(info.backupPath,{readOnly:true});try{assert.equal(backup.prepare('PRAGMA user_version').get().user_version,6);assert.equal(backup.prepare('SELECT revision FROM projects').get().revision,9);}finally{backup.close();}
});

test('T1 rolls back project, owner, message, processing and outbox together after a late SQL failure',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID(),body={initialRequest:{text:'事务内失败不留半项目',attachmentIds:[]},clientDraftId:randomUUID()};
  f.sql("CREATE TRIGGER test_fail_processing BEFORE INSERT ON input_processing BEGIN SELECT RAISE(ABORT,'TEST_INPUT_FAILURE'); END");
  const failed=await f.create(body,key);assert.ok(failed.response.status>=400);
  const info=await f.storage.request('inspect',{});for(const table of ['projects','project_members','user_tasks','runs','artifacts','input_messages','input_processing','input_operation_resources','events','outbox'])assert.equal(info.counts[table],0,table);
  const original=await f.call(`/operations/lookup?scope=projects.create&key=${key}`);assert.equal(original.response.status,404);
  f.sql('DROP TRIGGER test_fail_processing');const saved=await f.create(body,key);assert.equal(saved.response.status,201,JSON.stringify(saved.body));assert.equal((await f.storage.request('inspect',{})).counts.projects,1);
});

test('upload restart recovery fences partial staging and recognizes only exact published attachments',{timeout:240000},async t=>{
  const f=await inputFixture(t),principalId='user_1';
  const key=randomUUID(),claimToken=randomUUID(),claimed=await f.storage.request('claimUploadIntake',{meta:{principalId,scopeId:'uploads',idempotencyKey:key},claimToken});
  const same=await f.storage.request('claimUploadIntake',{meta:{principalId,scopeId:'uploads',idempotencyKey:key},claimToken:randomUUID()});assert.equal(same.claimed,false);assert.equal(same.intakeId,claimed.intakeId);
  await assert.rejects(f.storage.request('failUploadIntake',{principalId,intakeId:claimed.intakeId,claimToken:randomUUID(),errorCode:'UPLOAD_INVALID'}),e=>e.code==='UPLOAD_CLAIM_INVALID');
  await f.local.close();await f.reopen();
  const recovery=await f.storage.request('recoverUploadIntakes',{});assert.equal(recovery.interrupted,1);
  const state=await f.storage.request('getUploadIntake',{principalId,intakeId:claimed.intakeId});assert.equal(state.state,'INTERRUPTED');assert.equal(state.errorCode,'UPLOAD_INTERRUPTED');
  const operation=await f.storage.request('lookupInputOperation',{principalId,scopeId:'uploads',idempotencyKey:key});assert.equal(operation.status,'FAILED');
  assert.equal((await f.storage.request('inspect',{})).counts.attachments,0);
});
