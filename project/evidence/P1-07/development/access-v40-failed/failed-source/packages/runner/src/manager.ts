import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { canonical } from '@devmesh/storage-sqlite';
import { RunnerError,renewJob,startJob } from './protocol.js';
import type { ExecutionBackend,Job,RenewJob,RunnerAuthority,StartJob,ContainerFact } from './protocol.js';
import { RunnerPolicy } from './policy.js';
import { RunnerStore } from './store.js';
import { RunnerMaterials } from './materials.js';
import type { InternalJob } from './store-protocol.js';
import {acquireWorkspaceFence,releaseWorkspaceFence} from './workspace-fence.js';
import type {AcquireWorkspaceFence} from './workspace-fence.js';

interface Watch {leaseDeadline:number;executionDeadline:number;sequence:number;timer:NodeJS.Timeout}
export interface ManagerOptions {maximumJobs?:number;pollIntervalMs?:number;onError?:(code:string)=>void}
export class RunnerManager {
 readonly #watch=new Map<string,Watch>();readonly #starts=new Set<string>();readonly #stops=new Map<string,Promise<void>>();readonly #background=new Set<Promise<void>>();
 #timer:NodeJS.Timeout|undefined;#tick:Promise<void>|undefined;#closed=false;#closing:Promise<void>|undefined;
 constructor(readonly store:RunnerStore,readonly policy:RunnerPolicy,readonly backend:ExecutionBackend,readonly authority:RunnerAuthority,readonly materials:RunnerMaterials,readonly options:ManagerOptions={}){
   if(policy.config.runnerId!==store.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
  if(!Number.isInteger(options.maximumJobs??4)||(options.maximumJobs??4)<1||(options.maximumJobs??4)>4||!Number.isInteger(options.pollIntervalMs??100)||(options.pollIntervalMs??100)<10)throw new RunnerError('RUNNER_CONFIG_INVALID',422);
 }
 private time(permit:StartJob['permit']){const now=Date.now(),from=Date.parse(permit.notBefore),until=Date.parse(permit.expiresAt);if(from>now||until<=now||until-from>15000)throw new RunnerError('RUNNER_LEASE_INVALID',403);return Math.min(15000,until-now);}
 private async verify(controllerId:string,request:StartJob,permit=request.permit){this.time(permit);try{await this.authority.verify(controllerId,request,permit);}catch{throw new RunnerError('RUNNER_AUTHORITY_DENIED',403);}this.time(permit);}
 async start(){if(this.#timer||this.#closed)throw new RunnerError('RUNNER_ALREADY_STARTED',409);await this.store.request('capacityConfigure',{maximumJobs:this.options.maximumJobs??4,cpu:this.policy.config.maximumCpu,memoryMiB:this.policy.config.maximumMemoryMiB});if(this.backend.configured)await this.backend.probe();for(const row of await this.store.request('active',{})){
   try{await this.verify(row.job.controllerId,row.job.request,row.leasePermit);this.watch(row);}catch{await this.store.request('stop',{controllerId:row.job.controllerId,jobId:row.job.jobId});this.background(this.stopOriginal(row.job));}
  }this.#timer=setInterval(()=>{if(!this.#tick)this.#tick=this.tick().catch(e=>this.report(e)).finally(()=>{this.#tick=undefined;});},this.options.pollIntervalMs??100);this.#timer.unref();}
 private report(error:unknown){this.options.onError?.(error instanceof RunnerError?error.code:'RUNNER_INTERNAL_ERROR');}
 private background(p:Promise<void>){this.#background.add(p);void p.catch(e=>this.report(e)).finally(()=>this.#background.delete(p));}
 async submit(controllerId:string,input:unknown){
  if(this.#closed||!this.backend.configured)throw new RunnerError('RUNNER_NOT_CONFIGURED',503,'not-sent');const request=startJob.parse(input);
  // Same-operation query remains possible even after the original permit expired.
  const existing=await this.store.request('byOperation',{controllerId,operationId:request.operationId});if(existing){if(canonical(existing.request)!==canonical(request))throw new RunnerError('IDEMPOTENCY_KEY_REUSED',409);return existing;}
   const binding=await this.store.request('workspaceBinding',{workspaceRef:request.workspaceRef}),execution=await this.policy.validate(request,binding??undefined);await this.verify(controllerId,request);
  return this.store.request('register',{controllerId,request,execution:{workspacePath:execution.workspacePath,argv:[...execution.argv]}});
 }
 get(controllerId:string,jobId:string){return this.store.request('get',{controllerId,jobId});}
  async acquireWorkspaceFence(controllerId:string,input:AcquireWorkspaceFence){
   const request=acquireWorkspaceFence.parse(input),cleanup=request.purpose==='cleanup';
   if(this.#closed||!(cleanup?this.authority.verifyWorkspaceCleanup:this.authority.verifyWorkspace))throw new RunnerError('RUNNER_FENCING_NOT_CONFIGURED',503,'not-sent');
   const stored=await this.store.request('workspaceBinding',{workspaceRef:request.workspaceRef}),binding=await this.policy.fence(request,stored??undefined);
   try{if(cleanup)await this.authority.verifyWorkspaceCleanup!(controllerId,request.permit,request.workspaceRef,request.parentOperationId);else await this.authority.verifyWorkspace!(controllerId,request.permit,request.workspaceRef);}catch{throw new RunnerError('RUNNER_AUTHORITY_DENIED',403);}
   return this.store.request('fenceAcquire',{controllerId,request,...binding});
  }
  getWorkspaceFence(controllerId:string,fenceId:string){return this.store.request('fenceGet',{controllerId,fenceId});}
  async workspaceFenceByOperation(controllerId:string,operationId:string){const value=await this.store.request('fenceByOperation',{controllerId,operationId});if(!value)throw new RunnerError('WORKSPACE_FENCE_NOT_FOUND',404);return value;}
  async activeWorkspaceFence(controllerId:string,workspaceRef:string){const value=await this.store.request('fenceActive',{controllerId,workspaceRef});if(!value)throw new RunnerError('WORKSPACE_FENCE_NOT_FOUND',404);return value;}
  releaseWorkspaceFence(controllerId:string,fenceId:string,input:unknown){return this.store.request('fenceRelease',{controllerId,fenceId,release:releaseWorkspaceFence.parse(input)});}
 async byOperation(controllerId:string,operationId:string){const job=await this.store.request('byOperation',{controllerId,operationId});if(!job)throw new RunnerError('JOB_NOT_FOUND',404);return job;}
 async renew(controllerId:string,jobId:string,input:RenewJob){
  const renewal=renewJob.parse(input),job=await this.get(controllerId,jobId);await this.verify(controllerId,job.request,renewal.permit);
  const changed=await this.store.request('renew',{controllerId,jobId,renewal});const row=(await this.store.request('active',{})).find(r=>r.job.jobId===jobId);
  if(row&&!row.job.stopRequested)this.watch(row);return changed;
 }
 async stop(controllerId:string,jobId:string){const job=await this.store.request('stop',{controllerId,jobId});if(job.state!=='EXITED')this.background(this.stopOriginal(job));return job;}
 private watch(row:InternalJob){
  const id=row.job.jobId,now=performance.now(),previous=this.#watch.get(id),leaseDeadline=Math.min(now+this.time(row.leasePermit),previous&&row.job.leaseSequence<=previous.sequence?previous.leaseDeadline:Infinity);
  const executionDeadline=previous?.executionDeadline??now+Math.max(0,row.job.request.resourceLimits.timeoutMs-Math.max(0,Date.now()-Date.parse(row.job.startedAt??row.job.createdAt)));
  if(previous)clearTimeout(previous.timer);
  const timer=setTimeout(()=>{this.background((async()=>{const job=await this.store.request('stop',{controllerId:row.job.controllerId,jobId:id});await this.stopOriginal(job);})());},Math.max(0,Math.min(leaseDeadline,executionDeadline)-now));timer.unref();
  this.#watch.set(id,{leaseDeadline,executionDeadline,sequence:row.job.leaseSequence,timer});
 }
 private async allowed(row:InternalJob){const current=(await this.store.request('active',{})).find(r=>r.job.jobId===row.job.jobId);if(!current)return false;const latest=current.job,w=this.#watch.get(latest.jobId);if(this.#closed||latest.stopRequested||!w||performance.now()>=Math.min(w.leaseDeadline,w.executionDeadline))return false;try{await this.verify(latest.controllerId,latest.request,current.leasePermit);return !this.#closed&&performance.now()<Math.min(w.leaseDeadline,w.executionDeadline);}catch{return false;}}
 private async fact(row:InternalJob,fact:ContainerFact|null){
  const job=await this.get(row.job.controllerId,row.job.jobId);if(job.state==='EXITED')return;
  if(!fact||fact.state==='unknown'||fact.state==='created'){await this.store.request('record',{jobId:job.jobId,state:'OUTCOME_UNKNOWN',containerId:fact?.containerId??null,exitCode:null,evidence:null,errorCode:'RUNNER_OUTCOME_UNKNOWN'});return;}
  if(fact.state==='exited'&&fact.pid===0&&fact.exitCode!==null&&!this.#starts.has(job.jobId)){
   let collected:{logCursor:number;outputRefs:Job['outputRefs']}|undefined;let errorCode:string|null=null;
   try{collected=await this.materials.collect(job,row.execution.workspacePath,this.backend);}catch{errorCode='RUNNER_MATERIALS_UNAVAILABLE';}
   await this.store.request('record',{jobId:job.jobId,state:'EXITED',containerId:fact.containerId,exitCode:fact.exitCode,evidence:{containerId:fact.containerId,pid:0,state:'exited',finishedAt:fact.finishedAt,verifiedAt:new Date().toISOString()},errorCode,...(collected?{materials:collected}:{})});
   const watch=this.#watch.get(job.jobId);if(watch)clearTimeout(watch.timer);this.#watch.delete(job.jobId);return;
  }
  if(job.stopRequested||fact.state!=='running'){await this.store.request('record',{jobId:job.jobId,state:job.stopRequested?'STOPPING':'OUTCOME_UNKNOWN',containerId:fact.containerId,exitCode:null,evidence:null,errorCode:null});return;}
  await this.store.request('record',{jobId:job.jobId,state:'RUNNING',containerId:fact.containerId,exitCode:null,evidence:null,errorCode:null});
 }
 private stopOriginal(job:Job):Promise<void>{
  const prior=this.#stops.get(job.jobId);if(prior)return prior;
  const action=(async()=>{try{const row=(await this.store.request('active',{})).find(r=>r.job.jobId===job.jobId);if(!row)return;let fact:ContainerFact|null=null;try{fact=await this.backend.stop(await this.get(job.controllerId,job.jobId));}catch{ /* Query the original job on the next tick; never invent an exit. */ }await this.fact(row,fact);}finally{this.#stops.delete(job.jobId);}})();this.#stops.set(job.jobId,action);return action;
 }
 async tick(){
  if(this.#closed||!this.backend.configured)return;
  for(const row of await this.store.request('active',{})){
   if(this.#starts.has(row.job.jobId)||this.#stops.has(row.job.jobId))continue;
   if(row.job.stopRequested||!await this.allowed(row)){await this.store.request('stop',{controllerId:row.job.controllerId,jobId:row.job.jobId});this.background(this.stopOriginal(row.job));continue;}
   try{await this.fact(row,await this.backend.inspect(row.job));}catch{await this.fact(row,null);}
  }
  for(const row of await this.store.request('pending',{limit:20})){
   try{await this.verify(row.job.controllerId,row.job.request,row.leasePermit);}catch{await this.store.request('stop',{controllerId:row.job.controllerId,jobId:row.job.jobId});continue;}
   const claimed=await this.store.request('claim',{jobId:row.job.jobId,maximumJobs:this.options.maximumJobs??4,cpu:this.policy.config.maximumCpu,memoryMiB:this.policy.config.maximumMemoryMiB});if(!claimed)continue;
   this.watch(claimed);this.#starts.add(claimed.job.jobId);
   this.background((async()=>{let fact:ContainerFact|null=null;try{fact=await this.backend.start(claimed.job,claimed.execution.workspacePath,claimed.execution.argv,()=>this.allowed(claimed));}catch{try{fact=await this.backend.inspect(claimed.job);}catch{/* Remains unknown. */}}finally{this.#starts.delete(claimed.job.jobId);}if((await this.get(claimed.job.controllerId,claimed.job.jobId)).stopRequested){await this.stopOriginal(claimed.job);}else await this.fact(claimed,fact);})());
  }
 }
 async readOutput(controllerId:string,jobId:string,index:number){const job=await this.get(controllerId,jobId),ref=job.outputRefs[index];if(!ref)throw new RunnerError('RUNNER_OUTPUT_NOT_FOUND',404);const bytes=await this.materials.read(ref.path);if(bytes.length!==ref.byteSize||createHash('sha256').update(bytes).digest('hex')!==ref.sha256)throw new RunnerError('RUNNER_OUTPUT_CORRUPT',409);return {ref,bytes};}
 close(){return this.#closing??=(async()=>{this.#closed=true;clearInterval(this.#timer);for(const w of this.#watch.values())clearTimeout(w.timer);this.#watch.clear();await this.#tick;for(const row of await this.store.request('active',{})){await this.store.request('stop',{controllerId:row.job.controllerId,jobId:row.job.jobId});await this.stopOriginal(row.job);}await Promise.allSettled(this.#background);})();}
}
