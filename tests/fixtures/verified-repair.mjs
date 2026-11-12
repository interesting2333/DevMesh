import {randomUUID} from 'node:crypto';
import {WorkVerifier} from '../../packages/result-verifier/dist/index.mjs';
import {workVerificationFixture,workOp} from './work-verification.mjs';
import {canonical,hash,meta} from './storage-data.mjs';

// Test-only source/admission/Runner/Runtime facts. The migrated handlers,
// independent raw report evaluation, content ACK, Work and issue transactions
// are real. Git/HTTP Runtime composition is a separate integration obligation.
export function repairDraft(draft){
 const tester=draft.works[2],fix=structuredClone(draft.works[0]),reverify=structuredClone(tester);
 Object.assign(fix,{workId:'work_fix',writeScope:['src/fix.ts'],dependencies:[{workId:tester.workId,requiredOutcome:'completed-with-findings'}],inputRefs:[{kind:'output',workId:tester.workId,outputSlot:'verification.report'}],outputSpec:[{slot:'implementation.commit',schemaId:'devmesh.development-result.v1'}],completionChecks:[{kind:'commit-resolved',outputSlot:'implementation.commit'}]});
 Object.assign(reverify,{workId:'work_reverify',dependencies:[{workId:fix.workId,requiredOutcome:'success'}],inputRefs:[{kind:'output',workId:fix.workId,outputSlot:'implementation.commit'}]});
 draft.works.push(fix,reverify);
}
export async function seedDeveloperCandidate(f,source){
 const attemptId=source.attemptId,time=new Date().toISOString(),attempt=f.get('SELECT * FROM attempts WHERE attempt_id=?',attemptId),grant=f.get('SELECT * FROM execution_grants WHERE attempt_id=?',attemptId),snapshot=f.get('SELECT snapshot_id FROM role_snapshots WHERE snapshot_json=?',attempt.role_snapshot_json).snapshot_id,archive=f.get('SELECT * FROM source_archives WHERE attempt_id=?',attemptId),allocation=f.get('SELECT * FROM workspace_allocations WHERE operation_id=?',archive.allocation_operation_id),output={schemaVersion:'devmesh.development-result.v1',role:'developer',baseCommit:allocation.base_commit,resultCommit:source.commit,changedFiles:['src/fix.ts'],checkRefs:[],unverified:[],handoffProposal:null},body=await f.content.putJson(meta(f.p.runId),{kind:'content'},output),stored=f.get('SELECT * FROM content_objects WHERE content_hash=?',body.expectedHash),artifactId='artifact_'+randomUUID().replaceAll('-',''),sessionId='session_'+randomUUID().replaceAll('-',''),contextId='context_'+randomUUID().replaceAll('-',''),taskId='task_'+randomUUID().replaceAll('-',''),activationId=grant.activation_id,config={workspace:{schemaVersion:'devmesh.managed-runtime.v1',runnerId:allocation.runner_id}};
 f.insert('artifacts',{artifact_id:artifactId,project_id:f.p.projectId,run_id:f.p.runId,attempt_id:attemptId,kind:'agent-candidate',content_hash:body.expectedHash,byte_size:stored.byte_size,storage_key:stored.storage_key,state:'READY',input_fingerprint:attempt.input_fingerprint,created_at:time});
 f.insert('agent_sessions',{session_id:sessionId,run_id:f.p.runId,attempt_id:attemptId,role_snapshot_id:snapshot,created_at:time});
 f.insert('context_snapshots',{context_snapshot_id:contextId,manifest_content_hash:body.expectedHash,created_at:time,workflow_session_id:sessionId,through_message_seq:0,config_hash:hash('fixture-context'),message_refs_json:'[]'});
 f.insert('model_steps',{session_id:sessionId,step_no:1,context_snapshot_id:contextId,request_content_hash:body.expectedHash,response_content_hash:body.expectedHash,usage_json:'{}',state:'RESPONDED',started_at:time,sent_at:time,ended_at:time});
 f.insert('a2a_tasks',{endpoint_id:'builtin.developer',task_id:taskId,context_id:contextId,run_id:f.p.runId,attempt_id:attemptId,protocol_state:'completed',snapshot_json:'{}'});
 f.insert('runtime_activations',{activation_id:activationId,attempt_id:attemptId,grant_id:grant.grant_id,session_id:sessionId,endpoint_id:'builtin.developer',task_id:taskId,worker_id:'fixture.runtime',claim_token:'fixture.claim',config_hash:hash(canonical(config)),config_json:canonical(config),max_steps:2,token_limit:100,state:'FINISHED',created_at:time,updated_at:time});
 f.insert('runtime_results',{activation_id:activationId,artifact_id:artifactId,step_no:1,session_id:sessionId});
 f.insert('runtime_workspace_results',{activation_id:activationId,allocation_operation_id:allocation.operation_id,commit_operation_id:archive.commit_operation_id,archive_operation_id:archive.operation_id,step_no:1,content_hash:body.expectedHash,output_json:canonical(output),created_at:time});
 return new WorkVerifier(f.storage,f.content).verify({principalId:'user_1',runId:f.p.runId,operationId:workOp(),attemptId});
}
export async function verifiedRepairFixture(t,options={}){
 const f=await workVerificationFixture(t,{failed:true,configureDraft:repairDraft}),failed=await new WorkVerifier(f.storage,f.content).verify(f.subject),findings=await f.storage.request('listVerifiedFindings',{principalId:'user_1',runId:f.p.runId}),finding=findings.find(x=>x.failure.check.kind==='tests');
 const link={principalId:'user_1',runId:f.p.runId,operationId:workOp(),issueId:finding.issueId,issueRevision:1,fixWorkId:'work_fix'};await f.storage.request('linkVerifiedFindingFix',link);
 const source=await f.completeSource(3,{formal:true,codeBase:f.output.targetCommit,manifestOverrides:{checkConfigHash:f.policy.configHash,templateVersion:f.q.policy.templateVersion},inputArtifacts:[f.candidate]}),fix=await seedDeveloperCandidate(f,source);
 const after=await workVerificationFixture(t,{baseFixture:f,workIndex:4,inputArtifacts:fix.verification.evaluation.outputs.map(x=>x.ref),targetCommit:options.oldTarget?f.output.targetCommit:'d'.repeat(40),suffix:'.reverify',failed:options.failed??false,mutateOutput:options.modelFinding?o=>o.defects.push({id:'model.recheck',severity:'HIGH',description:'Unconfirmed new candidate finding',evidenceRefs:[{artifactId:o.coverageRef.artifactId,sha256:o.coverageRef.sha256}]}):undefined}),reverification=await new WorkVerifier(after.storage,after.content).verify(after.subject),command={principalId:'user_1',runId:f.p.runId,operationId:workOp(),issueId:finding.issueId,issueRevision:2,fixAttemptId:source.attemptId,verificationAttemptId:after.attemptId};
 return {f,after,failed,finding,source,fix,reverification,command};
}
