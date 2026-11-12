import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {WorkVerifier} from '../packages/result-verifier/dist/index.mjs';
import {workVerificationFixture,workOp} from './fixtures/work-verification.mjs';
import {meta,canonical} from './fixtures/storage-data.mjs';
import {seedHistoricalVerification} from './fixtures/historical-verification.mjs';
const read=f=>f.storage.request('getWorkVerification',{principalId:'user_1',operationId:f.subject.operationId});
const command=row=>({meta:{principalId:row.principalId,scopeId:row.runId,idempotencyKey:row.completionKey},runId:row.runId,attemptId:row.attemptId,verificationOperationId:row.operationId,outcome:row.evaluation.outcome,evidence:{artifactId:row.artifactId,sha256:row.contentHash},outputs:row.evaluation.outputs,codeCommit:row.evaluation.codeCommit});
const put=(f,row)=>f.content.putJson({principalId:'user_1',scopeId:row.operationId,idempotencyKey:row.writeKey},{kind:'workVerification',operationId:row.operationId},row.evaluation);

test('new completion cannot trust legacy IPC success or direct successful state transition',async t=>{
 const f=await workVerificationFixture(t),old={meta:meta(f.p.runId),runId:f.p.runId,attemptId:f.attemptId,outcome:'success',evidence:f.candidate,outputs:[{slot:'verification.report',ref:f.candidate}],codeCommit:null};
 await assert.rejects(f.storage.request('recordVerifiedWork',old),{code:'WORK_VERIFICATION_REQUIRED'});
 await assert.rejects(f.storage.request('transitionAttempt',{meta:meta(f.p.runId),runId:f.p.runId,attemptId:f.attemptId,expectedState:'VERIFYING',state:'SUCCEEDED',evidenceRef:f.candidate}),{code:'WORK_VERIFICATION_REQUIRED'});
 assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');assert.equal(f.get('SELECT 1 FROM verified_work_results WHERE attempt_id=?',f.attemptId),undefined);
 // Original pre-upgrade fact and SAME original request remain readable/replayable;
 // a new key cannot create another completion using that historical exception.
 const receipt=seedHistoricalVerification(f.db,old);assert.deepEqual(await f.storage.request('recordVerifiedWork',old),receipt);
 await assert.rejects(f.storage.request('recordVerifiedWork',{...old,meta:meta(f.p.runId)}),{code:'WORK_VERIFICATION_REQUIRED'});
});
test('original candidate plus passing raw reports produces one content ACK and atomically applied success',async t=>{
 const f=await workVerificationFixture(t),service=new WorkVerifier(f.storage,f.content),result=await service.verify(f.subject),row=result.verification;
 assert.equal(row.state,'APPLIED');assert.equal(row.qualification,'CURRENT');assert.equal(row.evaluation.automaticStatus,'PASS');assert.equal(row.evaluation.outcome,'success');assert.equal(result.completion.result.state,'SUCCEEDED');
 assert.deepEqual(row.evaluation.outputs,[{slot:'verification.report',ref:f.candidate}]);assert.deepEqual(JSON.parse(await f.content.readText('user_1',{kind:'workVerification',operationId:row.operationId})),row.evaluation);
 assert.equal(f.get('SELECT kind FROM artifacts WHERE artifact_id=?',row.artifactId).kind,'work-verification');assert.equal(f.get('SELECT status FROM execution_grants WHERE attempt_id=?',f.attemptId).status,'REVOKED');
 assert.deepEqual(await service.verify(f.subject),result);assert.equal(f.get('SELECT count(*) n FROM work_verifications WHERE attempt_id=?',f.attemptId).n,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>f.run('UPDATE work_verifications SET evaluation_json=? WHERE operation_id=?','{}',row.operationId),/WORK_VERIFICATION_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM work_verifications WHERE operation_id=?',row.operationId),/WORK_VERIFICATION_RETAINED/);
 await assert.rejects(f.storage.request('beginContentDeletion',{contentHash:row.contentHash}),{code:'CONTENT_REFERENCED'});
});
test('model PASSED cannot overwrite original failed Job and reports; known failure completes with findings',async t=>{
 const f=await workVerificationFixture(t,{failed:true}),result=await new WorkVerifier(f.storage,f.content).verify(f.subject),row=result.verification;
 assert.equal(row.evaluation.automaticStatus,'FAIL');assert.equal(row.evaluation.outcome,'completed-with-findings');assert.ok(row.evaluation.checks.some(c=>c.code==='CANDIDATE_STATUS_CONTRADICTS_RAW_REPORT'));assert.equal(result.completion.result.state,'FAILED');
 assert.equal(f.get('SELECT outcome FROM verified_work_results WHERE attempt_id=?',f.attemptId).outcome,'completed-with-findings');assert.equal((await f.read()).evaluation.automaticStatus,'FAIL');assert.equal((await f.read()).qualification,'CURRENT');
 assert.deepEqual(await new WorkVerifier(f.storage,f.content).verify(f.subject),result);assert.equal(row.qualification,'CURRENT');
});
test('candidate evidence from another report and pending human checks cannot become automatic success',async t=>{
 const f=await workVerificationFixture(t,{mutateOutput:o=>{o.caseResults[0].reportRef=o.coverageRef;}}),result=await new WorkVerifier(f.storage,f.content).verify(f.subject);
 assert.equal(result.verification.evaluation.automaticStatus,'FAIL');assert.equal(result.verification.evaluation.outcome,'completed-with-findings');assert.ok(result.verification.evaluation.checks.some(c=>c.code==='CANDIDATE_REPORT_PROVENANCE_CHANGED'));
 const human=await workVerificationFixture(t,{human:true}),pending=await new WorkVerifier(human.storage,human.content).verify(human.subject);assert.equal(pending.verification.state,'READY');assert.equal(pending.verification.evaluation.automaticStatus,'PENDING');assert.equal(pending.completion,null);assert.equal(human.get('SELECT state FROM attempts WHERE attempt_id=?',human.attemptId).state,'VERIFYING');
});
test('passing raw checks cannot hide a declared unresolved finding or an unavailable preview artifact',async t=>{
 const f=await workVerificationFixture(t,{mutateOutput:o=>o.defects.push({id:'defect.declared',severity:'HIGH',description:'Explicit candidate finding requiring resolution',evidenceRefs:[{artifactId:o.coverageRef.artifactId,sha256:o.coverageRef.sha256}]})}),result=await new WorkVerifier(f.storage,f.content).verify(f.subject);
 assert.equal((await f.read()).evaluation.automaticStatus,'PASS');assert.equal(result.verification.evaluation.automaticStatus,'FAIL');assert.equal(result.verification.evaluation.outcome,'completed-with-findings');assert.ok(result.verification.evaluation.checks.some(c=>c.code==='CANDIDATE_FINDING_UNRESOLVED'));
 const preview=await workVerificationFixture(t,{mutateOutput:o=>{o.previewRef={artifactId:'artifact_missing',sha256:'a'.repeat(64),targetCommit:o.targetCommit};}}),missing=await new WorkVerifier(preview.storage,preview.content).verify(preview.subject);
 assert.equal((await preview.read()).evaluation.automaticStatus,'PASS');assert.equal(missing.verification.evaluation.automaticStatus,'MISSING');assert.equal(missing.verification.evaluation.outcome,'completed-with-findings');
});
test('a read-only member cannot make WorkVerifier read or replay as the original owner',async t=>{
 const f=await workVerificationFixture(t);await f.storage.request('beginWorkVerification',f.workBegin);f.insert('project_members',{project_id:f.p.projectId,principal_id:'viewer.work',role:'viewer',created_at:new Date().toISOString()});
 const original=f.content.readBytes.bind(f.content),reads=[];f.content.readBytes=(...args)=>{reads.push(args[0]);return original(...args);};
 await assert.rejects(new WorkVerifier(f.storage,f.content).verify({...f.subject,principalId:'viewer.work'}),{code:'WORK_VERIFICATION_NOT_FOUND'});assert.deepEqual(reads,[]);assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');
});
test('proof basis and completion payload are immutable; code/config changes and unknown original writes stay blocked',async t=>{
 const f=await workVerificationFixture(t),row=await f.storage.request('beginWorkVerification',f.workBegin);assert.deepEqual(await f.storage.request('beginWorkVerification',f.workBegin),row);
 await assert.rejects(f.storage.request('beginWorkVerification',{...f.workBegin,candidate:{...f.output,caseResults:f.output.caseResults.map(c=>({...c,status:'FAILED'}))}}),{code:'WORK_VERIFICATION_REQUEST_CHANGED'});
 await assert.rejects(f.storage.request('beginWorkVerification',{...f.workBegin,operationId:workOp(),candidate:{...f.output,targetCommit:'d'.repeat(40),coverageRef:{...f.output.coverageRef,targetCommit:'d'.repeat(40)},buildRef:{...f.output.buildRef,targetCommit:'d'.repeat(40)},caseResults:f.output.caseResults.map(c=>({...c,reportRef:{...c.reportRef,targetCommit:'d'.repeat(40)}}))}}),{code:'WORK_VERIFICATION_CANDIDATE_CHANGED'});
 assert.throws(()=>f.run('UPDATE quality_verifications SET config_hash=? WHERE operation_id=?','e'.repeat(64),f.bound.operationId),/QUALITY_VERIFICATION_IMMUTABLE/);
 await put(f,row);const ready=await read(f);await assert.rejects(f.storage.request('recordVerifiedWork',{...command(ready),outputs:[]}),{code:'WORK_VERIFICATION_RESULT_CHANGED'});
 f.run("UPDATE pipeline_stages SET state='UNKNOWN' WHERE pipeline_id=?",f.pipelineId);await assert.rejects(f.storage.request('recordVerifiedWork',command(ready)),{code:'OUTCOME_UNKNOWN'});f.run("UPDATE pipeline_stages SET state='EXITED' WHERE pipeline_id=?",f.pipelineId);
 f.run('UPDATE works SET work_epoch=work_epoch+1 WHERE run_id=? AND work_id=?',f.p.runId,f.draft.works[2].workId);await assert.rejects(f.storage.request('recordVerifiedWork',command(ready)),{code:'WORK_VERIFICATION_BASIS_STALE'});assert.equal((await read(f)).qualification,'STALE');assert.equal(f.get('SELECT 1 FROM verified_work_results WHERE attempt_id=?',f.attemptId),undefined);
});
test('missing candidate bytes or retained report bytes blocks completion before any final decision',async t=>{
 for(const kind of ['candidate','report']){const f=await workVerificationFixture(t),contentHash=kind==='candidate'?f.candidate.sha256:f.rows.find(r=>r.materialKey==='report.tests.front').descriptor.sha256,object=f.get('SELECT storage_key FROM content_objects WHERE content_hash=?',contentHash);await rm(join(f.root,'artifacts',object.storage_key));await assert.rejects(new WorkVerifier(f.storage,f.content).verify(f.subject));assert.equal(f.get('SELECT 1 FROM verified_work_results WHERE attempt_id=?',f.attemptId),undefined);assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');}
});
test('lost content/final receipts recover original keys, artifact and completion without new verification work',async t=>{
 const f=await workVerificationFixture(t),original=f.storage.request.bind(f.storage);let loseContent=true,loseCompletion=true;
 f.storage.request=async(method,input)=>{const result=await original(method,input);if(method==='commitObjectWrite'&&input&&loseContent){loseContent=false;throw Error('Content ACK lost after transaction');}if(method==='recordVerifiedWork'&&loseCompletion){loseCompletion=false;throw Error('Completion ACK lost after transaction');}return result;};
 const service=new WorkVerifier(f.storage,f.content);await assert.rejects(service.verify(f.subject),/Content ACK lost/);const ready=await read(f);assert.equal(ready.state,'READY');assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');
 await assert.rejects(service.verify(f.subject),/Completion ACK lost/);const applied=await read(f);assert.equal(applied.state,'APPLIED');assert.equal(applied.artifactId,ready.artifactId);assert.equal(applied.writeId,ready.writeId);assert.equal(applied.completionKey,ready.completionKey);
 const recovered=await service.verify(f.subject);assert.equal(recovered.completion.status,'SUCCEEDED');assert.equal(f.get('SELECT count(*) n FROM verified_work_results WHERE attempt_id=?',f.attemptId).n,1);assert.equal(f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='workVerification'").n,1);
});
test('a failed content ACK transaction leaves neither verification artifact nor half reference',async t=>{
 const f=await workVerificationFixture(t),row=await f.storage.request('beginWorkVerification',f.workBegin);
 f.db.exec("CREATE TRIGGER cut_work_ack BEFORE UPDATE OF state ON work_verifications WHEN NEW.state='READY' BEGIN SELECT RAISE(ABORT,'work-ack-cut'); END");
 await assert.rejects(put(f,row),/work-ack-cut/);assert.equal((await read(f)).state,'PREPARED');assert.equal(f.get("SELECT count(*) n FROM artifacts WHERE kind='work-verification'").n,0);assert.equal(f.get('SELECT 1 FROM content_objects WHERE content_hash=?',row.expectedHash),undefined);
 f.db.exec('DROP TRIGGER cut_work_ack');const result=await new WorkVerifier(f.storage,f.content).verify(f.subject);assert.equal(result.verification.state,'APPLIED');assert.equal(f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='workVerification'").n,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('only current owner can create/apply verification; members may inspect retained history after pause',async t=>{
 const f=await workVerificationFixture(t),row=await f.storage.request('beginWorkVerification',f.workBegin);await put(f,row);f.insert('project_members',{project_id:f.p.projectId,principal_id:'viewer.work',role:'viewer',created_at:new Date().toISOString()});
 await assert.rejects(f.storage.request('beginWorkVerification',{...f.workBegin,principalId:'viewer.work',operationId:workOp()}),{code:'WORK_VERIFICATION_NOT_FOUND'});assert.equal((await f.storage.request('getWorkVerification',{principalId:'viewer.work',operationId:row.operationId})).operationId,row.operationId);
 const current=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+current.resourceRevision+'"',action:'pause'});
 await assert.rejects(new WorkVerifier(f.storage,f.content).verify(f.subject),{code:'WORK_VERIFICATION_BASIS_STALE'});assert.equal((await read(f)).qualification,'STALE');assert.equal(canonical(JSON.parse(await f.content.readText('viewer.work',{kind:'workVerification',operationId:row.operationId}))),canonical(row.evaluation));
 f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'viewer.work');await assert.rejects(f.storage.request('getWorkVerification',{principalId:'viewer.work',operationId:row.operationId}),{code:'WORK_VERIFICATION_NOT_FOUND'});
});
