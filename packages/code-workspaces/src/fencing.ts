import {randomUUID} from 'node:crypto';
import {mkdir,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {opaqueKey} from '@devmesh/contracts';
import {canonicalRoot,assertSeparate} from '@devmesh/blob-store';
import {acquireWriterLock,canonical} from '@devmesh/storage-sqlite';
import {acquireWorkspaceFence} from '@devmesh/runner';
import type {RunnerClient,WorkspaceFence} from '@devmesh/runner';
import type {AllocationFence,AllocationFencer} from './allocation.js';
import {WorkspaceError} from './git.js';

export interface LocalRunnerFencerOptions {
  mode:'local-development';runner:RunnerClient;controlDataRoot:string;runnerDataRoot:string;backupRoot:string;
  /** Explicit dead-owner tokens; never infer recovery from time or expired grants. */
  recoveryTokens?:ReadonlyMap<string,string>;
}
export class LocalRunnerWorkspaceFencer implements AllocationFencer {
  readonly controlDataRoot:string;readonly runnerDataRoot:string;readonly #recovery:ReadonlyMap<string,string>;
  constructor(readonly options:LocalRunnerFencerOptions){
    if(options.mode!=='local-development'||!['localhost','127.0.0.1','[::1]'].includes(options.runner.base.hostname))throw new WorkspaceError('WORKSPACE_LOCAL_FENCING_REQUIRED');
    this.controlDataRoot=canonicalRoot(options.controlDataRoot);this.runnerDataRoot=canonicalRoot(options.runnerDataRoot);assertSeparate([this.controlDataRoot,this.runnerDataRoot,canonicalRoot(options.backupRoot)]);this.#recovery=new Map(options.recoveryTokens);
  }
  private async active(workspaceRef:string){try{return await this.options.runner.activeWorkspaceFence(workspaceRef);}catch(e){if((e as {status?:number}).status===404)return null;throw e;}}
  private async releaseRunner(fence:WorkspaceFence){
    let observed:WorkspaceFence;
    try{observed=await this.options.runner.releaseWorkspaceFence(fence.fenceId,{holderToken:fence.holderToken,requestHash:fence.requestHash});}
    catch(error){try{observed=await this.options.runner.getWorkspaceFence(fence.fenceId);}catch{throw error;}if(observed.state!=='RELEASED')throw error;}
    if(observed.fenceId!==fence.fenceId||observed.holderToken!==fence.holderToken||observed.requestHash!==fence.requestHash||observed.state!=='RELEASED')throw new WorkspaceError('WORKSPACE_FENCE_RELEASE_UNKNOWN','unknown');
  }
  async acquire(input:Parameters<AllocationFencer['acquire']>[0],signal:AbortSignal):Promise<AllocationFence>{
    opaqueKey.parse(input.resourceId);opaqueKey.parse(input.operationId);if(signal.aborted)throw new WorkspaceError('GIT_ABORTED');
    if(!['project','workspace'].includes(input.kind)||await realpath(canonicalRoot(input.directoryRoot))!==await realpath(input.kind==='project'?this.controlDataRoot:this.runnerDataRoot))throw new WorkspaceError('WORKSPACE_FENCE_ROOT_CHANGED');
    const lockRoot=join(input.kind==='project'?this.controlDataRoot:this.runnerDataRoot,input.kind==='project'?'locks':'registry','code-locks');canonicalRoot(lockRoot);await mkdir(lockRoot,{recursive:true,mode:0o700});canonicalRoot(lockRoot);
    const recovery=this.#recovery.get(input.kind+':'+input.resourceId),lock=acquireWriterLock(join(lockRoot,input.resourceId),recovery);let fence:WorkspaceFence|undefined;
    try{
      if(input.kind==='workspace'){
        if(!input.permit||input.permit.ownerKind!=='workflowAttempt')throw new WorkspaceError('WORKSPACE_PERMIT_REQUIRED');const expected=join(await realpath(this.runnerDataRoot),'workspaces',input.permit.attemptId,'repo');
        const old=await this.active(input.resourceId);
        if(old){if(!recovery||old.holderToken!==recovery||old.workspacePath!==expected)throw new WorkspaceError('WORKSPACE_FENCE_RECOVERY_REQUIRED');await this.releaseRunner(old);}
        const request=acquireWorkspaceFence.parse({operationId:'op_'+randomUUID().replaceAll('-',''),parentOperationId:input.operationId,workspaceRef:input.resourceId,permit:structuredClone(input.permit),holderToken:lock.token});
        try{fence=await this.options.runner.acquireWorkspaceFence(request);}catch(error){try{fence=await this.options.runner.workspaceFenceByOperation(request.operationId);}catch{throw error;}}
        if(!fence||fence.operationId!==request.operationId||fence.workspaceRef!==input.resourceId||fence.workspacePath!==expected||fence.holderToken!==lock.token||fence.state!=='ACTIVE'||canonical(fence.request)!==canonical(request))throw new WorkspaceError('WORKSPACE_FENCE_ACQUIRE_UNKNOWN','unknown');
      }
      if(signal.aborted){if(fence)await this.releaseRunner(fence);throw new WorkspaceError('GIT_ABORTED');}
      let released=false;return {release:async()=>{if(released)return;if(fence)await this.releaseRunner(fence);lock.release();released=true;}};
    }catch(error){
      // No Git action has been admitted yet. An unresolved Runner barrier stays
      // durable and blocks new jobs; it is never cleared by this error path.
      lock.release();throw error;
    }
  }
}
