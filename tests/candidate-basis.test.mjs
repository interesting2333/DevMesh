import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createDomain} from '../packages/storage-sqlite/dist/domain.mjs';
import {applyMigrations,readMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {admission,canonical,content,hash,meta,plan,project,requirements} from './fixtures/storage-data.mjs';

// These tests exercise the actual migrated schema and Worker command handlers.
// Retained source facts are deliberately seeded DB fixtures, not Git transfer,
// Runtime or Runner evidence. Real Git behavior has separate integration tests.
async function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');applyMigrations(db,readMigrations(),randomUUID());t.after(()=>db.close());
 const domain=createDomain(db),storage={async request(method,input){return domain.execute(method,input);}},p=await project(storage),draft=plan(['developer','developer','tester']),req=requirements(),[left,right,tester]=draft.works;
 for(const [index,work] of draft.works.entries()){work.inputRefs=[];work.writeScope=work.role==='developer'?['src/'+index+'.ts']:[];}
 tester.dependencies=[left,right].map(work=>({workId:work.workId,requiredOutcome:'success'}));tester.inputRefs=[left,right].map(work=>({kind:'output',workId:work.workId,outputSlot:'implementation.commit'}));tester.outputSpec=[{slot:'verification.report',schemaId:'devmesh.test-result.v1'}];tester.completionChecks=[{kind:'required-tests-pass',checkId:'check_required'}];
 const planContentHash=await content(storage,draft),publication=await storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash});
 await storage.request('confirmReviewedPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:publication.result.reviewHash});
 const get=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args),insert=(table,row)=>{const keys=Object.keys(row);return run('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',...Object.values(row));};
 const time=new Date().toISOString(),identity={root:'D:\\database-fixture\\repo.git',gitDirectory:'D:\\database-fixture\\repo.git',commonDirectory:'D:\\database-fixture\\repo.git',rootDevice:'1',rootFileId:'2',gitDevice:'1',gitFileId:'2'},base='b'.repeat(40),emptyManifest=commit=>{const value={commit,tree:'e'.repeat(40),files:[],byteSize:0};return {...value,sha256:hash(canonical(value))};};
 insert('managed_repositories',{project_id:p.projectId,resource_id:'repository.unit',operation_id:'op_repository',request_hash:hash('repository'),template_commit:base,state:'READY',identity_json:canonical(identity),manifest_json:canonical(emptyManifest(base)),created_at:time,updated_at:time});
 const decisionId=get("SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind='PLAN'",p.runId).decision_id,context={...p,draft,requirements:req},sources=[];
 async function complete(index,{archive=true,interfaces=[],codeBase=base}={}){
  const input=await admission(storage,context,[index]),work=draft.works[index],oldSources=sources.filter(source=>work.dependencies.some(edge=>edge.workId===source.workId));
  input.works[0].resources=[{kind:'workspace',resourceId:'workspace.'+index+'.'+randomUUID(),access:'write'}];
  Object.assign(input.works[0].inputManifest,{decisionIds:[decisionId],interfaces,codeCommit:codeBase,artifacts:oldSources.length?[{artifactId:p.artifactId,sha256:get('SELECT content_hash FROM artifacts WHERE artifact_id=?',p.artifactId).content_hash}]:[]});
  const result=await storage.request('admitWorks',input),attemptId=result.result.attemptIds[0],a=get('SELECT * FROM attempts WHERE attempt_id=?',attemptId),grant=get('SELECT * FROM execution_grants WHERE attempt_id=?',attemptId),commit=hash(attemptId).slice(0,40),operationId='op_archive_'+index,allocationId='op_allocation_'+index,commitId='op_commit_'+index,workspaceRef=input.works[0].resources[0].resourceId;
  insert('scheduled_work',{attempt_id:attemptId,run_id:p.runId,plan_revision:1,runner_id:'runner.unit',reservation_key:randomUUID(),caller_id:'unit.scheduler'});
  for(const [expectedState,state] of [['RESERVED','SUBMITTED'],['SUBMITTED','WORKING'],['WORKING','VERIFYING']])await storage.request('transitionAttempt',{meta:meta(p.runId),runId:p.runId,attemptId,expectedState,state});
  const ref={artifactId:p.artifactId,sha256:get('SELECT content_hash FROM artifacts WHERE artifact_id=?',p.artifactId).content_hash};
  await storage.request('recordVerifiedWork',{meta:meta(p.runId),runId:p.runId,attemptId,outcome:'success',evidence:ref,outputs:work.outputSpec.map(output=>({slot:output.slot,ref})),codeCommit:commit});
  if(archive){
   const scope=canonical(work.writeScope),manifest=emptyManifest(commit),allocation={operationId:allocationId,workspaceRef,projectId:p.projectId,runId:p.runId,attemptId,activationId:grant.activation_id,grantId:grant.grant_id,runnerId:'runner.unit',kind:'development',baseCommit:codeBase,scope:work.writeScope,requestHash:hash('allocation'),state:'READY',identity,manifest:emptyManifest(codeBase),errorCode:null},repository={projectId:p.projectId,resourceId:'repository.unit',identity,state:'READY'},prepared={commit,tree:manifest.tree,ref:'refs/devmesh/operations/'+commitId,expected:null,commitBody:'DB fixture only'},original={allocation,repository,commitOperation:{operationId:commitId,prepared}},ack={commit,tree:manifest.tree,manifestSha256:manifest.sha256,repositoryIdentity:identity,archiveRef:'refs/devmesh/source-archives/'+operationId,sourceRef:'refs/devmesh/sources/'+commit};
   insert('workspace_allocations',{workspace_ref:workspaceRef,operation_id:allocationId,project_id:p.projectId,run_id:p.runId,attempt_id:attemptId,activation_id:grant.activation_id,grant_id:grant.grant_id,runner_id:'runner.unit',kind:'development',base_commit:codeBase,scope_json:scope,request_hash:hash('allocation'),state:'READY',identity_json:canonical(identity),manifest_json:canonical(emptyManifest(codeBase)),created_at:time,updated_at:time});
   insert('repo_operations',{operation_id:commitId,run_id:p.runId,attempt_id:attemptId,activation_id:grant.activation_id,grant_id:grant.grant_id,tool_name:'repo.commit',request_hash:hash('commit'),request_json:'{}',scope_json:scope,state:'SUCCEEDED',prepared_json:canonical(prepared),result_json:canonical({commit}),created_at:time,updated_at:time});
   insert('source_archives',{operation_id:operationId,allocation_operation_id:allocationId,commit_operation_id:commitId,workspace_ref:workspaceRef,project_id:p.projectId,run_id:p.runId,attempt_id:attemptId,activation_id:grant.activation_id,grant_id:grant.grant_id,request_hash:hash('archive'),basis_json:canonical(original),state:'ACKNOWLEDGED',manifest_json:canonical(manifest),acknowledgement_json:canonical(ack),created_at:time,acknowledged_at:time});
  }
  const source={workId:work.workId,attemptId,commit,operationId,admitted:a};sources.push(source);return source;
 }
 const subject={principalId:'user_1',runId:p.runId,purpose:'run-candidate'},read=(overrides={})=>storage.request('getCandidateSourceBasis',{...subject,...overrides});
 return {db,storage,p,draft,identity,base,complete,get,run,insert,read,subject,decisionId,sources};
}

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
