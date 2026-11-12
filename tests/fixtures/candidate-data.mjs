import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createDomain} from '../../packages/storage-sqlite/dist/domain.mjs';
import {applyMigrations,readMigrations} from '../../packages/storage-sqlite/dist/migrations.mjs';
import {admission,canonical,content,hash,meta,plan,project,requirements} from './storage-data.mjs';
import {seedHistoricalVerification} from './historical-verification.mjs';

// These tests exercise the actual migrated schema and Worker command handlers.
// Retained source facts are deliberately seeded DB fixtures, not Git transfer,
// Runtime or Runner evidence. Real Git behavior has separate integration tests.
export async function candidateFixture(t,{configureDraft,targetVersion}={}){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');const migrations=readMigrations();applyMigrations(db,migrations,randomUUID(),1,targetVersion??migrations.length);t.after(()=>db.close());
 const domain=createDomain(db),storage={async request(method,input){return domain.execute(method,input);}},p=await project(storage),draft=plan(['developer','developer','tester']),req=requirements(),[left,right,tester]=draft.works;
 for(const [index,work] of draft.works.entries()){work.inputRefs=[];work.writeScope=work.role==='developer'?['src/'+index+'.ts']:[];}
 tester.dependencies=[left,right].map(work=>({workId:work.workId,requiredOutcome:'success'}));tester.inputRefs=[left,right].map(work=>({kind:'output',workId:work.workId,outputSlot:'implementation.commit'}));tester.outputSpec=[{slot:'verification.report',schemaId:'devmesh.test-result.v1'}];tester.completionChecks=[{kind:'required-tests-pass',checkId:'check_required'}];
 configureDraft?.(draft);
 const planContentHash=await content(storage,draft),publication=await storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:req,plan:draft,planContentHash});
 await storage.request('confirmReviewedPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:publication.result.reviewHash});
 const get=(sql,...args)=>db.prepare(sql).get(...args),run=(sql,...args)=>db.prepare(sql).run(...args),insert=(table,row)=>{const keys=Object.keys(row);return run('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',...Object.values(row));};
 const time=new Date().toISOString(),identity={root:'D:\\database-fixture\\repo.git',gitDirectory:'D:\\database-fixture\\repo.git',commonDirectory:'D:\\database-fixture\\repo.git',rootDevice:'1',rootFileId:'2',gitDevice:'1',gitFileId:'2'},base='b'.repeat(40),emptyManifest=commit=>{const value={commit,tree:'e'.repeat(40),files:[],byteSize:0};return {...value,sha256:hash(canonical(value))};};
 insert('managed_repositories',{project_id:p.projectId,resource_id:'repository.unit',operation_id:'op_repository',request_hash:hash('repository'),template_commit:base,state:'READY',identity_json:canonical(identity),manifest_json:canonical(emptyManifest(base)),created_at:time,updated_at:time});
 const decisionId=get("SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind='PLAN'",p.runId).decision_id,context={...p,draft,requirements:req},sources=[];
 async function complete(index,{archive=true,interfaces=[],codeBase=base,formal=false,manifestOverrides={},inputArtifacts}={}){
  const input=await admission(storage,context,[index]),work=draft.works[index],oldSources=sources.filter(source=>work.dependencies.some(edge=>edge.workId===source.workId));
  input.works[0].resources=[{kind:'workspace',resourceId:'workspace.'+index+'.'+randomUUID(),access:'write'}];
   const currentDecision=get("SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind='PLAN' AND subject_id=?",p.runId,String(input.planRevision)).decision_id;
   Object.assign(input.works[0].inputManifest,{decisionIds:[currentDecision],interfaces,codeCommit:codeBase,artifacts:oldSources.length?[{artifactId:p.artifactId,sha256:get('SELECT content_hash FROM artifacts WHERE artifact_id=?',p.artifactId).content_hash}]:[]});
  Object.assign(input.works[0].inputManifest,manifestOverrides);if(inputArtifacts)input.works[0].inputManifest.artifacts=inputArtifacts;if(formal)input.works[0].roleSnapshot.outputSchemaId='devmesh.development-result.v1';
  const result=await storage.request('admitWorks',input),attemptId=result.result.attemptIds[0],a=get('SELECT * FROM attempts WHERE attempt_id=?',attemptId),grant=get('SELECT * FROM execution_grants WHERE attempt_id=?',attemptId),commit=hash(attemptId).slice(0,40),operationId='op_archive_'+index,allocationId='op_allocation_'+index,commitId='op_commit_'+index,workspaceRef=input.works[0].resources[0].resourceId;
   insert('scheduled_work',{attempt_id:attemptId,run_id:p.runId,plan_revision:input.planRevision,runner_id:'runner.unit',reservation_key:randomUUID(),caller_id:'unit.scheduler'});
  for(const [expectedState,state] of [['RESERVED','SUBMITTED'],['SUBMITTED','WORKING'],['WORKING','VERIFYING']])await storage.request('transitionAttempt',{meta:meta(p.runId),runId:p.runId,attemptId,expectedState,state});
  const ref={artifactId:p.artifactId,sha256:get('SELECT content_hash FROM artifacts WHERE artifact_id=?',p.artifactId).content_hash};
  if(!formal)seedHistoricalVerification(db,{meta:meta(p.runId),runId:p.runId,attemptId,outcome:'success',evidence:ref,outputs:work.outputSpec.map(output=>({slot:output.slot,ref})),codeCommit:commit});
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
