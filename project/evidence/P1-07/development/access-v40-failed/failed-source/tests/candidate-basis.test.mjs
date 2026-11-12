import test from 'node:test';
import assert from 'node:assert/strict';
import {admission,canonical,hash,meta,requirements} from './fixtures/storage-data.mjs';
import {candidateFixture as fixture} from './fixtures/candidate-data.mjs';

test('candidate qualification freezes both latest verified sources and the exact target dependency closure',async t=>{
 const f=await fixture(t),initial=await f.read({purpose:'work-input',workId:f.draft.works[0].workId});assert.deepEqual(initial.sources,[]);assert.equal(initial.baseCommit,f.base);
 const a=await f.complete(0),b=await f.complete(1),basis=await f.read(),{sha256,...body}=basis;
 assert.equal(hash(canonical(body)),sha256);assert.deepEqual(basis.sources.map(source=>source.archiveOperationId),[a.operationId,b.operationId]);assert.deepEqual(basis.works.map(work=>work.attemptId),[a.attemptId,b.attemptId]);assert.equal(basis.target,null);assert.equal(basis.baseCommit,f.base);
 const target=await f.read({purpose:'work-input',workId:f.draft.works[2].workId});assert.deepEqual(target.sources,basis.sources);assert.equal(target.target.workId,f.draft.works[2].workId);assert.notEqual(target.sha256,basis.sha256);
 assert.deepEqual(await f.storage.request('assertCandidateSourceBasis',{...f.subject,basisSha256:basis.sha256}),basis);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);
});
test('candidate qualification rejects unarchived, superseded, blocked and old Work generations',async t=>{
 const f=await fixture(t);await f.complete(0);await f.complete(1,{archive:false});await assert.rejects(f.read(),{code:'CANDIDATE_SOURCE_UNARCHIVED'});
 f.run('UPDATE works SET work_epoch=work_epoch+1 WHERE run_id=? AND work_id=?',f.p.runId,f.draft.works[0].workId);await assert.rejects(f.read(),{code:'CANDIDATE_DEPENDENCY_UNSATISFIED'});
 f.run('UPDATE works SET work_epoch=1,blocked_reason=? WHERE run_id=? AND work_id=?','requirements changed',f.p.runId,f.draft.works[0].workId);await assert.rejects(f.read(),{code:'CANDIDATE_DEPENDENCY_UNSATISFIED'});
});
test('candidate qualification rechecks current membership and current Run epoch after a pause',async t=>{
 const f=await fixture(t);await f.complete(0);await f.complete(1);const original=await f.read(),run=await f.storage.request('getRun',{runId:f.p.runId});
 await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});await assert.rejects(f.read(),{code:'CANDIDATE_ADMISSION_CLOSED'});
 // DB unit fixture for a completed resume. It does not test the recovery API.
 f.run("UPDATE runs SET control_gate='OPEN' WHERE run_id=?",f.p.runId);const resumed=await f.read();assert.equal(resumed.runEpoch,original.runEpoch+1);assert.deepEqual(resumed.sources,original.sources);assert.notEqual(resumed.sha256,original.sha256);
 await assert.rejects(f.storage.request('assertCandidateSourceBasis',{...f.subject,basisSha256:original.sha256}),{code:'CANDIDATE_BASIS_CHANGED'});
 f.run("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",f.p.projectId);await assert.rejects(f.read(),{code:'FORBIDDEN'});
 await assert.rejects(f.read({principalId:'another.user'}),{code:'RESOURCE_NOT_FOUND'});
});
test('candidate qualification never substitutes unrelated code and validates strict target requests',async t=>{
 const f=await fixture(t);await f.complete(0);await f.complete(1);
 await assert.rejects(f.read({purpose:'work-input'}),{code:'SCHEMA_INVALID'});await assert.rejects(f.read({workId:f.draft.works[2].workId}),{code:'SCHEMA_INVALID'});await assert.rejects(f.read({purpose:'work-input',workId:'work_unknown'}),{code:'CANDIDATE_TARGET_INVALID'});await assert.rejects(f.read({commit:'c'.repeat(40)}),{code:'SCHEMA_INVALID'});
 const request=await admission(f.storage,{...f.p,draft:f.draft,requirements:requirements()},[0]);request.works[0].inputManifest.decisionIds=[f.decisionId];await f.storage.request('admitWorks',request);
 await assert.rejects(f.read(),{code:'CANDIDATE_DEPENDENCY_UNSATISFIED'});assert.equal(f.get('SELECT count(*) n FROM source_archives').n,2);
});
test('acknowledged code containing an unrelated predecessor cannot qualify for the current graph',async t=>{
 const f=await fixture(t),a=await f.complete(0);await f.complete(1,{codeBase:a.commit});await assert.rejects(f.read(),{code:'CANDIDATE_CODE_BASIS_CHANGED'});
});
test('nonempty interface inputs require an approved current interface source authority',async t=>{
 const f=await fixture(t),ref={artifactId:f.p.artifactId,sha256:f.get('SELECT content_hash FROM artifacts WHERE artifact_id=?',f.p.artifactId).content_hash};await f.complete(0,{interfaces:[ref]});await f.complete(1);await assert.rejects(f.read(),{code:'CANDIDATE_INTERFACE_BASIS_UNAVAILABLE'});
});
test('missing current evidence cannot qualify an otherwise acknowledged source',async t=>{
 const f=await fixture(t);await f.complete(0);await f.complete(1);await f.read();f.run("UPDATE content_objects SET state='MISSING' WHERE content_hash=(SELECT content_hash FROM artifacts WHERE artifact_id=?)",f.p.artifactId);await assert.rejects(f.read(),{code:'CANDIDATE_EVIDENCE_UNAVAILABLE'});
});
