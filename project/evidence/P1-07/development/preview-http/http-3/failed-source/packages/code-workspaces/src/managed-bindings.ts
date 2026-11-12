import {realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {executionPermit,opaqueKey} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import {canonicalRoot} from '@devmesh/blob-store';
import {WorkspaceError} from './git.js';

/** Trusted MCP resolver. Filesystem identity comes from the original durable
 * allocation ACK, including on the very first tool call after startup. */
export function createLocalManagedBindingResolver(options:{mode:'local-development';storage:SqliteStorage;runnerId:string;runnerDataRoot:string}){
 if(options.mode!=='local-development')throw new WorkspaceError('WORKSPACE_BACKEND_NOT_CONFIGURED');opaqueKey.parse(options.runnerId);const root=canonicalRoot(options.runnerDataRoot);
 return async(workspaceRef:string,permit:ExecutionPermit)=>{
  const {allocation:a,repository:r}=await options.storage.request('getManagedWorkspaceBinding',{workspaceRef,permit:executionPermit.parse(permit),runnerId:options.runnerId}),identity=a.identity!;
  const expected=join(await realpath(root),'workspaces',a.attemptId,'repo');if(identity.root!==expected||identity.gitDirectory!==join(expected,'.git')||identity.commonDirectory!==identity.gitDirectory)throw new WorkspaceError('WORKSPACE_REPO_BINDING_CHANGED');
  return {workspaceRef:a.workspaceRef,resourceId:a.workspaceRef,projectResourceId:r.resourceId,projectId:a.projectId,runId:a.runId,attemptId:a.attemptId,baseCommit:a.baseCommit,root:identity.root,gitDirectory:identity.gitDirectory,commonDirectory:identity.commonDirectory,identity:structuredClone(identity)};
 };
}
