import {createHash} from 'node:crypto';
import {parseContract,executionPermit,gitCommit} from '@devmesh/contracts';
import type {ExecutionHostView,RuntimeWorkspaceResult} from '@devmesh/storage-sqlite';
import {canonical} from '@devmesh/storage-sqlite';
import {LocalManagedWorkspaces} from './allocation.js';
import {LocalSourceArchives} from './source-archives.js';
import {WorkspaceError} from './git.js';
const fail=(code:string):never=>{throw new WorkspaceError(code);};
/** Local-only deployment composition. Physical paths stay in trusted backends. */
export function createLocalManagedRuntimeLifecycle(options:{mode:'local-development';allocator:LocalManagedWorkspaces;archives:LocalSourceArchives}){
 if(options.mode!=='local-development'||options.allocator.options.storage!==options.archives.options.storage||options.allocator.options.fencer!==options.archives.options.fencer||options.allocator.controlDataRoot!==options.archives.controlDataRoot||options.allocator.runnerDataRoot!==options.archives.runnerDataRoot)fail('RUNTIME_WORKSPACE_BACKEND_CHANGED');
 const {allocator,archives}=options,config=Object.freeze({schemaVersion:'devmesh.managed-runtime.v1' as const,runnerId:allocator.options.runnerId});
 const permit=(host:Readonly<ExecutionHostView>)=>{const p=parseContract(executionPermit,host.permit);if(p.ownerKind!=='workflowAttempt'||p.activationId!==host.activationId||p.attemptId!==host.attemptId||p.grantId!==host.grantId||p.runId!==host.runId)fail('RUNTIME_WORKSPACE_OWNER_CHANGED');return p;};
 const bound=async(host:Readonly<ExecutionHostView>,result:RuntimeWorkspaceResult)=>{
  if(result.activationId!==host.activationId)fail('RUNTIME_WORKSPACE_OWNER_CHANGED');const p=permit(host),a=await allocator.options.storage.request('getWorkspaceAllocation',{permit:p,operationId:result.allocationOperationId});
  if(a.runnerId!==config.runnerId||a.state!=='READY'||a.baseCommit!==host.inputManifest.codeCommit)fail('RUNTIME_WORKSPACE_ALLOCATION_UNPROVEN');return p;
 };
 return {config,async prepare(host:Readonly<ExecutionHostView>,signal:AbortSignal){
  const p=permit(host),workspaces=p.resources.filter(r=>r.kind==='workspace'&&r.access==='write'),repos=p.resources.filter(r=>r.kind==='projectRepository');if(workspaces.length!==1||repos.length!==1)fail('RUNTIME_WORKSPACE_RESOURCE_UNPROVEN');
  const role=host.roleSnapshot.role;if(role!=='developer'&&role!=='tester')fail('RUNTIME_WORKSPACE_ROLE_CHANGED');
  const operationId='op_'+createHash('sha256').update('runtime-workspace\0'+host.activationId).digest('hex');
  const {record}=await allocator.allocate({permit:p,operationId,workspaceRef:workspaces[0]!.resourceId,repositoryResourceId:repos[0]!.resourceId,runnerId:config.runnerId,kind:role==='developer'?'development':'verification',baseCommit:parseContract(gitCommit,host.inputManifest.codeCommit)},signal);
  return {schemaVersion:'devmesh.runtime-workspace.v1',workspaceRef:record.workspaceRef,allocationOperationId:record.operationId,baseCommit:record.baseCommit,manifestSha256:record.manifest!.sha256};
 },async retain(host:Readonly<ExecutionHostView>,result:RuntimeWorkspaceResult,signal:AbortSignal){
  const p=await bound(host,result);if(!result.archiveOperationId)return;
  const record=await archives.archive({permit:p,operationId:result.archiveOperationId,allocationOperationId:result.allocationOperationId,commitOperationId:result.commitOperationId!},signal);if(record.state!=='ACKNOWLEDGED')throw new WorkspaceError('RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED','unknown');
 },async reconcile(host:Readonly<ExecutionHostView>,result:RuntimeWorkspaceResult,signal:AbortSignal){
  const p=await bound(host,result);if(!result.archiveOperationId)return;
  // reconcile uses the existing archive record and only verifies its refs and
  // manifest; no object transfer, checkout or model/tool invocation is replayed.
  const original=await archives.options.storage.request('getSourceArchive',{permit:p,operationId:result.archiveOperationId});
  if(original.allocationOperationId!==result.allocationOperationId||original.commitOperationId!==result.commitOperationId)fail('RUNTIME_SOURCE_ARCHIVE_BASIS_CHANGED');
  const record=await archives.reconcile({permit:p,operationId:result.archiveOperationId},signal);if(record.state!=='ACKNOWLEDGED'||canonical(record.basis.allocation)!==canonical(original.basis.allocation))throw new WorkspaceError('RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED','unknown');
 }};
}
