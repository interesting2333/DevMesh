import { lstat,realpath } from 'node:fs/promises';
import { resolve,sep } from 'node:path';
import { executionPermit,parseContract,assertPermit } from '@devmesh/contracts';
import { canonicalRoot } from '@devmesh/blob-store';
import { RunnerError,startJob,attemptKey } from './protocol.js';
import type { StartJob } from './protocol.js';
export interface RunnerPolicyConfig {
 runnerId:string;dataRoot:string;imageDigests:readonly string[];
 commands:Readonly<Partial<Record<StartJob['commandSpec']['kind'],readonly string[]>>>;
 maximumCpu:number;maximumMemoryMiB:number;maximumTemporaryMiB:number;
 workspaces:Readonly<Record<string,{attemptId:string;ownerKind:'workflowAttempt'|'invocationAttempt';resourceId:string;relativePath:string}>>;
}
export class RunnerPolicy {
 readonly config:RunnerPolicyConfig;
 constructor(config:RunnerPolicyConfig){const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};this.config=structuredClone(config);freeze(this.config);}
 async validate(input:unknown):Promise<{request:StartJob;workspacePath:string;argv:readonly string[]}>{
  const request=startJob.parse(input),c=this.config,limits=request.resourceLimits;
  if(!c.imageDigests.includes(request.imageDigest)||request.networkPolicyRef!=='none')throw new RunnerError('RUNNER_POLICY_DENIED',403);
  if(limits.cpu>c.maximumCpu||limits.memoryMiB>c.maximumMemoryMiB||limits.temporaryMiB>c.maximumTemporaryMiB)throw new RunnerError('RUNNER_RESOURCE_LIMIT',422);
  const argv=c.commands[request.commandSpec.kind];if(!argv?.length||argv.some(v=>typeof v!=='string'||v.includes('\0')))throw new RunnerError('RUNNER_COMMAND_DENIED',403);
  const w=c.workspaces[request.workspaceRef];if(!w||w.ownerKind!==request.permit.ownerKind||w.attemptId!==attemptKey(request.permit))throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
  const permit=parseContract(executionPermit,request.permit);assertPermit(permit,permit,{kind:'workspace',resourceId:w.resourceId,access:'write'},Date.now());
  canonicalRoot(c.dataRoot);const root=await realpath(c.dataRoot),path=resolve(root,w.relativePath);
  const expected=(permit.ownerKind==='workflowAttempt'?'workspaces/':'invocations/')+attemptKey(permit);
  if(w.relativePath.replaceAll('\\','/')!==expected||!path.startsWith(root+sep)||['\0','\r','\n',','].some(c=>path.includes(c)))throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
  let current=root;
  for(const component of w.relativePath.replaceAll('\\','/').split('/')){current=resolve(current,component);const stat=await lstat(current);if(stat.isSymbolicLink()||!stat.isDirectory())throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);}
  if(await realpath(path)!==path)throw new RunnerError('RUNNER_WORKSPACE_DENIED',403);
  return {request,workspacePath:path,argv};
 }
}
