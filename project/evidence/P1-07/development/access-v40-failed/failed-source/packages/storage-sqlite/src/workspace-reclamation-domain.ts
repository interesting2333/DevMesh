import {dirname,isAbsolute,join} from 'node:path';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {createWorkspacePreservationDomain} from './workspace-preservation-domain.js';
import {workspaceReclamationRequests} from './workspace-reclamation-protocol.js';
import type {WorkspaceReclamation,WorkspaceReclamationInput,WorkspaceReclamationMethod} from './workspace-reclamation-protocol.js';
import type {WorkspacePreservation} from './workspace-preservation-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Only the exact original preserved workspace can be reclaimed');}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
/** Shared synchronous preservation guards run inside the caller transaction. */
export function createWorkspaceReclamationDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),preservations=createWorkspacePreservationDomain(db);
 const required=(id:string)=>get('SELECT * FROM workspace_reclamations WHERE operation_id=?',id)??fail('WORKSPACE_RECLAMATION_NOT_FOUND',404);
 const view=(r:Row):WorkspaceReclamation=>({operationId:String(r.operation_id),preservationOperationId:String(r.preservation_operation_id),workspaceRef:String(r.workspace_ref),projectId:String(r.project_id),principalId:String(r.principal_id),requestHash:String(r.request_hash),createdAt:String(r.created_at),state:r.state as WorkspaceReclamation['state'],basis:JSON.parse(String(r.basis_json)),isolationIntentSha256:r.isolation_intent_hash as string|null,isolationProof:r.isolation_proof_json?JSON.parse(String(r.isolation_proof_json)):null,deleteIntentSha256:r.delete_intent_hash as string|null,deletionProof:r.deletion_proof_json?JSON.parse(String(r.deletion_proof_json)):null,errorCode:r.error_code as string|null});
 function archive(permit:ExecutionPermit,operationId:string,write:boolean){
  const record=preservations.execute('getWorkspacePreservation',{permit,operationId}) as WorkspacePreservation;
  if(write){
   // The internal guard must be synchronous and must not open a transaction.
   preservations.assertReclaimable({permit,operationId,manifestSha256:record.acknowledgement?.manifestSha256??''});
   if(get('SELECT status FROM execution_grants WHERE grant_id=?',record.basis.allocation.grantId)?.status!=='REVOKED')fail('WORKSPACE_RECLAMATION_ADMISSION_OPEN');
  }return record;
 }
 function owned(r:Row,p:ExecutionPermit,write=false){const frozen=view(r),current=archive(p,frozen.preservationOperationId,write);if(current.principalId!==frozen.principalId||current.workspaceRef!==frozen.workspaceRef||!same(current.acknowledgement,frozen.basis.preservation.acknowledgement))fail('WORKSPACE_RECLAMATION_BASIS_CHANGED');return frozen;}
 function bound(i:{permit:ExecutionPermit;operationId:string;requestHash:string}){const r=required(i.operationId),record=owned(r,i.permit,true);if(r.request_hash!==i.requestHash)fail('WORKSPACE_RECLAMATION_REQUEST_CHANGED');return {r,record};}
 const handlers={
  beginWorkspaceReclamation(i:WorkspaceReclamationInput<'beginWorkspaceReclamation'>){return transaction(db,()=>{
   const previous=get('SELECT * FROM workspace_reclamations WHERE operation_id=?',i.operationId);if(previous){const original=owned(previous,i.permit);if(original.preservationOperationId!==i.preservationOperationId)fail('IDEMPOTENCY_KEY_REUSED');return {...original,created:false};}
   const p=archive(i.permit,i.preservationOperationId,true),m=p.manifest!;if(!isAbsolute(m.snapshot.root)||p.basis.allocation.attemptId!==m.snapshot.root.split(/[\\/]/).at(-1))fail('WORKSPACE_RECLAMATION_PATH_INVALID');
   const sourcePath=m.snapshot.root,trashPath=join(dirname(dirname(sourcePath)),'trash',i.operationId),basis={preservation:p,sourcePath,trashPath};
   if(get('SELECT 1 FROM workspace_reclamations WHERE workspace_ref=?',p.workspaceRef))fail('WORKSPACE_RECLAMATION_RECONCILIATION_REQUIRED');
   if(['repo_operations','repo_file_operations','workspace_allocations','source_archives','candidate_integrations','workspace_preservations'].some(table=>get('SELECT 1 FROM '+table+' WHERE operation_id=?',i.operationId)))fail('IDEMPOTENCY_KEY_REUSED');
   const requestHash=digest(canonical({preservationOperationId:i.preservationOperationId,principalId:p.principalId,workspaceRef:p.workspaceRef,manifestSha256:p.acknowledgement!.manifestSha256}));exec("INSERT INTO workspace_reclamations(operation_id,preservation_operation_id,workspace_ref,project_id,principal_id,request_hash,basis_json,state,created_at) VALUES(?,?,?,?,?,?,?,'PREPARED',?)",i.operationId,i.preservationOperationId,p.workspaceRef,p.basis.allocation.projectId,p.principalId,requestHash,canonical(basis),new Date().toISOString());return {...view(required(i.operationId)),created:true};
  });},
  getWorkspaceReclamation(i:WorkspaceReclamationInput<'getWorkspaceReclamation'>){return owned(required(i.operationId),i.permit);},
  assertWorkspaceReclamationReady(i:WorkspaceReclamationInput<'assertWorkspaceReclamationReady'>){return owned(required(i.operationId),i.permit,true);},
  markWorkspaceIsolationSent(i:WorkspaceReclamationInput<'markWorkspaceIsolationSent'>){return transaction(db,()=>{const {record}=bound(i);if(record.isolationIntentSha256){if(record.isolationIntentSha256!==i.receiptSha256)fail('WORKSPACE_RECLAMATION_INTENT_CHANGED');return record;}if(record.state!=='PREPARED')fail('WORKSPACE_RECLAMATION_CLOSED');exec("UPDATE workspace_reclamations SET state='ISOLATION_SENT',isolation_intent_hash=?,error_code=NULL WHERE operation_id=?",i.receiptSha256,i.operationId);return view(required(i.operationId));});},
  acknowledgeWorkspaceIsolation(i:WorkspaceReclamationInput<'acknowledgeWorkspaceIsolation'>){return transaction(db,()=>{const {record}=bound(i);if(!record.isolationIntentSha256||!same(i.proof.trashIdentity,record.basis.preservation.manifest!.snapshot.identity)||i.proof.manifestSha256!==record.basis.preservation.acknowledgement!.manifestSha256)fail('WORKSPACE_RECLAMATION_ISOLATION_UNPROVEN');if(record.isolationProof){if(!same(record.isolationProof,i.proof))fail('WORKSPACE_RECLAMATION_PROOF_IMMUTABLE');return record;}if(record.state!=='ISOLATION_SENT')fail('WORKSPACE_RECLAMATION_CLOSED');exec("UPDATE workspace_reclamations SET state='ISOLATED',isolation_proof_json=?,error_code=NULL WHERE operation_id=?",canonical(i.proof),i.operationId);return view(required(i.operationId));});},
  markWorkspaceDeletionSent(i:WorkspaceReclamationInput<'markWorkspaceDeletionSent'>){return transaction(db,()=>{const {record}=bound(i);if(record.deleteIntentSha256){if(record.deleteIntentSha256!==i.receiptSha256)fail('WORKSPACE_RECLAMATION_INTENT_CHANGED');return record;}if(record.state!=='ISOLATED')fail('WORKSPACE_RECLAMATION_CLOSED');exec("UPDATE workspace_reclamations SET state='DELETE_SENT',delete_intent_hash=?,error_code=NULL WHERE operation_id=?",i.receiptSha256,i.operationId);return view(required(i.operationId));});},
  acknowledgeWorkspaceDeletion(i:WorkspaceReclamationInput<'acknowledgeWorkspaceDeletion'>){return transaction(db,()=>{const {record}=bound(i);if(!record.deleteIntentSha256)fail('WORKSPACE_RECLAMATION_DELETION_UNPROVEN');if(record.deletionProof){if(!same(record.deletionProof,i.proof))fail('WORKSPACE_RECLAMATION_PROOF_IMMUTABLE');return record;}if(record.state!=='DELETE_SENT')fail('WORKSPACE_RECLAMATION_CLOSED');exec("UPDATE workspace_reclamations SET state='DELETED',deletion_proof_json=?,error_code=NULL WHERE operation_id=?",canonical(i.proof),i.operationId);return view(required(i.operationId));});},
  markWorkspaceReclamationUncertain(i:WorkspaceReclamationInput<'markWorkspaceReclamationUncertain'>){return transaction(db,()=>{const {record}=bound(i);if(record.state!=='DELETED')exec('UPDATE workspace_reclamations SET error_code=? WHERE operation_id=?',i.errorCode,i.operationId);return view(required(i.operationId));});},
 };
 return {execute(method:WorkspaceReclamationMethod,input:unknown):unknown{return (handlers[method] as (i:unknown)=>unknown)(parseContract(workspaceReclamationRequests[method],input));}};
}
