import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { openStorage } from '../packages/storage-sqlite/dist/index.mjs';
import { fixture, content, project, planned, admission, meta, plan, requirements } from './fixtures/storage-data.mjs';
const rejects = (promise, code) => assert.rejects(promise, error=>error.code===code);

test('real Worker owns a migrated WAL/FULL/foreign-key connection',async t=>{
  const {storage}=await fixture(t), info=await storage.request('inspect',{});
  assert.equal(info.version,3); assert.ok(info.workerThreadId>0); assert.equal(Object.keys(info.counts).length,32);
  assert.deepEqual(info.pragmas,{journal_mode:'wal',foreign_keys:1,synchronous:2,busy_timeout:5000});
  assert.deepEqual(info.foreignKeyErrors,[]);
  await rejects(storage.request('exec',{sql:'DROP TABLE projects'}),'METHOD_NOT_ALLOWED');
  await rejects(storage.request('getRun',{runId:'run_01',sql:'SELECT 1'}),'SCHEMA_INVALID');
});

test('new database requires explicit create; store mismatch and second writer are rejected',async t=>{
  const f=await fixture(t);
  await rejects(openStorage(f.options),'STORAGE_LOCKED');
  await f.storage.close();
  await rejects(openStorage({...f.options,storeId:'8dd7eb2b-dde5-4151-851c-0e1f0771e80f'}),'STORE_IDENTITY_MISMATCH');
  const reopened=await openStorage(f.options); await reopened.close();
  await rejects(openStorage({...f.options,databasePath:f.options.databasePath+'.absent'}),'DATABASE_NOT_FOUND');
  await rejects(openStorage({...f.options,create:true}),'DATABASE_ALREADY_EXISTS');
});

test('creation survives reopen and identical keys return the original result before new checks',async t=>{
  const f=await fixture(t), p=await project(f.storage,f.root);
  assert.deepEqual(await f.storage.request('createProjectWithRun',p.input),p.receipt);
  await rejects(f.storage.request('createProjectWithRun',{...p.input,name:'different'}),'IDEMPOTENCY_KEY_REUSED');
  await f.storage.close(); const again=await f.reopen();
  assert.deepEqual(await again.request('lookupOperation',p.input.meta),p.receipt);
  assert.deepEqual(await again.request('createProjectWithRun',p.input),p.receipt);
  const info=await again.request('inspect',{}); assert.equal(info.counts.projects,1); assert.equal(info.counts.events,1); assert.equal(info.counts.outbox,1);
});

test('paused Run still occupies project slot and a failed create rolls back all dependent rows',async t=>{
  const {storage,root}=await fixture(t), p=await project(storage,root);
  const paused=await storage.request('setControlIntent',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',action:'pause'});
  assert.equal(paused.result.controlGate,'PAUSED');
  const before=await storage.request('inspect',{}), request={...p.input,meta:meta(),projectId:p.projectId,kind:'ITERATION'};
  await rejects(storage.request('createProjectWithRun',request),'STORAGE_CONSTRAINT');
  assert.deepEqual((await storage.request('inspect',{})).counts,before.counts);
  assert.equal(await storage.request('lookupOperation',request.meta),null);
});

test('plan confirmation rejects missing/old versions and admission requires confirmation',async t=>{
  const {storage,root}=await fixture(t), p=await project(storage,root), draft=plan(), req=requirements();
  const planContentHash=await content(storage,draft,root);
  const publish={meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash};
  const receipt=await storage.request('publishPlan',publish), ctx={...p,draft,requirements:req};
  await rejects(storage.request('admitWorks',await admission(storage,ctx)),'PLAN_NOT_CONFIRMED');
  const confirm={meta:meta(p.runId),runId:p.runId,planRevision:1,requirementRevision:1,reviewHash:receipt.result.reviewHash};
  await rejects(storage.request('confirmPlan',confirm),'PRECONDITION_REQUIRED');
  await rejects(storage.request('confirmPlan',{...confirm,ifMatch:'"r1"'}),'PRECONDITION_FAILED');
  await rejects(storage.request('confirmPlan',{...confirm,ifMatch:'"r2"',reviewHash:'f'.repeat(64)}),'PLAN_SUPERSEDED');
  const current={...confirm,ifMatch:'"r2"'};
  const saved=await storage.request('confirmPlan',current);
  assert.deepEqual(await storage.request('confirmPlan',current),saved);
});

test('competing admission requests create one Attempt with atomic grant/slot/Outbox',async t=>{
  const {storage,root}=await fixture(t), context=await planned(storage,root), request=await admission(storage,context);
  const settled=await Promise.allSettled([storage.request('admitWorks',request),storage.request('admitWorks',{...request,meta:meta(context.runId)})]);
  assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(settled.find(r=>r.status==='rejected').reason.code,'PRECONDITION_FAILED');
  const info=await storage.request('inspect',{});
  assert.equal(info.counts.attempts,1); assert.equal(info.counts.role_slots,1); assert.equal(info.counts.execution_grants,1); assert.equal(info.counts.outbox,3);
});

test('same-role and total slot limits roll back the whole batch',async t=>{
  const {storage,root}=await fixture(t), context=await planned(storage,root,['developer','tester','architect','developer']);
  await rejects(storage.request('admitWorks',await admission(storage,context,[0,3])),'STORAGE_CONSTRAINT');
  assert.equal((await storage.request('inspect',{})).counts.attempts,0);
  await storage.request('admitWorks',await admission(storage,context,[0,1]));
  const before=(await storage.request('inspect',{})).counts;
  await rejects(storage.request('admitWorks',await admission(storage,context,[2])),'STORAGE_CONSTRAINT');
  assert.deepEqual((await storage.request('inspect',{})).counts,before);
});

test('unknown Attempt retains slot after restart and retry needs original outcome evidence',async t=>{
  const f=await fixture(t), context=await planned(f.storage,f.root), admitted=await f.storage.request('admitWorks',await admission(f.storage,context));
  const attemptId=admitted.result.attemptIds[0];
  await f.storage.request('transitionAttempt',{meta:meta(context.runId),runId:context.runId,attemptId,expectedState:'RESERVED',state:'OUTCOME_UNKNOWN'});
  await f.storage.close(); const reopened=await f.reopen();
  assert.equal((await reopened.request('getAttempt',{attemptId})).state,'OUTCOME_UNKNOWN');
  await rejects(reopened.request('admitWorks',await admission(reopened,context)),'ACTIVE_ATTEMPT_EXISTS');
  await rejects(reopened.request('transitionAttempt',{meta:meta(context.runId),runId:context.runId,attemptId,expectedState:'OUTCOME_UNKNOWN',state:'FAILED'}),'RECONCILIATION_EVIDENCE_REQUIRED');
  assert.equal((await reopened.request('inspect',{})).counts.role_slots,1);
});

test('paused epoch prevents resumed work and stale requirement fingerprint rolls back admission',async t=>{
  const {storage,root}=await fixture(t), ctx=await planned(storage,root), request=await admission(storage,ctx);
  request.works[0].inputManifest.requirements[0].sha256='f'.repeat(64);
  await rejects(storage.request('admitWorks',request),'INPUT_BASIS_CHANGED');
  const admitted=await storage.request('admitWorks',await admission(storage,ctx)), attemptId=admitted.result.attemptIds[0];
  await storage.request('transitionAttempt',{meta:meta(ctx.runId),runId:ctx.runId,attemptId,expectedState:'RESERVED',state:'SUBMITTED'});
  const run=await storage.request('getRun',{runId:ctx.runId});
  await storage.request('setControlIntent',{meta:meta(ctx.runId),runId:ctx.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  await rejects(storage.request('transitionAttempt',{meta:meta(ctx.runId),runId:ctx.runId,attemptId,expectedState:'SUBMITTED',state:'WORKING'}),'ADMISSION_CLOSED');
  assert.equal((await storage.request('getRun',{runId:ctx.runId})).controlGate,'PAUSING');
});

test('terminal attempts cannot resurrect; later attempt number advances',async t=>{
  const {storage,root}=await fixture(t), ctx=await planned(storage,root), admitted=await storage.request('admitWorks',await admission(storage,ctx));
  const attemptId=admitted.result.attemptIds[0];
  await storage.request('transitionAttempt',{meta:meta(ctx.runId),runId:ctx.runId,attemptId,expectedState:'RESERVED',state:'FAILED'});
  await rejects(storage.request('transitionAttempt',{meta:meta(ctx.runId),runId:ctx.runId,attemptId,expectedState:'FAILED',state:'WORKING'}),'ATTEMPT_STATE_CONFLICT');
  const next=await storage.request('admitWorks',await admission(storage,ctx));
  assert.equal((await storage.request('getAttempt',{attemptId:next.result.attemptIds[0]})).attemptNo,2);
});

test('admission cannot omit an assigned requirement even when all supplied hashes match',async t=>{
  const {storage,root}=await fixture(t),p=await project(storage,root),draft=plan(),req=requirements();
  const extra=structuredClone(req.requirements[0]);extra.id='requirement_additional';req.requirements.push(extra);
  draft.works[0].requirementIds.push(extra.id);
  const planContentHash=await content(storage,draft,root);
  const published=await storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash});
  await storage.request('confirmPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:published.result.reviewHash});
  const request=await admission(storage,{...p,draft,requirements:req});
  request.works[0].inputManifest.requirements=request.works[0].inputManifest.requirements.filter(ref=>ref.requirementId!==extra.id);
  await rejects(storage.request('admitWorks',request),'INPUT_REQUIREMENTS_MISSING');
  assert.equal((await storage.request('inspect',{})).counts.attempts,0);
});

test('terminal Run stays immutable, cancellation needs a saved intent and completion has no shortcut',async t=>{
  const {storage,root}=await fixture(t),p=await project(storage,root);
  const finish={meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',outcome:'CANCELLED',reason:'user-request'};
  await rejects(storage.request('finishRun',finish),'CANCEL_INTENT_REQUIRED');
  await rejects(storage.request('finishRun',{...finish,outcome:'COMPLETED'}),'SCHEMA_INVALID');
  await storage.request('setControlIntent',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',action:'cancel'});
  await storage.request('finishRun',{...finish,ifMatch:'"r2"'});
  await rejects(storage.request('setControlIntent',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r3"',action:'pause'}),'RUN_TERMINAL');
  assert.equal((await storage.request('getRun',{runId:p.runId})).terminalOutcome,'CANCELLED');
});

test('event cursor is stable and contains historical versions instead of current state',async t=>{
  const {storage,root}=await fixture(t), ctx=await planned(storage,root);
  await storage.request('admitWorks',await admission(storage,ctx,[0,1]));
  const first=await storage.request('listEvents',{runId:ctx.runId,limit:2});
  const second=await storage.request('listEvents',{runId:ctx.runId,afterSeq:first.nextCursor,limit:200});
  const events=[...first.events,...second.events];
  assert.deepEqual(events.map(e=>e.seq),[1,2,3,4,5]);
  assert.equal(events[0].planRevision,null); assert.equal(events[1].planRevision,1); assert.equal(events[0].resourceRevision,1);
  assert.equal((await storage.request('listEvents',{runId:ctx.runId,afterSeq:second.nextCursor})).events.length,0);
  await rejects(storage.request('listEvents',{runId:ctx.runId,limit:201}),'SCHEMA_INVALID');
});

test('expired Outbox lease enters reconciliation without resending business work',async t=>{
  const {storage,root}=await fixture(t); await project(storage,root);
  const [lease]=await storage.request('claimOutbox',{workerId:'sender_1',leaseMs:100});
  await rejects(storage.request('settleOutbox',{outboxId:lease.outboxId,workerId:'sender_other',deliveryAttempt:lease.deliveryAttempt,outcome:'ACKED'}),'OUTBOX_LEASE_CHANGED');
  await new Promise(resolve=>setTimeout(resolve,130));
  assert.deepEqual(await storage.request('claimOutbox',{workerId:'sender_2'}),[]);
  await rejects(storage.request('settleOutbox',{outboxId:lease.outboxId,workerId:'sender_1',deliveryAttempt:lease.deliveryAttempt,outcome:'ACKED'}),'OUTBOX_LEASE_CHANGED');
  const info=await storage.request('inspect',{}); assert.equal(info.counts.runs,1); assert.equal(info.counts.outbox,1);
});

test('queue is bounded before send and close drains accepted requests idempotently',async t=>{
  const {storage}=await fixture(t,{queueCapacity:1});
  const first=storage.request('inspect',{});
  await rejects(storage.request('inspect',{}),'STORAGE_OVERLOADED');
  await first;
  const pending=storage.request('inspect',{}), closing=storage.close();
  await pending; await Promise.all([closing,storage.close()]);
  await rejects(storage.request('inspect',{}),'STORAGE_CLOSED');
});

test('SQLite lock waiting stays in Worker and forced termination reports unknown pending result',async t=>{
  const f=await fixture(t);
  const blocker=new DatabaseSync(f.options.databasePath); blocker.exec('BEGIN IMMEDIATE');
  const writing=f.storage.request('registerContent',{contentHash:'e'.repeat(64),byteSize:1,mimeType:'text/plain'});
  let tick=false; await new Promise(resolve=>setTimeout(()=>{tick=true;resolve();},50)); assert.equal(tick,true);
  const rejected=assert.rejects(writing,error=>error.code==='OUTCOME_UNKNOWN');
  const terminated=f.storage.terminate();
  blocker.exec('ROLLBACK'); blocker.close();
  await terminated; await rejected;
});

test('formal foreign keys reject missing/cross-run input and immutable snapshots protect history',async t=>{
  const f=await fixture(t), a=await planned(f.storage,f.root), b=await project(f.storage,f.root);
  await f.storage.close(); const db=new DatabaseSync(f.options.databasePath); db.exec('PRAGMA foreign_keys=ON');
  try {
  assert.throws(()=>db.prepare('UPDATE user_tasks SET request_artifact_id=? WHERE task_id=?').run(b.artifactId,a.taskId),/FOREIGN KEY/);
  assert.throws(()=>db.prepare('UPDATE runs SET origin_run_id=? WHERE run_id=?').run(b.runId,a.runId),/FOREIGN KEY/);
  assert.throws(()=>db.prepare("UPDATE plan_revisions SET content_json='{}' WHERE run_id=?").run(a.runId),/IMMUTABLE/);
  assert.throws(()=>db.prepare('DELETE FROM requirement_revisions WHERE run_id=?').run(a.runId),/IMMUTABLE/);
  assert.equal(JSON.parse(readFileSync(new URL('../packages/storage-sqlite/migrations/manifest.json',import.meta.url))).length,3);
  } finally { db.close(); }
});
