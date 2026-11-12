import {randomUUID} from 'node:crypto';
import {qualityStorageFixture} from './quality-storage.mjs';
import {canonical,hash,meta} from './storage-data.mjs';
export const workOp=()=> 'op_'+randomUUID().replaceAll('-','');

// Real schema, quality evaluator, handlers and filesystem content publication.
// Admission/Git/Runner and the original Runtime candidate below are explicit DB
// fixtures. Actual Runtime/Git publication is exercised in workspace-runtime.
export async function workVerificationFixture(t,options={}){
 const f=await qualityStorageFixture(t,{...options,roleSchema:'devmesh.test-result.v1'});await f.prepareResult();await f.complete();
 const time=new Date().toISOString(),attempt=f.get('SELECT * FROM attempts WHERE attempt_id=?',f.attemptId),snapshot=f.get('SELECT role_snapshot_id FROM attempt_dispatch_bindings WHERE attempt_id=?',f.attemptId).role_snapshot_id;
 const artifact=(contentHash,kind='fixture-report')=>{const stored=f.get('SELECT * FROM content_objects WHERE content_hash=?',contentHash),artifactId='artifact_'+randomUUID().replaceAll('-','');f.insert('artifacts',{artifact_id:artifactId,project_id:f.p.projectId,run_id:f.p.runId,attempt_id:f.attemptId,kind,content_hash:contentHash,byte_size:stored.byte_size,storage_key:stored.storage_key,state:'READY',input_fingerprint:attempt.input_fingerprint,created_at:time});return {artifactId,sha256:contentHash};};
 const report=key=>({...artifact(hash(f.bytes.get(key))),targetCommit:f.q.input.scope.targetCommit}),testCheck=f.q.policy.checks.find(c=>c.kind==='tests'),output={schemaVersion:'devmesh.test-result.v1',role:'tester',targetCommit:f.q.input.scope.targetCommit,caseResults:[{checkId:testCheck.checkId,requirementIds:[...new Set(testCheck.requiredTests.flatMap(t=>t.requirementIds))],status:options.modelPassed===false?'FAILED':'PASSED',reportRef:report('report.tests.front')}],coverageRef:report('report.coverage.front'),buildRef:report('result'),defects:[]};
 options.mutateOutput?.(output,f);const body=await f.content.putJson(meta(f.p.runId),{kind:'content'},output),candidate=artifact(body.expectedHash,'agent-candidate'),sessionId='session_'+randomUUID().replaceAll('-',''),contextId='context_'+randomUUID().replaceAll('-',''),endpointId='builtin.tester',taskId='task_'+randomUUID().replaceAll('-',''),activationId=f.grant.activation_id;
 f.insert('agent_sessions',{session_id:sessionId,run_id:f.p.runId,attempt_id:f.attemptId,role_snapshot_id:snapshot,created_at:time});
 f.insert('context_snapshots',{context_snapshot_id:contextId,manifest_content_hash:body.expectedHash,created_at:time,workflow_session_id:sessionId,through_message_seq:0,config_hash:hash('fixture-context'),message_refs_json:'[]'});
 f.insert('model_steps',{session_id:sessionId,step_no:1,context_snapshot_id:contextId,request_content_hash:body.expectedHash,response_content_hash:body.expectedHash,usage_json:'{}',state:'RESPONDED',started_at:time,sent_at:time,ended_at:time});
 f.insert('a2a_tasks',{endpoint_id:endpointId,task_id:taskId,context_id:contextId,run_id:f.p.runId,attempt_id:f.attemptId,protocol_state:'completed',snapshot_json:'{}'});
 const config={workspace:{schemaVersion:'devmesh.managed-runtime.v1',runnerId:f.execution.runnerId}};
 f.insert('runtime_activations',{activation_id:activationId,attempt_id:f.attemptId,grant_id:f.grant.grant_id,session_id:sessionId,endpoint_id:endpointId,task_id:taskId,worker_id:'fixture.runtime',claim_token:'fixture.claim',config_hash:hash(canonical(config)),config_json:canonical(config),max_steps:2,token_limit:100,state:'FINISHED',created_at:time,updated_at:time});
 f.insert('runtime_results',{activation_id:activationId,artifact_id:candidate.artifactId,step_no:1,session_id:sessionId});
 f.insert('runtime_workspace_results',{activation_id:activationId,allocation_operation_id:f.allocationId,commit_operation_id:null,archive_operation_id:null,step_no:1,content_hash:body.expectedHash,output_json:canonical(output),created_at:time});
 const subject={principalId:'user_1',operationId:workOp(),runId:f.p.runId,attemptId:f.attemptId,qualityOperationId:f.bound.operationId},begin={...subject,candidate:output};
 return {...f,output,candidate,artifact,subject,workBegin:begin,sessionId,activationId};
}
