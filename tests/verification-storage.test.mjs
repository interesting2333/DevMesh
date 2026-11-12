import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {qualityStorageFixture} from './fixtures/quality-storage.mjs';
import {canonical,hash,meta} from './fixtures/storage-data.mjs';

test('quality verification freezes original policy, exact candidate basis, original jobs and immutable calculation',async t=>{
 const f=await qualityStorageFixture(t);assert.equal(f.record.qualification,'CURRENT');assert.equal(f.record.basis.sourceIntegrationOperationId,f.get('SELECT operation_id FROM candidate_integrations WHERE work_id=?',f.record.basis.workId).operation_id);
 assert.deepEqual(await f.storage.request('beginQualityVerification',f.begin),await f.read());await assert.rejects(f.storage.request('beginQualityVerification',{...f.begin,allocationOperationId:'op_changed'}),{code:'QUALITY_REQUEST_CHANGED'});
 await assert.rejects(f.complete(),{code:'QUALITY_MATERIAL_UNAVAILABLE'});await f.prepareResult();const finished=await f.complete();assert.equal(finished.state,'EVALUATED');assert.equal(finished.evaluation.automaticStatus,'PASS');assert.deepEqual(await f.complete(),finished);
 assert.equal(f.get('SELECT count(*) n FROM quality_verifications').n,1);assert.equal(f.get('SELECT count(*) n FROM quality_origins').n,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>f.run('UPDATE quality_verifications SET evaluation_json=?','{}'),/QUALITY_VERIFICATION_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM quality_verifications'),/QUALITY_VERIFICATION_RETAINED/);assert.throws(()=>f.run('UPDATE quality_policies SET policy_json=?','{}'),/QUALITY_POLICY_IMMUTABLE/);
 const altered=structuredClone(f.evaluation);altered.checks.find(c=>c.coverage).coverage.lines.covered=1;await assert.rejects(f.declare({kind:'RESULT',evaluation:altered,sha256:hash(canonical(altered)),byteSize:Buffer.byteLength(canonical(altered))}),{code:'QUALITY_MATERIAL_IMMUTABLE'});
});
test('quality content registration and its business reference commit atomically and survive a lost ACK',async t=>{
 const f=await qualityStorageFixture(t),row=f.rows[0];f.db.exec("CREATE TRIGGER inject_quality_reference BEFORE UPDATE OF content_hash ON quality_materials BEGIN SELECT RAISE(ABORT,'INJECTED_QUALITY_REFERENCE'); END");
 await assert.rejects(f.put(row),/INJECTED_QUALITY_REFERENCE/);assert.equal(f.get('SELECT 1 FROM content_objects WHERE content_hash=?',row.descriptor.sha256),undefined);assert.equal(f.get('SELECT content_hash FROM quality_materials WHERE material_key=?','source').content_hash,null);const original=f.get('SELECT write_id FROM object_write_operations WHERE expected_hash=?',row.descriptor.sha256).write_id;
 f.db.exec('DROP TRIGGER inject_quality_reference');assert.equal((await f.content.recoverPublished()).recovered.length,1);await f.put(row);assert.equal(f.get('SELECT write_id FROM object_write_operations WHERE expected_hash=?',row.descriptor.sha256).write_id,original);await assert.rejects(f.storage.request('beginContentDeletion',{contentHash:row.descriptor.sha256}),{code:'CONTENT_REFERENCED'});
 await assert.rejects(f.storage.request('beginObjectWrite',{meta:{principalId:'user_1',scopeId:f.bound.operationId,idempotencyKey:randomUUID()},target:{kind:'qualityMaterial',operationId:f.bound.operationId,materialKey:'source'},expectedHash:row.descriptor.sha256,expectedSize:row.descriptor.byteSize,mimeType:'application/json'}),{code:'QUALITY_MATERIAL_WRITE_CHANGED'});
 await f.prepareResult();assert.equal((await f.complete()).evaluation.automaticStatus,'PASS');
});
test('known failed execution remains immutable FAIL with original failure counts and cannot claim PASS',async t=>{
 const f=await qualityStorageFixture(t,{failed:true});await f.prepareResult();const result=await f.complete();assert.equal(result.evaluation.automaticStatus,'FAIL');assert.equal(result.evaluation.checks.find(c=>c.tests).tests.failed,1);
 const g=await qualityStorageFixture(t,{failed:true});for(const row of g.rows)await g.put(row);const forged=structuredClone(g.evaluation);for(const c of forged.checks){c.status='PASS';c.codes=[];if(c.tests)c.tests={passed:1,failed:0,skipped:0,missing:0};}forged.automaticStatus='PASS';await assert.rejects(g.declare({kind:'RESULT',evaluation:forged,sha256:hash(canonical(forged)),byteSize:Buffer.byteLength(canonical(forged))}),{code:'QUALITY_EXECUTION_FAILED'});
});
test('current membership guards collection and project readers see original bytes without gaining write authority',async t=>{
 const f=await qualityStorageFixture(t),row=f.rows[0];await f.put(row);f.run("INSERT INTO project_members(project_id,principal_id,role,created_at) VALUES(?,'reader.quality','viewer',?)",f.p.projectId,new Date().toISOString());
 assert.equal((await f.read('reader.quality')).operationId,f.bound.operationId);assert.equal(Buffer.from(await f.content.readBytes('reader.quality',{kind:'qualityMaterial',operationId:f.bound.operationId,materialKey:'source'})).toString(),f.bytes.get('source').toString());
 await assert.rejects(f.storage.request('completeQualityVerification',{...f.bound,principalId:'reader.quality'}),{code:'QUALITY_NOT_FOUND'});f.run("DELETE FROM project_members WHERE principal_id='reader.quality'");await assert.rejects(f.read('reader.quality'),{code:'QUALITY_NOT_FOUND'});
 f.run("UPDATE project_members SET role='viewer' WHERE principal_id='user_1'");await assert.rejects(f.put(row),{code:'QUALITY_NOT_FOUND'});await assert.rejects(f.storage.request('registerQualityPolicy',{principalId:'user_1',projectId:f.p.projectId,policy:f.q.policy}),{code:'QUALITY_NOT_FOUND'});
});
test('paused verification records original history as stale without resurrecting admission or changing accepted code',async t=>{
 const f=await qualityStorageFixture(t),accepted=f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId),run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});
 await f.prepareResult();const result=await f.complete();assert.equal(result.evaluation.automaticStatus,'PASS');assert.equal(result.qualification,'STALE');assert.equal(f.get('SELECT status FROM execution_grants WHERE attempt_id=?',f.attemptId).status,'REVOKED');assert.deepEqual(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId),accepted);
});
test('changed original source, job identity, missing profile or missing content cannot become current verification',async t=>{
 const f=await qualityStorageFixture(t);await assert.rejects(f.storage.request('declareQualityOrigin',{...f.original,execution:{...f.execution,jobId:'job_wrong'}}),{code:'QUALITY_ORIGIN_FACT_CHANGED'});
 const report=f.rows.find(r=>r.descriptor.kind==='REPORT');await assert.rejects(f.declare({...report.descriptor,sha256:'a'.repeat(64)}),{code:'QUALITY_MATERIAL_IMMUTABLE'});
 await f.prepareResult();await f.storage.request('markContentMissing',{contentHash:f.rows[0].descriptor.sha256,error:'Explicit availability withdrawal'});await assert.rejects(f.complete(),{code:'QUALITY_MATERIAL_UNAVAILABLE'});
 const g=await qualityStorageFixture(t);g.run('UPDATE pipeline_stages SET job_json=? WHERE pipeline_id=?',canonical({...g.job,executionProfile:null}),g.pipelineId);await assert.rejects(g.storage.request('declareQualityOrigin',g.original),{code:'QUALITY_ORIGIN_INCOMPLETE'});
 const h=await qualityStorageFixture(t);h.run('UPDATE works SET work_epoch=work_epoch+1 WHERE run_id=? AND work_id=?',h.p.runId,h.record.basis.workId);assert.equal((await h.read()).qualification,'STALE');
});
test('human review remains pending and known raw quality does not itself complete Work',async t=>{
 const f=await qualityStorageFixture(t,{human:true});await f.prepareResult();const result=await f.complete();assert.equal(result.evaluation.automaticStatus,'PASS');assert.equal(result.evaluation.reviewStatus,'PENDING');assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');assert.equal(f.get('SELECT count(*) n FROM verified_work_results WHERE attempt_id=?',f.attemptId).n,0);
});
test('a deletion reservation cannot acquire a quality reference and active publication cannot be collected',async t=>{
 const f=await qualityStorageFixture(t),row=f.rows[0],sha=row.descriptor.sha256,time=new Date().toISOString();
 f.insert('content_objects',{content_hash:sha,byte_size:row.descriptor.byteSize,storage_key:'sha256/'+sha.slice(0,2)+'/'+sha,mime_type:'application/json',state:'READY',created_at:time,storage_provider:'local',verified_at:time,last_error:null});
 await f.storage.request('beginContentDeletion',{contentHash:sha});await assert.rejects(f.put(row),{code:'CONTENT_CONFLICT'});assert.equal(f.get('SELECT content_hash FROM quality_materials WHERE material_key=?','source').content_hash,null);
 const original=f.get('SELECT write_id FROM object_write_operations WHERE expected_hash=?',sha).write_id;await assert.rejects(f.storage.request('finishContentDeletion',{contentHash:sha}),{code:'CONTENT_REFERENCED'});
 await f.storage.request('failObjectWrite',{principalId:'user_1',writeId:original,error:'Explicitly release failed deletion race before finishing GC'});await f.storage.request('finishContentDeletion',{contentHash:sha});await f.put(row);assert.equal(f.get('SELECT write_id FROM quality_materials WHERE material_key=?','source').write_id,original);await assert.rejects(f.storage.request('beginContentDeletion',{contentHash:sha}),{code:'CONTENT_REFERENCED'});assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('unknown original effects block completion and changed terminal Job facts cannot be reused',async t=>{
 const f=await qualityStorageFixture(t);await f.prepareResult();f.run("UPDATE pipelines SET state='RUNNING' WHERE pipeline_id=?",f.pipelineId);await assert.rejects(f.complete(),{code:'QUALITY_EFFECT_OUTCOME_UNKNOWN'});assert.equal((await f.read()).state,'PREPARED');
 f.run("UPDATE pipelines SET state='SUCCEEDED' WHERE pipeline_id=?",f.pipelineId);f.run('UPDATE pipeline_stages SET job_json=? WHERE pipeline_id=?',canonical({...f.job,exitCode:7}),f.pipelineId);await assert.rejects(f.complete(),{code:'QUALITY_ORIGIN_CHANGED'});assert.equal((await f.read()).state,'PREPARED');
});
test('durable calculation rejects rounded coverage, lowered thresholds and fabricated required test counts',async t=>{
 const f=await qualityStorageFixture(t);for(const row of f.rows)await f.put(row);
 const submit=evaluation=>f.declare({kind:'RESULT',evaluation,sha256:hash(canonical(evaluation)),byteSize:Buffer.byteLength(canonical(evaluation))});
 const rounded=structuredClone(f.evaluation);rounded.checks.find(c=>c.coverage).coverage.lines={covered:199,total:249,minimum:80,status:'PASS'};await assert.rejects(submit(rounded),{code:'QUALITY_COVERAGE_BELOW_MINIMUM'});
 const lowered=structuredClone(f.evaluation);lowered.checks.find(c=>c.coverage).coverage.lines.minimum=79;await assert.rejects(submit(lowered),{code:'QUALITY_THRESHOLD_CHANGED'});
 const missing=structuredClone(f.evaluation);missing.checks.find(c=>c.tests).tests.passed=0;await assert.rejects(submit(missing),{code:'QUALITY_TESTS_UNPROVEN'});assert.equal(f.get("SELECT 1 FROM quality_materials WHERE material_key='result'"),undefined);
});
