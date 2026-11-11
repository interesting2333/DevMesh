import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ControlledGit,LocalManagedWorkspaces,LocalSourceArchives,LocalCandidateIntegrations} from '../../packages/code-workspaces/dist/index.mjs';
import {repoGitTools} from '../../packages/mcp-tools/dist/index.mjs';
import {ExecutionGrantLease} from '../../packages/agent-runtime/dist/index.mjs';
import {httpFixture,callerId,credential} from './a2a-data.mjs';
import {WorkflowScheduler} from '../../packages/platform-core/dist/scheduler.mjs';
import {meta,plan,requirements} from './storage-data.mjs';
import {archiveGit,archiveOp} from './source-archive.mjs';

// Actual HTTP A2A admission/Host lease, SQLite Worker, isolated Git checkout,
// repo tool and source transfer. Verification is an explicit fixture decision;
// the fencer is job-free and this does not claim a model, Runner job or P1-06.
export async function candidateGitFixture(t,{initial={'src/left.ts':'export const left = 0;\n','src/right.ts':'export const right = 0;\n'},scopes=[['src/left.ts'],['src/right.ts']]}={}){
 const cleanup=[];t.after(async()=>{for(const fn of cleanup.toReversed())await fn();});const f=await httpFixture({after:fn=>cleanup.push(fn)}),root=join(f.root,'template-source');await mkdir(root);
 for(const [path,body] of Object.entries(initial)){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),body);}
 await archiveGit(root,'init','--quiet');await archiveGit(root,'config','user.name','Candidate fixture');await archiveGit(root,'config','user.email','candidate@localhost');await archiveGit(root,'add','.');await archiveGit(root,'commit','--quiet','--no-gpg-sign','-m','Initial');
 const base=await archiveGit(root,'rev-parse','HEAD'),source=await ControlledGit.open(root,'checkout'),body=await f.content.putText(meta(),{kind:'content'},'并行开发候选快照'),p=(await f.storage.request('createProjectWithRun',{meta:meta(),name:'Candidate integration fixture',baseCommit:base,contentHash:body.expectedHash,clientMessageId:randomUUID()})).result;
 const draft=plan(['developer','developer','tester']),[left,right,tester]=draft.works;for(const [index,work] of [left,right].entries()){work.inputRefs=[];work.dependencies=[];work.writeScope=scopes[index];}
 Object.assign(tester,{writeScope:[],dependencies:[left,right].map(work=>({workId:work.workId,requiredOutcome:'success'})),inputRefs:[left,right].map(work=>({kind:'output',workId:work.workId,outputSlot:'implementation.commit'})),outputSpec:[{slot:'verification.report',schemaId:'devmesh.test-result.v1'}],completionChecks:[{kind:'required-tests-pass',checkId:'check_required'}]});
 const content=await f.content.putJson(meta(p.runId),{kind:'content'},draft),published=await f.storage.request('publishPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r1"',requirementRevision:1,planRevision:1,requirements:requirements(),plan:draft,planContentHash:content.expectedHash});await f.storage.request('confirmReviewedPlan',{meta:meta(p.runId),runId:p.runId,ifMatch:'"r2"',requirementRevision:1,planRevision:1,reviewHash:published.result.reviewHash});
 const sql=(query,...params)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{db.exec('PRAGMA foreign_keys=ON');return db.prepare(query).all(...params);}finally{db.close();}};
 const held=new Set(),fencer={async acquire(input){const key=input.kind+':'+input.resourceId;assert.equal(held.has(key),false);held.add(key);return {async release(){assert.equal(held.delete(key),true);}};}};
 await mkdir(f.options.runnerDataRoot,{recursive:true});
 const options={mode:'local-development',storage:f.storage,controlDataRoot:f.local.dataRoot,runnerDataRoot:f.options.runnerDataRoot,backupRoot:f.options.backupRoot,fencer},allocator=new LocalManagedWorkspaces({...options,runnerId:'runner.local',templates:new Map([[base,source]])});
 const repository=await allocator.ensureRepository({principalId:'user_1',projectId:p.projectId,operationId:archiveOp(),resourceId:'repository.candidate',templateCommit:base});
 const scheduler=new WorkflowScheduler(f.storage,f.registry,credential,{callerId,planResources:async c=>({runnerId:'runner.local',runnerCapacity:1,runnerLimits:{cpu:4,memoryMiB:4096,timeoutMs:600000},reservationKey:randomUUID(),maximumAttempts:10,maximumReservedMs:6000000,templateVersion:'fixture.v1',checkConfigHash:'c'.repeat(64),roleSnapshot:{role:c.work.role,revision:'fixture.v1',provider:'offline',model:'offline',promptArtifactId:p.artifactId,outputSchemaId:'devmesh.result.v1',allowedTools:['repo_commit','repo_by-operation'],maxSteps:2,contextLimitTokens:16000,outputReserveTokens:1000,requestTimeoutMs:30000,maxReadOnlyRetries:0},resources:[{kind:'workspace',resourceId:'workspace.'+c.work.workId,access:'write'},{kind:'projectRepository',resourceId:'repository.candidate',access:'read'}]})});
 const sources=[];
 async function develop(edit){
  const admitted=await scheduler.tick(new AbortController().signal);assert.ok(admitted,JSON.stringify({error:scheduler.lastError}));const attemptId=admitted.result.attemptIds[0],attempt=await f.storage.request('getAttempt',{attemptId});assert.equal(attempt.role,'developer');
  const dispatch=(await f.storage.request('listScheduledDispatches',{})).find(row=>row.attemptId===attemptId);assert.ok(dispatch);assert.equal((await scheduler.send(dispatch,new AbortController().signal)).state,'ACKED');
  const [claim]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'candidate.fixture'});assert.equal(claim.delegation.attemptId,attemptId);const {delegation:_delegation,...key}=claim;
  const permit=JSON.parse(sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',attemptId)[0].permit_json),lease=new ExecutionGrantLease(f.storage,key,value=>Object.assign(permit,value));await lease.start();cleanup.push(()=>lease.stop());
  const allocationOperationId=archiveOp(),workspaceRef=permit.resources.find(resource=>resource.kind==='workspace').resourceId,allocation=await allocator.allocate({permit,operationId:allocationOperationId,workspaceRef,repositoryResourceId:'repository.candidate',runnerId:'runner.local',kind:'development',baseCommit:base}),id=allocation.record.identity;
  const binding={workspaceRef,resourceId:workspaceRef,projectResourceId:'repository.candidate',projectId:p.projectId,runId:p.runId,attemptId,baseCommit:base,root:id.root,gitDirectory:id.gitDirectory,commonDirectory:id.commonDirectory};await edit(binding.root);
  const commitTool=repoGitTools({storage:f.storage,bindings:[binding],scratchRoot:join(f.root,'git-scratch'),acquire:async()=>fencer.acquire({kind:'workspace',resourceId:workspaceRef})}).find(tool=>tool.name==='repo.commit'),commitOperationId=archiveOp(),committed=await commitTool.execute({operationId:commitOperationId,permit,args:{workspaceRef,baseCommit:base,message:'Candidate source '+sources.length},signal:new AbortController().signal});assert.match(committed.commit,/^[a-f0-9]{40}$/);
  const archive=await new LocalSourceArchives(options).archive({permit,operationId:archiveOp(),allocationOperationId,commitOperationId});assert.equal(archive.state,'ACKNOWLEDGED');
  const task=await f.storage.request('getA2ATask',{callerId,endpointId:key.endpointId,taskId:key.taskId});await f.storage.request('settleAcceptedWork',{...key,state:'completed',snapshot:{...task.snapshot,status:{state:'TASK_STATE_COMPLETED',timestamp:new Date().toISOString()}}});
  const artifact=sql('SELECT artifact_id,content_hash FROM artifacts WHERE artifact_id=?',p.artifactId)[0],ref={artifactId:artifact.artifact_id,sha256:artifact.content_hash},work=draft.works.find(work=>work.workId===attempt.workId);
  await f.storage.request('recordVerifiedWork',{meta:meta(p.runId),runId:p.runId,attemptId,outcome:'success',evidence:ref,outputs:work.outputSpec.map(output=>({slot:output.slot,ref})),codeCommit:archive.manifest.commit});await lease.stop();
  const result={attemptId,binding,archive,commit:archive.manifest.commit,workId:attempt.workId};sources.push(result);return result;
 }
 const service=(storage=f.storage,extra={})=>new LocalCandidateIntegrations({...options,...extra,storage});
 return {...f,p,draft,base,source,repository,options,held,sql,develop,sources,service,subject:{principalId:'user_1',runId:p.runId,purpose:'run-candidate'},input:()=>({principalId:'user_1',runId:p.runId,purpose:'run-candidate',operationId:archiveOp()})};
}
