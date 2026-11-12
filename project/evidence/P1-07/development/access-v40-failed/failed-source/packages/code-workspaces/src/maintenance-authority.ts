import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerAuthority} from '@devmesh/runner';
import {WorkspaceError} from './git.js';
/** Explicit local-development bridge for the Runner's separate cleanup scope.
 * The Runner authenticates controllerId before invoking this callback. Normal
 * execution authority and workspace admission are configured separately. */
export function createLocalWorkspaceCleanupAuthority(options:{mode:'local-development';storage:SqliteStorage;controllerId:string;runnerId:string}):NonNullable<RunnerAuthority['verifyWorkspaceCleanup']>{
 if(options.mode!=='local-development'||!options.storage||!options.controllerId||!options.runnerId)throw new WorkspaceError('WORKSPACE_MAINTENANCE_NOT_CONFIGURED');
 return async(controllerId,permit,workspaceRef,parentOperationId)=>{
  if(controllerId!==options.controllerId)throw new WorkspaceError('WORKSPACE_MAINTENANCE_CONTROLLER_DENIED');const record=await options.storage.request('authorizeWorkspaceMaintenance',{permit,workspaceRef,operationId:parentOperationId,runnerId:options.runnerId});
  if(record.operationId!==parentOperationId||record.workspaceRef!==workspaceRef||record.runnerId!==options.runnerId||permit.ownerKind!=='workflowAttempt'||record.attemptId!==permit.attemptId||record.activationId!==permit.activationId||record.grantId!==permit.grantId)throw new WorkspaceError('WORKSPACE_MAINTENANCE_DENIED');
 };
}

/** Local managed-code execution, allocation fencing and cleanup all resolve
 * committed SQLite authority. A partial allocation can be fenced for recovery,
 * but it cannot admit a new job until its original READY fact exists. */
export function createLocalManagedRunnerAuthority(options:{mode:'local-development';storage:SqliteStorage;controllerId:string;runnerId:string}):RunnerAuthority{
 const cleanup=createLocalWorkspaceCleanupAuthority(options);
 const verify=async(controllerId:string,permit:Parameters<RunnerAuthority['verify']>[2],workspaceRef:string,purpose:'execution'|'fence')=>{
  if(controllerId!==options.controllerId)throw new WorkspaceError('WORKSPACE_MAINTENANCE_CONTROLLER_DENIED');const record=await options.storage.request('authorizeManagedWorkspaceAccess',{permit,workspaceRef,runnerId:options.runnerId,purpose});if(record.workspaceRef!==workspaceRef||record.runnerId!==options.runnerId||permit.ownerKind!=='workflowAttempt'||record.attemptId!==permit.attemptId||record.activationId!==permit.activationId||record.grantId!==permit.grantId)throw new WorkspaceError('WORKSPACE_EXECUTION_DENIED');
 };
 return {verify:(controller,request,permit)=>verify(controller,permit,request.workspaceRef,'execution'),verifyWorkspace:(controller,permit,workspaceRef)=>verify(controller,permit,workspaceRef,'fence'),verifyWorkspaceCleanup:cleanup};
}
