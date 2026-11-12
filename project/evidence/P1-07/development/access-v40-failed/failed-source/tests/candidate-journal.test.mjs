import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createDomain} from '../packages/storage-sqlite/dist/domain.mjs';
import {applyMigrations,readMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {canonical,hash,meta} from './fixtures/storage-data.mjs';
import {candidateFixture} from './fixtures/candidate-data.mjs';

// Actual migrated SQLite and private Worker handlers. Git/ref/ACK proofs below
// are explicit DB fixtures; a separate real adapter suite must prove those I/O.
const operationId=()=> 'op_'+randomUUID().replaceAll('-','');
const original=r=>({principalId:r.principalId,operationId:r.operationId,requestHash:r.requestHash});
const query=r=>({principalId:r.principalId,operationId:r.operationId});
const manifest=(commit,tree='e'.repeat(40))=>{const facts={commit,tree,files:[],byteSize:0};return {...facts,sha256:hash(canonical(facts))};};
async function fixture(t,options){const f=await candidateFixture(t,options);await f.complete(0);await f.complete(1);return f;}
const begin=(f,overrides={})=>f.storage.request('beginCandidateIntegration',{...f.subject,operationId:operationId(),...overrides});
async function prepareStep(f,r,ordinal,{clean=true}={}){
 const input={...original(r),ordinal},step=await f.storage.request('beginCandidateStep',input);
 const prepared=await f.storage.request('prepareCandidateStep',{...input,bases:[f.base],tree:'e'.repeat(40),clean,reportSha256:hash(canonical({ours:step.ours,theirs:step.theirs,clean}))});return prepared;
}
async function acknowledgeStep(f,r,s){const p=s.preparation;return f.storage.request('acknowledgeCandidateStep',{...original(r),ordinal:s.ordinal,proof:{repositoryIdentity:f.identity,commit:p.commit,tree:p.tree,ref:p.ref}});}
async function completeSteps(f,r){let last;for(let ordinal=0;ordinal<r.sourceCount;ordinal++){last=await prepareStep(f,r,ordinal);const sent=await f.storage.request('markCandidateStepSent',{...original(r),ordinal});assert.equal(sent.send,true);last=await acknowledgeStep(f,r,last);}return last;}
async function prepareFinal(f,r){const last=await completeSteps(f,r);return f.storage.request('prepareCandidateIntegration',{...original(r),manifest:manifest(last?.preparation.commit??f.base,last?.preparation.tree)});}
function ack(f,r){return {repositoryIdentity:f.identity,refs:r.updates.map(({ref,commit})=>({ref,commit})),manifestSha256:r.manifest.sha256};}
async function completeFinal(f,r){const prepared=await prepareFinal(f,r);const sent=await f.storage.request('markCandidateIntegrationSent',original(prepared));assert.equal(sent.send,true);return f.storage.request('acknowledgeCandidateIntegration',{...original(prepared),acknowledgement:ack(f,prepared)});}
async function pause(f){const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});}

test('candidate journal owns an exact subject, preserves membership checks and keeps unknown operations exclusive',async t=>{
 const f=await fixture(t),r=await begin(f);assert.equal(r.state,'BUILDING');assert.equal(r.sourceCount,2);assert.equal((await f.storage.request('beginCandidateIntegration',{...f.subject,operationId:r.operationId})).created,false);
 await assert.rejects(begin(f),{code:'CANDIDATE_RECONCILIATION_REQUIRED'});
 await assert.rejects(f.storage.request('beginCandidateIntegration',{...f.subject,purpose:'work-input',workId:f.draft.works[2].workId,operationId:r.operationId}),{code:'IDEMPOTENCY_KEY_REUSED'});
 await assert.rejects(begin(f,{commit:'a'.repeat(40)}),{code:'SCHEMA_INVALID'});
 f.run("INSERT INTO project_members(project_id,principal_id,role,created_at) SELECT project_id,'another.user',role,created_at FROM project_members WHERE principal_id='user_1'");
 await assert.rejects(f.storage.request('getCandidateIntegration',{...query(r),principalId:'another.user'}),{code:'CANDIDATE_INTEGRATION_NOT_FOUND'});
 f.run("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",f.p.projectId);
 await assert.rejects(f.storage.request('getCandidateIntegration',query(r)),{code:'FORBIDDEN'});
});

test('candidate steps serialize exact parents and final acknowledgement preserves both sources without accepting release',async t=>{
 const f=await fixture(t),r=await begin(f);assert.equal(await f.storage.request('getCandidateIntegrationStep',{...query(r),ordinal:0}),null);
 await assert.rejects(f.storage.request('beginCandidateStep',{...original(r),ordinal:1}),{code:'CANDIDATE_STEP_ORDER_INVALID'});
 const first=await prepareStep(f,r,0),p=first.preparation;assert.equal(first.ours,f.base);assert.equal(first.theirs,f.sources[0].commit);assert.match(p.commitBody,new RegExp('parent '+first.ours+'\nparent '+first.theirs+'\n'));
 assert.equal((await f.storage.request('markCandidateStepSent',{...original(r),ordinal:0})).send,true);assert.equal((await f.storage.request('markCandidateStepSent',{...original(r),ordinal:0})).send,false);
 await assert.rejects(f.storage.request('acknowledgeCandidateStep',{...original(r),ordinal:0,proof:{repositoryIdentity:f.identity,commit:p.commit,tree:'a'.repeat(40),ref:p.ref}}),{code:'CANDIDATE_STEP_ACK_UNPROVEN'});
 await acknowledgeStep(f,r,first);const second=await prepareStep(f,r,1);assert.equal(second.ours,p.commit);assert.equal(second.theirs,f.sources[1].commit);await f.storage.request('markCandidateStepSent',{...original(r),ordinal:1});await acknowledgeStep(f,r,second);
 await assert.rejects(f.storage.request('prepareCandidateIntegration',{...original(r),manifest:manifest(f.base)}),{code:'CANDIDATE_MANIFEST_UNPROVEN'});
 const prepared=await f.storage.request('prepareCandidateIntegration',{...original(r),manifest:manifest(second.preparation.commit)});assert.equal(prepared.updates.length,3);assert.equal(prepared.updates[2].expected,null);
 assert.equal((await f.storage.request('markCandidateIntegrationSent',original(r))).send,true);assert.equal((await f.storage.request('markCandidateIntegrationSent',original(r))).send,false);
 const complete=await f.storage.request('acknowledgeCandidateIntegration',{...original(r),acknowledgement:ack(f,prepared)});assert.equal(complete.state,'ACKNOWLEDGED');assert.equal(complete.acknowledgedSteps,2);
 assert.deepEqual(await f.storage.request('acknowledgeCandidateIntegration',{...original(r),acknowledgement:ack(f,prepared)}),complete);
 assert.equal((await f.storage.request('getQualifiedCandidateSnapshot',f.subject)).operationId,r.operationId);assert.equal(f.get('SELECT commit_sha FROM managed_candidate_heads WHERE run_id=?',f.p.runId).commit_sha,second.preparation.commit);
 assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>f.run("UPDATE candidate_integration_steps SET ours=? WHERE operation_id=? AND ordinal=0",f.sources[1].commit,r.operationId),/CANDIDATE_STEP_IMMUTABLE/);
 assert.throws(()=>f.run('DELETE FROM candidate_integration_sources WHERE operation_id=?',r.operationId),/CANDIDATE_SOURCE_IMMUTABLE/);
});

test('a paused prepared result cannot send and can be abandoned only before its original ref was sent',async t=>{
 const f=await fixture(t),r=await begin(f),step=await prepareStep(f,r,0);await pause(f);
 await assert.rejects(f.storage.request('markCandidateStepSent',{...original(r),ordinal:0}),{code:'CANDIDATE_ADMISSION_CLOSED'});
 const failed=await f.storage.request('failUnsentCandidateIntegration',{...original(r),errorCode:'CANDIDATE_BASIS_CHANGED'});assert.equal(failed.state,'FAILED');assert.equal((await f.storage.request('getCandidateIntegrationStep',{...query(r),ordinal:0})).state,'ABANDONED');
 assert.deepEqual((await f.storage.request('getCandidateIntegrationStep',{...query(r),ordinal:0})).preparation,step.preparation);
 await assert.rejects(begin(f),{code:'CANDIDATE_ADMISSION_CLOSED'});
 // DB fixture only: completed resume; old execution authority is never reused.
 f.run("UPDATE runs SET control_gate='OPEN' WHERE run_id=?",f.p.runId);const fresh=await begin(f);assert.notEqual(fresh.basisSha256,r.basisSha256);
});

test('a sent step remains unknown across handler reconstruction and pause until original proof arrives',async t=>{
 const f=await fixture(t),r=await begin(f),s=await prepareStep(f,r,0);await f.storage.request('markCandidateStepSent',{...original(r),ordinal:0});await pause(f);
 const reopened=createDomain(f.db);assert.equal(reopened.execute('getCandidateIntegrationStep',{...query(r),ordinal:0}).state,'REF_SENT');
 assert.equal(reopened.execute('markCandidateStepSent',{...original(r),ordinal:0}).send,false);
 await assert.rejects(f.storage.request('failUnsentCandidateIntegration',{...original(r),errorCode:'do_not_bypass_unknown'}),{code:'CANDIDATE_EFFECT_UNRESOLVED'});
 await acknowledgeStep(f,r,s);await assert.rejects(f.storage.request('beginCandidateStep',{...original(r),ordinal:1}),{code:'CANDIDATE_ADMISSION_CLOSED'});
 assert.equal((await f.storage.request('failUnsentCandidateIntegration',{...original(r),errorCode:'CANDIDATE_BASIS_CHANGED'})).state,'FAILED');
});

test('the final CAS has one sender, can record original success after pause and requires fresh qualification after resume',async t=>{
 const f=await fixture(t),r=await begin(f),prepared=await prepareFinal(f,r);await f.storage.request('markCandidateIntegrationSent',original(r));await pause(f);
 assert.equal((await f.storage.request('markCandidateIntegrationSent',original(r))).send,false);
 await assert.rejects(f.storage.request('failUnsentCandidateIntegration',{...original(r),errorCode:'do_not_discard_sent_cas'}),{code:'CANDIDATE_EFFECT_UNRESOLVED'});
 const complete=await f.storage.request('acknowledgeCandidateIntegration',{...original(r),acknowledgement:ack(f,prepared)});assert.equal(complete.state,'ACKNOWLEDGED');
 await assert.rejects(f.storage.request('getQualifiedCandidateSnapshot',f.subject),{code:'CANDIDATE_ADMISSION_CLOSED'});
 f.run("UPDATE runs SET control_gate='OPEN' WHERE run_id=?",f.p.runId);await assert.rejects(f.storage.request('getQualifiedCandidateSnapshot',f.subject),{code:'CANDIDATE_SNAPSHOT_UNAVAILABLE'});
 assert.equal((await f.storage.request('getCandidateIntegration',query(r))).state,'ACKNOWLEDGED');assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);
});

test('an exact Work snapshot proves downstream ancestry and never moves the global Run candidate',async t=>{
 const f=await candidateFixture(t,{configureDraft(draft){draft.works[1].dependencies=[{workId:draft.works[0].workId,requiredOutcome:'success'}];draft.works[1].inputRefs=[{kind:'output',workId:draft.works[0].workId,outputSlot:'implementation.commit'}];}});
 await f.complete(0);const r=await begin(f,{purpose:'work-input',workId:f.draft.works[1].workId}),complete=await completeFinal(f,r);
 assert.equal(complete.updates.length,2);assert.equal(f.get('SELECT count(*) n FROM managed_candidate_heads').n,0);assert.equal(complete.sourceCount,1);
 await f.complete(1,{codeBase:complete.manifest.commit});const current=await f.read();assert.equal(current.sources.length,2);assert.equal(current.sources[1].baseCommit,complete.manifest.commit);
 await assert.rejects(f.storage.request('getQualifiedCandidateSnapshot',f.subject),{code:'CANDIDATE_SNAPSHOT_UNAVAILABLE'});
});

test('a computed conflict cannot become a candidate or close before durable conflict materials are acknowledged',async t=>{
 const f=await fixture(t),r=await begin(f),conflict=await prepareStep(f,r,0,{clean:false});assert.equal(conflict.state,'CONFLICT_PENDING');assert.equal(conflict.preparation.commit,null);
 await assert.rejects(f.storage.request('markCandidateStepSent',{...original(r),ordinal:0}),{code:'CANDIDATE_STEP_UNPREPARED'});
 await assert.rejects(f.storage.request('prepareCandidateStep',{...original(r),ordinal:0,bases:[f.base],tree:'e'.repeat(40),clean:true,reportSha256:conflict.preparation.reportSha256}),{code:'CANDIDATE_STEP_IMMUTABLE'});
 await assert.rejects(f.storage.request('failUnsentCandidateIntegration',{...original(r),errorCode:'do_not_drop_conflict'}),{code:'CANDIDATE_EFFECT_UNRESOLVED'});
 await assert.rejects(begin(f),{code:'CANDIDATE_RECONCILIATION_REQUIRED'});assert.equal(f.get('SELECT count(*) n FROM managed_candidate_heads').n,0);
});

test('a known rejected final CAS preserves its exact adapter proof and never adopts an unexpected physical head',async t=>{
 const f=await fixture(t),r=await begin(f),prepared=await prepareFinal(f,r);await f.storage.request('markCandidateIntegrationSent',original(r));
 const rejection={...original(r),originalRefsAbsent:true,gitChildExited:true,observedHead:'d'.repeat(40)};
 await assert.rejects(f.storage.request('recordCandidateCasRejection',{...rejection,originalRefsAbsent:false}),{code:'SCHEMA_INVALID'});
 await assert.rejects(f.storage.request('recordCandidateCasRejection',{...rejection,observedHead:prepared.manifest.commit}),{code:'CANDIDATE_EFFECT_UNRESOLVED'});
 const failed=await f.storage.request('recordCandidateCasRejection',rejection);assert.equal(failed.state,'FAILED');assert.equal(failed.failureProof.observedHead,rejection.observedHead);assert.equal(f.get('SELECT count(*) n FROM managed_candidate_heads').n,0);
 assert.deepEqual(await f.storage.request('recordCandidateCasRejection',rejection),failed);
 await assert.rejects(f.storage.request('recordCandidateCasRejection',{...rejection,observedHead:null}),{code:'CANDIDATE_FAILURE_IMMUTABLE'});
 assert.equal((await begin(f)).expectedHead,null);assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);
});

test('promotion reuses exact original manifest and steps without relabeling them as a new merge',async t=>{
 const f=await fixture(t),origin=await begin(f,{purpose:'work-input',workId:f.draft.works[2].workId}),done=await completeFinal(f,origin),request={...f.subject,operationId:operationId(),originOperationId:origin.operationId},r=await f.storage.request('beginCandidateIntegration',request);
 assert.equal(r.originOperationId,origin.operationId);assert.equal(r.acknowledgedSteps,0);
 await assert.rejects(f.storage.request('beginCandidateStep',{...original(r),ordinal:0}),{code:'CANDIDATE_PROMOTION_HAS_ORIGINAL_STEPS'});
 const retained=await f.storage.request('getCandidateIntegrationManifest',query(origin));
 await assert.rejects(f.storage.request('prepareCandidateIntegration',{...original(r),manifest:manifest(f.base)}),{code:'CANDIDATE_PROMOTION_MANIFEST_CHANGED'});
 const prepared=await f.storage.request('prepareCandidateIntegration',{...original(r),manifest:retained});await f.storage.request('markCandidateIntegrationSent',original(r));
 const result=await f.storage.request('acknowledgeCandidateIntegration',{...original(r),acknowledgement:ack(f,prepared)});assert.deepEqual(result.manifest,done.manifest);assert.equal(result.acknowledgedSteps,0);
 assert.equal(f.get('SELECT count(*) n FROM candidate_integration_steps WHERE operation_id=?',r.operationId).n,0);
 assert.throws(()=>f.run('UPDATE candidate_integrations SET origin_operation_id=NULL WHERE operation_id=?',r.operationId),/CANDIDATE_PROMOTION_IMMUTABLE/);
 await assert.rejects(f.storage.request('beginCandidateIntegration',{...request,originOperationId:r.operationId}),{code:'IDEMPOTENCY_KEY_REUSED'});
 assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('a smaller dependency closure cannot be promoted as the complete final source set',async t=>{
 const f=await fixture(t),origin=await begin(f,{purpose:'work-input',workId:f.draft.works[0].workId});assert.equal(origin.sourceCount,0);await completeFinal(f,origin);
 await assert.rejects(begin(f,{originOperationId:origin.operationId}),{code:'CANDIDATE_PROMOTION_UNPROVEN'});
 assert.equal(f.get('SELECT count(*) n FROM candidate_integrations').n,1);assert.equal(f.get('SELECT count(*) n FROM managed_candidate_heads').n,0);
});

test('migration 26 preserves old journals and operation request identity',()=>{
 const db=new DatabaseSync(':memory:'),migrations=readMigrations(),storeId=randomUUID();db.exec('PRAGMA foreign_keys=ON');try{
  applyMigrations(db,migrations,storeId,1,25);const old=db.prepare('SELECT version,name,sha256 FROM schema_migrations ORDER BY version').all();assert.equal(applyMigrations(db,migrations,storeId,1,26),26);
  assert.deepEqual(db.prepare('SELECT version,name,sha256 FROM schema_migrations WHERE version<=25 ORDER BY version').all(),old);
  assert.equal(db.prepare('PRAGMA table_info(candidate_integrations)').all().find(c=>c.name==='origin_operation_id').notnull,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});

test('migration 16 preserves version 15 data and the original migration history',()=>{
 const db=new DatabaseSync(':memory:'),migrations=readMigrations(),storeId=randomUUID();db.exec('PRAGMA foreign_keys=ON');try{
  applyMigrations(db,migrations,storeId,1,15);const contentHash='a'.repeat(64);db.prepare("INSERT INTO content_objects(content_hash,byte_size,storage_key,mime_type,state,created_at) VALUES(?,0,?,'text/plain','READY',?)").run(contentHash,'sha256/aa/'+contentHash,new Date().toISOString());
  const old=db.prepare('SELECT version,name,sha256 FROM schema_migrations ORDER BY version').all();assert.equal(applyMigrations(db,migrations,storeId,1,16),16);
  assert.deepEqual(db.prepare('SELECT version,name,sha256 FROM schema_migrations WHERE version<=15 ORDER BY version').all(),old);assert.equal(db.prepare('SELECT content_hash FROM content_objects').get().content_hash,contentHash);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
