import { lstat,realpath } from 'node:fs/promises';
import { resolve,sep } from 'node:path';
import { executionPermit,parseContract,assertPermit } from '@devmesh/contracts';
import { canonicalRoot } from '@devmesh/blob-store';
import {canonical} from '@devmesh/storage-sqlite';
import { RunnerError,startJob,attemptKey } from './protocol.js';
import type { StartJob } from './protocol.js';
import type {WorkspaceBinding,AcquireWorkspaceFence} from './workspace-fence.js';
export interface RunnerPolicyConfig {
 runnerId:string;dataRoot:string;imageDigests:readonly string[];
 commands:Readonly<Partial<Record<StartJob['commandSpec']['kind'],readonly string[]>>>;
 maximumCpu:number;maximumMemoryMiB:number;maximumTemporaryMiB:number;
  workspaces:Readonly<Record<string,WorkspaceBinding>>;
}
export class RunnerPolicy {
 readonly config:RunnerPolicyConfig;
 constructor(config:RunnerPolicyConfig){const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};this.config=structuredClone(config);freeze(this.config);}
  async validate(input:unknown,stored?:WorkspaceBinding):Promise<{request:StartJob;workspacePath:string;argv:readonly string[]}>{
  const request=startJob.parse(input),c=this.config,limits=request.resourceLimits;
  if(!c.imageDigests.includes(request.imageDigest)||request.networkPolicyRef!=='none')throw new RunnerError('RUNNER_POLICY_DENIED',403);
  if(limits.cpu>c.maximumCpu||limits.memoryMiB>c.maximumMemoryMiB||limits.temporaryMiB>c.maximumTemporaryMiB)throw new RunnerError('RUNNER_RESOURCE_LIMIT',422);
  const argv=c.commands[request.commandSpec.kind];if(!argv?.length||argv.some(v=>typeof v!=='string'||v.includes('\0')))throw new RunnerError('RUNNER_COMMAND_DENIED',403);
   const configured=c.workspaces[request.workspaceRef];if(configured&&stored&&canonical(configured)!==canonical(stored))throw new RunnerError('RUNNER_WORKSPACE_BINDING_CHANGED',409);const w=configured??stored;if(!w)throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
   const {root,path}=await this.workspacePath(request.permit,w);
  let current=root;
  for(const component of w.relativePath.replaceAll('\\','/').split('/')){current=resolve(current,component);const stat=await lstat(current);if(stat.isSymbolicLink()||!stat.isDirectory())throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);}
  if(await realpath(path)!==path)throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
  return {request,workspacePath:path,argv};
 }
  private async workspacePath(permit:StartJob['permit'],w:WorkspaceBinding,cleanup=false){
   if(w.ownerKind!==permit.ownerKind||w.attemptId!==attemptKey(permit))throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
   // Cleanup has independent authenticated original-operation authority. A read
   // execution resource may be maintained, without admitting new writes or jobs.
   permit=parseContract(executionPermit,permit);if(cleanup){if(!permit.resources.some(r=>r.kind==='workspace'&&r.resourceId===w.resourceId))throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);}else {try{assertPermit(permit,permit,{kind:'workspace',resourceId:w.resourceId,access:'write'},Date.now());}catch{throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);}}
   canonicalRoot(this.config.dataRoot);const root=await realpath(this.config.dataRoot),path=resolve(root,w.relativePath),expected=(permit.ownerKind==='workflowAttempt'?'workspaces/':'invocations/')+attemptKey(permit)+(w.sourceDirectory==='repo'?'/repo':'');
   if(w.relativePath.replaceAll('\\','/')!==expected||!path.startsWith(root+sep)||['\0','\r','\n',','].some(c=>path.includes(c)))throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
   canonicalRoot(path);return {root,path};
  }
  async fence(input:AcquireWorkspaceFence,stored?:WorkspaceBinding){
   if(input.permit.ownerKind!=='workflowAttempt')throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
   const configured=this.config.workspaces[input.workspaceRef];if(configured&&stored&&canonical(configured)!==canonical(stored))throw new RunnerError('RUNNER_WORKSPACE_BINDING_CHANGED',409);const binding=configured??stored??{attemptId:input.permit.attemptId,ownerKind:'workflowAttempt' as const,resourceId:input.workspaceRef,relativePath:'workspaces/'+input.permit.attemptId+'/repo',sourceDirectory:'repo' as const};
   return {binding,workspacePath:(await this.workspacePath(input.permit,binding,input.purpose==='cleanup')).path};
  }
}
