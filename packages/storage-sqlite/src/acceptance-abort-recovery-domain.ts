import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import {acceptancePreparationRequest,acceptanceBackendPolicy} from './acceptance-protocol.js';
import {acceptanceAbortDecision} from './acceptance-abort-protocol.js';
import {acceptancePreparedProof} from './acceptance-readiness-protocol.js';
import {acceptanceAbortRecoveryRequests,acceptanceAbortCompletionEvidence,acceptanceDatasetAbortRequest,acceptanceAbortSourceGate} from './acceptance-abort-recovery-protocol.js';
import type {AcceptanceAbortRecoveryInput,AcceptanceAbortRecoveryMethod,AcceptanceAbortCompletion,AcceptanceAbortCompletionEvidence} from './acceptance-abort-recovery-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Abort completion requires original cleanup, permanent revocation and exact restored source ownership');}
export function createAcceptanceAbortRecoveryDomain(db:DatabaseSync,completed:(runId:string,abortId:string,preparationId:string)=>void){
 const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined,exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
 function bound(i:AcceptanceAbortRecoveryInput<'getAcceptanceAbortRecovery'>){
  const row=get('SELECT * FROM acceptance_preparations WHERE operation_id=?',i.preparationOperationId)??fail('ACCEPTANCE_PREPARATION_NOT_FOUND',404),request=acceptancePreparationRequest.parse(JSON.parse(String(row.request_json))),policy=acceptanceBackendPolicy.parse(JSON.parse(String(get('SELECT policy_json FROM acceptance_backend_policies WHERE project_id=? AND policy_hash=?',row.project_id!,row.policy_hash!)?.policy_json??fail('ACCEPTANCE_BACKEND_NOT_CONFIGURED',503))));
  if(i.principalId!==policy.backendPrincipalId||i.principalId!==request.backendPrincipalId)fail('FORBIDDEN',403);
  const p={operationId:String(row.operation_id),requestHash:String(row.request_hash),projectId:String(row.project_id),runId:String(row.run_id),releaseId:String(row.release_id),request};
  if(p.requestHash!==i.requestHash||digest(canonical(request))!==p.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');
  const a=get('SELECT * FROM acceptance_abort_decisions WHERE preparation_operation_id=?',p.operationId)??fail('ACCEPTANCE_ABORT_NOT_REQUESTED');
  const d=acceptanceAbortDecision.parse(JSON.parse(String(a.decision_json)));
  if(a.decision_hash!==i.decisionHash||digest(canonical(d))!==i.decisionHash||canonical(d.preparation)!==canonical(p.request))fail('ACCEPTANCE_ABORT_DECISION_CHANGED');
  return {p,d};
 }
 function existing(id:string):AcceptanceAbortCompletion|null{const r=get('SELECT * FROM acceptance_abort_completions WHERE preparation_operation_id=?',id);if(!r)return null;const evidence=acceptanceAbortCompletionEvidence.parse(JSON.parse(String(r.evidence_json)));if(digest(canonical(evidence))!==r.evidence_hash)fail('ACCEPTANCE_ABORT_COMPLETION_CHANGED');return {evidence,evidenceHash:String(r.evidence_hash),completedAt:String(r.completed_at)};}
 function gate(datasetId:string){const r=get('SELECT * FROM preview_write_gates WHERE dataset_id=?',datasetId)??fail('ACCEPTANCE_WRITE_GATE_MISSING');return acceptanceAbortSourceGate.parse({datasetId,datasetOperationId:r.dataset_operation_id,datasetRequestHash:r.dataset_request_hash,state:r.state,fence:r.fence,revision:r.revision,closeOperationId:r.close_operation_id,closeRequestHash:r.close_request_hash});}
 function sourceImage(q:ReturnType<typeof bound>['p']['request']){if(!q.source)return null;const r=get('SELECT r.*,c.manifest_json,c.manifest_hash candidate_manifest_hash,c.revision frozen_revision FROM releases r JOIN release_candidates c ON c.candidate_id=r.candidate_id WHERE r.project_id=? AND r.release_id=?',q.projectId,q.source.releaseId)??fail('ACCEPTANCE_SOURCE_CHANGED');if(r.prepared_data_ref!==q.source.datasetId||r.manifest_hash!==r.candidate_manifest_hash||r.candidate_revision!==r.frozen_revision)fail('ACCEPTANCE_SOURCE_CHANGED');const manifest=JSON.parse(String(r.manifest_json)) as {delivery?:{record?:{image?:{imageDigest?:string}}}};if(digest(canonical(manifest))!==r.manifest_hash)fail('ACCEPTANCE_SOURCE_CHANGED');const image=manifest.delivery?.record?.image?.imageDigest;if(!image)fail('ACCEPTANCE_SOURCE_IMAGE_UNAVAILABLE');return image;}
 const handlers={
  getAcceptanceAbortRecovery(i:AcceptanceAbortRecoveryInput<'getAcceptanceAbortRecovery'>){const {p}=bound(i);return {completion:existing(p.operationId),sourceGate:p.request.source?gate(p.request.source.datasetId):null,sourceImageDigest:sourceImage(p.request)};},
  completeAcceptanceAbort(i:AcceptanceAbortRecoveryInput<'completeAcceptanceAbort'>){
   const {p,d}=bound(i),e=i.evidence,q=p.request,body=canonical(e),evidenceHash=digest(body),old=existing(p.operationId);
   if(old){if(old.evidenceHash!==evidenceHash)fail('ACCEPTANCE_ABORT_COMPLETION_CHANGED');return old;}
   const proof=e.data.proof,f=proof.originalFences,s=q.source;
   const request=acceptanceDatasetAbortRequest.parse({schemaVersion:'devmesh.acceptance-dataset-abort.v1',decision:d,decisionHash:i.decisionHash,controllerId:e.service.controllerId,serviceCleanupHash:e.service.cleanupHash}),abortRequestHash=digest(canonical(request));
   if(e.operationId!==p.operationId||e.requestHash!==p.requestHash||e.decisionHash!==i.decisionHash||e.data.requestHash!==abortRequestHash||proof.requestHash!==abortRequestHash||proof.operationId!==p.operationId||proof.abortOperationId!==d.operationId||proof.decisionHash!==i.decisionHash||proof.target.datasetId!==q.target.datasetId)fail('ACCEPTANCE_ABORT_PROOF_CHANGED');
   const follows=(n:AcceptanceAbortCompletionEvidence['data']['proof']['target'],h:NonNullable<typeof f>['targetFence']['physical']|null)=>h?n.fenceId===h.fenceId&&n.generation>h.generation&&n.previousHoldHash===h.proofHash:n.previousHoldHash===null;
   if(f&&(f.operationId!==p.operationId||f.requestHash!==p.requestHash||f.targetFence.datasetId!==q.target.datasetId||(s?f.sourceFence?.datasetId!==s.datasetId||f.sourceFence.datasetOperationId!==s.datasetOperationId:f.sourceFence!==null))||!follows(proof.target,f?.targetFence.physical??null))fail('ACCEPTANCE_ABORT_CUSTODY_CHANGED');
   const at=new Date().toISOString();if(Date.parse(proof.settledAt)<Date.parse(d.decidedAt)||Date.parse(proof.settledAt)>Date.parse(at))fail('ACCEPTANCE_ABORT_PROOF_CHANGED');
   const stored=get('SELECT * FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId);
   if(d.preparedProofHash!==null){if(!stored||stored.proof_hash!==d.preparedProofHash)fail('ACCEPTANCE_ABORT_PROOF_CHANGED');const prepared=acceptancePreparedProof.parse(JSON.parse(String(stored.proof_json)));if(!f||canonical(f.sourceFence)!==canonical(prepared.sourceFence)||canonical(f.targetFence)!==canonical(prepared.targetFence)||e.service.reservationId!==prepared.service.reservationId||e.service.profileHash!==prepared.service.profileHash||e.service.instanceId!==prepared.service.claim.instanceId)fail('ACCEPTANCE_ABORT_CUSTODY_CHANGED');}
   if((get('SELECT accepted_release_id FROM projects WHERE project_id=?',p.projectId)!.accepted_release_id??null)!==q.expectedAcceptedReleaseId)fail('ACCEPTANCE_SOURCE_CHANGED');
   if(get('SELECT 1 FROM acceptance_commits WHERE preparation_operation_id=?',p.operationId)||get('SELECT 1 FROM releases WHERE release_id=? OR prepared_data_ref=?',p.releaseId,q.target.datasetId))fail('ACCEPTANCE_ALREADY_COMMITTED');
   const target=gate(q.target.datasetId);if(target.state!=='CLOSED'||target.datasetOperationId!==p.operationId||target.datasetRequestHash!==p.requestHash)fail('ACCEPTANCE_TARGET_FENCE_CHANGED');
   let sourceGate:ReturnType<typeof gate>|null=null;
   if(s){
    sourceGate=gate(s.datasetId);const r=e.sourceRecovery,ps=proof.source;
    if(!e.sourceGate||canonical(e.sourceGate)!==canonical(sourceGate)||sourceGate.datasetOperationId!==s.datasetOperationId)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
    if(!ps||ps.releaseId!==s.releaseId||ps.datasetId!==s.datasetId||ps.datasetOperationId!==s.datasetOperationId||!follows({...ps,datasetId:s.datasetId,writeState:'CLOSED'},f?.sourceFence?.physical??null))fail('ACCEPTANCE_ABORT_CUSTODY_CHANGED');
    if(!r||r.decisionHash!==i.decisionHash||r.releaseId!==s.releaseId||r.datasetId!==s.datasetId||r.datasetOperationId!==s.datasetOperationId||r.runnerId!==q.runnerId||r.imageDigest!==sourceImage(q)||canonical(r.fence)!==canonical({fenceId:ps.fenceId,generation:ps.generation,proofHash:ps.proofHash,previousHoldHash:ps.previousHoldHash})||r.revocationProofHash!==proof.revocation.proofHash)fail('ACCEPTANCE_SOURCE_RECOVERY_CHANGED');
    const age=Date.parse(at)-Date.parse(r.checkedAt);if(age<0||age>30_000||Date.parse(r.checkedAt)<Date.parse(proof.settledAt))fail('ACCEPTANCE_SOURCE_HEALTH_STALE');
    if(get("SELECT 1 FROM business_pending_writes WHERE dataset_id=?",s.datasetId))fail('ACCEPTANCE_SOURCE_WRITES_UNRESOLVED');
    if(sourceGate.state==='CLOSED'){
     const c=get('SELECT * FROM preview_write_closures WHERE operation_id=?',p.operationId);
     if(!c||sourceGate.closeOperationId!==p.operationId||sourceGate.closeRequestHash!==c.request_hash||digest(String(c.request_json))!==c.request_hash||c.dataset_id!==s.datasetId)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
     if(f?.sourceFence&&(f.sourceFence.closeOperationId!==sourceGate.closeOperationId||f.sourceFence.closeRequestHash!==sourceGate.closeRequestHash||f.sourceFence.gateFence!==sourceGate.fence))fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
    }else if(f?.sourceFence)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
   }else if(proof.source!==null||e.sourceGate!==null||e.sourceRecovery!==null)fail('ACCEPTANCE_SOURCE_NOT_APPLICABLE');
   exec('INSERT INTO acceptance_abort_completions VALUES(?,?,?,?,?,?,?,?,?,?)',p.operationId,i.decisionHash,evidenceHash,body,sourceGate?.datasetId??null,sourceGate?.revision??null,sourceGate?.fence??null,sourceGate?.closeOperationId??null,sourceGate?.closeRequestHash??null,at);
   if(sourceGate?.state==='CLOSED'){
    exec("UPDATE preview_write_gates SET state='OPEN',fence=fence+1,revision=revision+1,close_operation_id=NULL,close_request_hash=NULL,updated_at=? WHERE dataset_id=?",at,sourceGate.datasetId);
    const g=gate(sourceGate.datasetId),row=get('SELECT * FROM preview_write_gates WHERE dataset_id=?',g.datasetId)!;
    exec('INSERT INTO preview_write_gate_events VALUES(?,?,?,?)',g.datasetId,g.revision,canonical({...g,projectId:p.projectId,pendingWrites:0,createdAt:row.created_at,updatedAt:row.updated_at}),at);
   }
   completed(p.runId,d.operationId,p.operationId);return {evidence:e,evidenceHash,completedAt:at};
  },
 };
 return {execute(method:AcceptanceAbortRecoveryMethod,input:unknown):unknown{const parsed=parseContract(acceptanceAbortRecoveryRequests[method],input);return transaction(db,()=>(handlers[method] as (i:unknown)=>unknown)(parsed));}};
}
