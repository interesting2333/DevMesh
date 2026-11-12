import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkVerifier} from '../packages/result-verifier/dist/index.mjs';
import {workVerificationFixture,workOp} from './fixtures/work-verification.mjs';
import {meta,canonical,hash} from './fixtures/storage-data.mjs';
const service=f=>new WorkVerifier(f.storage,f.content);
const list=(f,principalId='user_1')=>f.storage.request('listVerifiedFindings',{principalId,runId:f.p.runId});
function repairDraft(draft){
 const tester=draft.works[2],fix=structuredClone(draft.works[0]),reverify=structuredClone(tester);
 Object.assign(fix,{workId:'work_fix',writeScope:['src/fix.ts'],dependencies:[{workId:tester.workId,requiredOutcome:'completed-with-findings'}],inputRefs:[{kind:'output',workId:tester.workId,outputSlot:'verification.report'}],completionChecks:[{kind:'commit-resolved'}]});
 Object.assign(reverify,{workId:'work_reverify',dependencies:[{workId:fix.workId,requiredOutcome:'success'}],inputRefs:[{kind:'output',workId:fix.workId,outputSlot:'implementation.commit'}]});
 draft.works.push(fix,reverify);
}
test('formal failed Work atomically derives original findings and replay preserves exact failures',async t=>{
 const f=await workVerificationFixture(t,{failed:true}),result=await service(f).verify(f.subject),findings=await list(f);
 assert.equal(result.verification.state,'APPLIED');assert.equal(findings.length,2);assert.deepEqual(new Set(findings.map(x=>x.failure.check.kind)),new Set(['command','tests']));
 for(const finding of findings){const failure=finding.failure;assert.equal(finding.state,'OPEN');assert.equal(finding.revision,1);assert.equal(finding.sourceAttemptId,f.attemptId);assert.equal(failure.workVerificationId,f.subject.operationId);assert.equal(failure.qualityOperationId,f.bound.operationId);assert.equal(failure.targetCommit,f.output.targetCommit);assert.equal(failure.checkConfigHash,f.policy.configHash);assert.equal(failure.result.status,'FAIL');assert.deepEqual(failure.reproduction[0].producer.command,f.q.policy.producers[0].command);assert.equal(failure.reproduction[0].origin.execution.jobId,f.execution.jobId);assert.ok(failure.materials.some(m=>m.key==='report.tests.front'));assert.equal(hash(canonical(failure)),finding.failureSha256);assert.equal(finding.history[0].value.origin,'independent-quality');assert.throws(()=>f.run('UPDATE verified_findings SET failure_json=? WHERE issue_id=?','{}',finding.issueId),/VERIFIED_FINDING_IMMUTABLE/);}
 assert.deepEqual(await service(f).verify(f.subject),result);assert.deepEqual(await list(f),findings);assert.equal(f.get('SELECT count(*) n FROM issue_revisions').n,2);assert.equal((await f.read()).evaluation.automaticStatus,'FAIL');assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('model-only findings and missing preview do not become independently verified repair inputs',async t=>{
 const f=await workVerificationFixture(t,{mutateOutput:o=>o.defects.push({id:'model.claim',severity:'HIGH',description:'Unconfirmed candidate claim',evidenceRefs:[{artifactId:o.coverageRef.artifactId,sha256:o.coverageRef.sha256}]})});
 const result=await service(f).verify(f.subject);assert.equal(result.verification.evaluation.outcome,'completed-with-findings');assert.equal((await f.read()).evaluation.automaticStatus,'PASS');assert.deepEqual(await list(f),[]);
});
test('finding insertion fault rolls formal completion back and original retry creates one batch',async t=>{
 const f=await workVerificationFixture(t,{failed:true});f.db.exec("CREATE TRIGGER cut_finding BEFORE INSERT ON verified_findings BEGIN SELECT RAISE(ABORT,'finding-cut'); END");
 await assert.rejects(service(f).verify(f.subject),/finding-cut/);assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');assert.equal(f.get('SELECT state FROM work_verifications WHERE operation_id=?',f.subject.operationId).state,'READY');assert.equal(f.get('SELECT count(*) n FROM issues').n,0);assert.equal(f.get('SELECT count(*) n FROM verified_work_results WHERE attempt_id=?',f.attemptId).n,0);
 f.db.exec('DROP TRIGGER cut_finding');await service(f).verify(f.subject);assert.equal((await list(f)).length,2);assert.equal(f.get('SELECT count(*) n FROM issue_operations').n,2);assert.equal(f.get('SELECT count(*) n FROM work_verifications WHERE attempt_id=?',f.attemptId).n,1);
});
test('trusted fix link requires the confirmed forward findings edge and original command receipt is stable',async t=>{
 const f=await workVerificationFixture(t,{failed:true,configureDraft:repairDraft});await service(f).verify(f.subject);const finding=(await list(f))[0],base={principalId:'user_1',runId:f.p.runId,issueId:finding.issueId,issueRevision:1};
 await assert.rejects(f.storage.request('linkVerifiedFindingFix',{...base,operationId:workOp(),fixWorkId:f.draft.works[0].workId}),{code:'VERIFIED_FINDING_FIX_WORK_INVALID'});
 const input={...base,operationId:workOp(),fixWorkId:'work_fix'},receipt=await f.storage.request('linkVerifiedFindingFix',input);assert.equal(receipt.issueRevision,2);assert.deepEqual(await f.storage.request('linkVerifiedFindingFix',input),receipt);await assert.rejects(f.storage.request('linkVerifiedFindingFix',{...input,fixWorkId:f.draft.works[1].workId}),{code:'IDEMPOTENCY_KEY_REUSED'});
 const row=await f.storage.request('getVerifiedFinding',{principalId:'user_1',runId:f.p.runId,issueId:finding.issueId});assert.equal(row.state,'FIX_LINKED');assert.equal(row.history.length,2);assert.deepEqual(row.failure,finding.failure);
 // Historical seeded source success lacks the new immutable APPLIED proof.
 await assert.rejects(f.storage.request('recordVerifiedFindingResult',{...base,issueRevision:2,operationId:workOp(),fixAttemptId:f.sources[0].attemptId,verificationAttemptId:f.attemptId}),{code:'VERIFIED_FINDING_RESULT_UNPROVEN'});assert.equal((await f.storage.request('getVerifiedFinding',{principalId:base.principalId,runId:base.runId,issueId:base.issueId})).revision,2);
});
test('members can read original finding history after pause but cannot mutate or impersonate an owner',async t=>{
 const f=await workVerificationFixture(t,{failed:true,configureDraft:repairDraft});await service(f).verify(f.subject);const finding=(await list(f))[0],viewer='viewer.finding';f.insert('project_members',{project_id:f.p.projectId,principal_id:viewer,role:'viewer',created_at:new Date().toISOString()});
 assert.deepEqual(await list(f,viewer),await list(f));await assert.rejects(f.storage.request('linkVerifiedFindingFix',{principalId:viewer,runId:f.p.runId,operationId:workOp(),issueId:finding.issueId,issueRevision:1,fixWorkId:'work_fix'}),{code:'VERIFIED_FINDING_NOT_FOUND'});
 const input={principalId:'user_1',runId:f.p.runId,operationId:workOp(),issueId:finding.issueId,issueRevision:1,fixWorkId:'work_fix'},receipt=await f.storage.request('linkVerifiedFindingFix',input),run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});
 assert.deepEqual(await f.storage.request('linkVerifiedFindingFix',input),receipt);assert.equal((await list(f,viewer)).length,2);await assert.rejects(f.storage.request('linkVerifiedFindingFix',{...input,operationId:workOp(),issueRevision:2}),{code:'VERIFIED_FINDING_ADMISSION_CLOSED'});f.run('DELETE FROM project_members WHERE principal_id=? AND project_id=?',viewer,f.p.projectId);await assert.rejects(list(f,viewer),{code:'VERIFIED_FINDING_NOT_FOUND'});
});
