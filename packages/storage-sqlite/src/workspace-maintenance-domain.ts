import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import {transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';
import {createWorkspaceDomain} from './workspace-domain.js';
import {createRepoDomain} from './repo-domain.js';
import {createRepoFileDomain} from './repo-file-domain.js';
import {createSourceArchiveDomain} from './source-archive-domain.js';
import {createWorkspacePreservationDomain} from './workspace-preservation-domain.js';
import {createWorkspaceReclamationDomain} from './workspace-reclamation-domain.js';
import {workspaceMaintenanceRequests} from './workspace-maintenance-protocol.js';
import type {WorkspaceMaintenanceAuthority,WorkspaceMaintenanceMethod} from './workspace-maintenance-protocol.js';
import type {WorkspaceAllocation,ManagedRepository} from './workspace-protocol.js';
import type {SourceArchive} from './source-archive-protocol.js';
import type {WorkspacePreservation} from './workspace-preservation-protocol.js';
import type {WorkspaceReclamation} from './workspace-reclamation-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code='WORKSPACE_MAINTENANCE_DENIED'):never{throw new StorageError(code,403,'Original workspace maintenance authority is unavailable');}
export function createWorkspaceMaintenanceDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,authority=createToolAuthorityDomain(db),workspaces=createWorkspaceDomain(db),repo=createRepoDomain(db),files=createRepoFileDomain(db),sources=createSourceArchiveDomain(db),preservations=createWorkspacePreservationDomain(db),reclamations=createWorkspaceReclamationDomain(db);
 return {execute(method:WorkspaceMaintenanceMethod,input:unknown):unknown{
 if(method==='getManagedWorkspaceBinding'){const i=parseContract(workspaceMaintenanceRequests.getManagedWorkspaceBinding,input);return transaction(db,()=>{
  const h=authority.workspaceMaintenance(i.permit),row=get('SELECT * FROM workspace_allocations WHERE workspace_ref=?',i.workspaceRef);if(!row)fail('WORKSPACE_BINDING_NOT_FOUND');
  const allocation=workspaces.execute('getWorkspaceAllocation',{permit:i.permit,operationId:row.operation_id}) as WorkspaceAllocation,repository=workspaces.execute('getAllocationRepository',{permit:i.permit,operationId:row.operation_id}) as ManagedRepository;
  if(allocation.runnerId!==i.runnerId||allocation.projectId!==h.projectId||allocation.state!=='READY'||!allocation.identity||!allocation.manifest||repository.state!=='READY'||!repository.identity||!i.permit.resources.some(r=>r.kind==='projectRepository'&&r.resourceId===repository.resourceId))fail('WORKSPACE_BINDING_UNAVAILABLE');return {allocation,repository};
 });}
 if(method==='authorizeManagedWorkspaceAccess'){const i=parseContract(workspaceMaintenanceRequests.authorizeManagedWorkspaceAccess,input),row=get('SELECT * FROM workspace_allocations WHERE workspace_ref=?',i.workspaceRef);if(!row||row.runner_id!==i.runnerId)fail();const allocation=workspaces.execute('authorizeWorkspaceAllocation',{permit:i.permit,operationId:row.operation_id}) as WorkspaceAllocation;if(i.purpose==='execution'){
  if(allocation.state!=='READY')fail('WORKSPACE_EXECUTION_NOT_READY');
  if(!get("SELECT 1 FROM accepted_work w JOIN a2a_tasks t ON t.endpoint_id=w.endpoint_id AND t.task_id=w.task_id JOIN a2a_task_ownership o ON o.endpoint_id=w.endpoint_id AND o.task_id=w.task_id WHERE w.activation_id=? AND t.attempt_id=? AND w.state='ACTIVE' AND w.claim_token IS NOT NULL AND o.cancel_requested=0",allocation.activationId,allocation.attemptId))fail('WORKSPACE_EXECUTION_HOST_CLOSED');
 }return allocation;}
 const i=parseContract(workspaceMaintenanceRequests.authorizeWorkspaceMaintenance,input);return transaction(db,()=>{
  const p=i.permit;if(p.ownerKind!=='workflowAttempt')fail();const current=authority.workspaceMaintenance(p),kinds=[['allocation','workspace_allocations'],['repoGit','repo_operations'],['repoFile','repo_file_operations'],['sourceArchive','source_archives'],['preservation','workspace_preservations'],['reclamation','workspace_reclamations']] as const,found=kinds.filter(([,table])=>get('SELECT 1 FROM '+table+' WHERE operation_id=?',i.operationId));
  if(found.length!==1)fail(found.length?'WORKSPACE_MAINTENANCE_OPERATION_AMBIGUOUS':'WORKSPACE_MAINTENANCE_OPERATION_NOT_FOUND');const kind=found[0]![0];let ref:string;
  switch(kind){case 'allocation':ref=(workspaces.execute('getWorkspaceAllocation',{permit:p,operationId:i.operationId}) as WorkspaceAllocation).workspaceRef;break;
   case 'repoGit':ref=repo.getOriginal(p,i.operationId).request.binding.workspaceRef;break;
   case 'repoFile':ref=files.getOriginal(p,i.operationId).request.binding.workspaceRef;break;
   case 'sourceArchive':ref=(sources.execute('getSourceArchive',{permit:p,operationId:i.operationId}) as SourceArchive).workspaceRef;break;
   case 'preservation':ref=(preservations.execute('getWorkspacePreservation',{permit:p,operationId:i.operationId}) as WorkspacePreservation).workspaceRef;break;
   case 'reclamation':ref=(reclamations.execute('assertWorkspaceReclamationReady',{permit:p,operationId:i.operationId}) as WorkspaceReclamation).workspaceRef;break;
  }
  if(ref!==i.workspaceRef)fail();const row=get('SELECT * FROM workspace_allocations WHERE workspace_ref=?',ref);if(!row)fail();const allocation=workspaces.execute('getWorkspaceAllocation',{permit:p,operationId:row.operation_id}) as WorkspaceAllocation,repository=get('SELECT * FROM managed_repositories WHERE project_id=?',allocation.projectId);
  if(!repository||allocation.projectId!==current.projectId||allocation.runnerId!==i.runnerId||allocation.runId!==p.runId||allocation.attemptId!==p.attemptId||allocation.activationId!==p.activationId||allocation.grantId!==p.grantId||!p.resources.some(r=>r.kind==='workspace'&&r.resourceId===ref)||!p.resources.some(r=>r.kind==='projectRepository'&&r.resourceId===repository.resource_id))fail();
  return {operationId:i.operationId,operationKind:kind,workspaceRef:ref,allocationOperationId:allocation.operationId,projectId:allocation.projectId,runnerId:allocation.runnerId,attemptId:allocation.attemptId,activationId:allocation.activationId,grantId:allocation.grantId} satisfies WorkspaceMaintenanceAuthority;
 });}};
}
