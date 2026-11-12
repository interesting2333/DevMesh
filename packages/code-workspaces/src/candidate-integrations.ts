import {createHash} from 'node:crypto';
import {lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalRoot,assertSeparate} from '@devmesh/blob-store';
import {canonical} from '@devmesh/storage-sqlite';
import type {CandidateBasis,CandidateIntegration,CandidateIntegrationStep,GitDirectoryIdentity,Request,SqliteStorage} from '@devmesh/storage-sqlite';
import type {AllocationFence,AllocationFencer} from './allocation.js';
import {ControlledGit,WorkspaceError} from './git.js';

type Merge=Awaited<ReturnType<ControlledGit['mergeTree']>>;
export interface CandidateConflictContext {record:CandidateIntegration;basis:CandidateBasis;step:CandidateIntegrationStep;repository:ControlledGit;signal:AbortSignal}
export type CandidateMerge=Merge;
export interface LocalCandidateIntegrationOptions {
 mode:'local-development';storage:SqliteStorage;controlDataRoot:string;runnerDataRoot:string;backupRoot:string;fencer:AllocationFencer;
 conflicts?:{capture(context:CandidateConflictContext,merge:Merge):Promise<void>;recoverReport(context:CandidateConflictContext):Promise<Merge|null>;publish(context:CandidateConflictContext,merge:Merge):Promise<CandidateIntegration>;reconcile(context:CandidateConflictContext):Promise<CandidateIntegration>};
}
function deny(code:string):never{throw new WorkspaceError(code,'unknown');}
const hash=(bytes:string)=>createHash('sha256').update(bytes).digest('hex');
const original=(r:CandidateIntegration)=>({principalId:r.principalId,operationId:r.operationId,requestHash:r.requestHash});
const query=(r:CandidateIntegration)=>({principalId:r.principalId,operationId:r.operationId});
async function identity(provider:ControlledGit):Promise<GitDirectoryIdentity>{
 await provider.validate();const {root,gitDirectory,commonDirectory}=provider.identity,[r,g]=await Promise.all([lstat(root,{bigint:true}),lstat(gitDirectory,{bigint:true})]);
 return {root,gitDirectory,commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};
}

/** Explicit local project service. No model-controlled SHA, argv or Host resurrection. */
export class LocalCandidateIntegrations {
 readonly controlDataRoot:string;
 constructor(readonly options:LocalCandidateIntegrationOptions){
  if(options.mode!=='local-development'||typeof options.fencer?.acquire!=='function')throw new WorkspaceError('CANDIDATE_BACKEND_NOT_CONFIGURED');
  this.controlDataRoot=canonicalRoot(options.controlDataRoot);assertSeparate([this.controlDataRoot,canonicalRoot(options.runnerDataRoot),canonicalRoot(options.backupRoot)]);
 }
 private async project(basis:CandidateBasis){
  const expected=join(await realpath(this.controlDataRoot),'repositories',basis.projectId,'repo.git');if(basis.repository.identity.root!==expected)deny('CANDIDATE_REPOSITORY_CHANGED');
  const provider=await ControlledGit.open(expected,'bare');if(canonical(await identity(provider))!==canonical(basis.repository.identity))deny('CANDIDATE_REPOSITORY_CHANGED');return provider;
 }
 private async source(provider:ControlledGit,source:CandidateBasis['sources'][number],signal:AbortSignal){
  if(await provider.readRef(source.archiveRef,signal)!==source.commit||await provider.readRef(source.sourceRef,signal)!==source.commit)deny('CANDIDATE_SOURCE_RETENTION_UNPROVEN');
  const commit=await provider.commit(source.commit,signal),manifest=await provider.manifest(source.commit,signal);
  if(commit.parents.length!==1||commit.parents[0]!==source.baseCommit||commit.tree!==source.tree||manifest.sha256!==source.manifestSha256)deny('CANDIDATE_SOURCE_CHANGED');
 }
 private async acknowledgeStep(record:CandidateIntegration,basis:CandidateBasis,step:CandidateIntegrationStep,provider:ControlledGit,signal:AbortSignal){
  const p=step.preparation;if(!p?.clean||!p.commit||!p.commitBody||!p.ref)deny('CANDIDATE_STEP_UNPREPARED');
  if(await provider.readRef(p.ref,signal)!==p.commit)deny('CANDIDATE_STEP_OUTCOME_UNKNOWN');
  const commit=await provider.commit(p.commit,signal);if(commit.body!==p.commitBody||commit.tree!==p.tree||canonical(commit.parents)!==canonical([step.ours,step.theirs]))deny('CANDIDATE_STEP_PROOF_CHANGED');
  const proof={repositoryIdentity:await identity(provider),commit:p.commit,tree:p.tree,ref:p.ref};if(canonical(proof.repositoryIdentity)!==canonical(basis.repository.identity))deny('CANDIDATE_REPOSITORY_CHANGED');
  try{return await this.options.storage.request('acknowledgeCandidateStep',{...original(record),ordinal:step.ordinal,proof});}
  catch(error){const old=await this.options.storage.request('getCandidateIntegrationStep',{...query(record),ordinal:step.ordinal}).catch(()=>null);if(old?.state==='ACKNOWLEDGED'&&canonical(old.acknowledgement)===canonical(proof))return old;throw error;}
 }
 private async acknowledge(record:CandidateIntegration,basis:CandidateBasis,provider:ControlledGit,signal:AbortSignal){
  const manifest=await this.options.storage.request('getCandidateIntegrationManifest',query(record));if(!manifest)deny('CANDIDATE_INTEGRATION_UNPREPARED');
  // The two unique original refs prove the entire atomic transaction, even if
  // a later operation has moved the global Run ref since its first completion.
  for(const update of record.updates.filter(update=>update.expected===null&&!update.ref.startsWith('refs/devmesh/candidates/')))if(await provider.readRef(update.ref,signal)!==update.commit)deny('CANDIDATE_CAS_OUTCOME_UNKNOWN');
  if(canonical(await provider.manifest(manifest.commit,signal))!==canonical(manifest))deny('CANDIDATE_MANIFEST_CHANGED');
  const acknowledgement={repositoryIdentity:await identity(provider),refs:record.updates.map(({ref,commit})=>({ref,commit})),manifestSha256:manifest.sha256};if(canonical(acknowledgement.repositoryIdentity)!==canonical(basis.repository.identity))deny('CANDIDATE_REPOSITORY_CHANGED');
  try{return await this.options.storage.request('acknowledgeCandidateIntegration',{...original(record),acknowledgement});}
  catch(error){const old=await this.options.storage.request('getCandidateIntegration',query(record)).catch(()=>null);if(old?.state==='ACKNOWLEDGED'&&canonical(old.acknowledgement)===canonical(acknowledgement))return old;throw error;}
 }
  private async retainedInput(record:CandidateIntegration,provider:ControlledGit,signal:AbortSignal){
   if(!record.originOperationId)deny('CANDIDATE_PROMOTION_UNPROVEN');
   const input={principalId:record.principalId,operationId:record.originOperationId},origin=await this.options.storage.request('getCandidateIntegration',input),basis=await this.options.storage.request('getCandidateIntegrationBasis',input);
   if(origin.state!=='ACKNOWLEDGED'||origin.purpose!=='work-input'||origin.originOperationId||!origin.manifest)deny('CANDIDATE_PROMOTION_UNPROVEN');
   for(const source of basis.sources)await this.source(provider,source,signal);
   for(const ref of origin.updates)if(ref.ref.startsWith('refs/devmesh/candidates/')||await provider.readRef(ref.ref,signal)!==ref.commit)deny('CANDIDATE_SNAPSHOT_REF_CHANGED');
   for(let ordinal=0;ordinal<basis.sources.length;ordinal++){const step=await this.options.storage.request('getCandidateIntegrationStep',{...input,ordinal});if(!step||step.state!=='ACKNOWLEDGED')deny('CANDIDATE_PROMOTION_UNPROVEN');await this.acknowledgeStep(origin,basis,step,provider,signal);}
   const manifest=await provider.manifest(origin.manifest.commit,signal),retained=await this.options.storage.request('getCandidateIntegrationManifest',input);
   if(canonical(manifest)!==canonical(retained))deny('CANDIDATE_MANIFEST_CHANGED');return manifest;
  }
  async integrate(input:Request<'beginCandidateIntegration'>,signal=new AbortController().signal):Promise<CandidateIntegration>{
  const {created:_created,...initial}=await this.options.storage.request('beginCandidateIntegration',input);let record:CandidateIntegration=initial;if(['ACKNOWLEDGED','CONFLICT','FAILED'].includes(record.state))return record;
  const basis=await this.options.storage.request('getCandidateIntegrationBasis',query(record));let fence:AllocationFence|undefined;
  try{
   fence=await this.options.fencer.acquire({kind:'project',directoryRoot:this.controlDataRoot,resourceId:basis.repository.resourceId,operationId:record.operationId},signal);
   const provider=await this.project(basis);
   if(record.state==='CONFLICT_PENDING'){
    const ordinal=record.acknowledgedSteps,step=await this.options.storage.request('getCandidateIntegrationStep',{...query(record),ordinal});if(!step||step.state!=='CONFLICT_PENDING')deny('CANDIDATE_CONFLICT_UNPROVEN');
    return this.options.conflicts?await this.options.conflicts.reconcile({record,basis,step,repository:provider,signal}):record;
   }
   if(record.originOperationId&&['BUILDING','PREPARED'].includes(record.state)){
    const manifest=await this.retainedInput(record,provider,signal);
    record=await this.options.storage.request('prepareCandidateIntegration',{...original(record),manifest});
   }
   for(let ordinal=0;record.state==='BUILDING'&&ordinal<basis.sources.length;ordinal++){
    let step=await this.options.storage.request('getCandidateIntegrationStep',{...query(record),ordinal}),created=false;
    if(step?.state==='ACKNOWLEDGED')continue;
    if(!step){await this.source(provider,basis.sources[ordinal]!,signal);const begun=await this.options.storage.request('beginCandidateStep',{...original(record),ordinal});step=begun;created=begun.created;}
    if(step.state==='COMPUTING'){
     const context={record,basis,step,repository:provider,signal};let merge:Merge;
     if(created){
      const bases=await provider.mergeBases(step.ours,step.theirs,signal);merge=await provider.mergeTree(bases,step.ours,step.theirs,signal);
      // Persist exact original report bytes before freezing the preparation.
      // A lost reply can then resume this computation without another merge.
      if(this.options.conflicts)await this.options.conflicts.capture(context,merge);
     }else{
      const originalReport=await this.options.conflicts?.recoverReport(context);if(!originalReport)deny('CANDIDATE_COMPUTATION_OUTCOME_UNKNOWN');merge=originalReport;
     }
     const reportSha256=hash(canonical(merge));
     try{step=await this.options.storage.request('prepareCandidateStep',{...original(record),ordinal,bases:merge.bases,tree:merge.tree,clean:merge.clean,reportSha256});}
     catch(error){const old=await this.options.storage.request('getCandidateIntegrationStep',{...query(record),ordinal}).catch(()=>null);if(!old?.preparation||old.preparation.reportSha256!==reportSha256||old.preparation.tree!==merge.tree||old.preparation.clean!==merge.clean)throw error;step=old;}
     if(!merge.clean){record=await this.options.storage.request('getCandidateIntegration',query(record));if(!this.options.conflicts)deny('CANDIDATE_CONFLICT_STORAGE_REQUIRED');return await this.options.conflicts.publish({record,basis,step,repository:provider,signal},merge);}
    }
    const p=step.preparation;if(!p?.clean||!p.commit||!p.commitBody||!p.ref)deny('CANDIDATE_STEP_UNPREPARED');
    const sent=await this.options.storage.request('markCandidateStepSent',{...original(record),ordinal});
    if(sent.send){if(await provider.writeCommit(p.commitBody,signal)!==p.commit)deny('CANDIDATE_COMMIT_CHANGED');await provider.updateRefs([{ref:p.ref,commit:p.commit,expected:null}],signal);}
    await this.acknowledgeStep(record,basis,step,provider,signal);
   }
   record=await this.options.storage.request('getCandidateIntegration',query(record));
   if(record.state==='BUILDING'){
    const last=basis.sources.length?await this.options.storage.request('getCandidateIntegrationStep',{...query(record),ordinal:basis.sources.length-1}):null,commit=last?.preparation?.commit??basis.baseCommit;
    record=await this.options.storage.request('prepareCandidateIntegration',{...original(record),manifest:await provider.manifest(commit,signal)});
   }
   const sent=await this.options.storage.request('markCandidateIntegrationSent',original(record));record=sent;
   if(sent.send&&!await provider.updateRefs(record.updates,signal)){
    const originals=record.updates.filter(update=>!update.ref.startsWith('refs/devmesh/candidates/'));let absent=true;for(const ref of originals)if(await provider.readRef(ref.ref,signal)!==null)absent=false;
    if(absent){const global=record.updates.find(update=>update.ref.startsWith('refs/devmesh/candidates/'));return await this.options.storage.request('recordCandidateCasRejection',{...original(record),originalRefsAbsent:true,gitChildExited:true,observedHead:global?await provider.readRef(global.ref,signal):null});}
   }
   return await this.acknowledge(record,basis,provider,signal);
  }catch(error){
   const code=(error as {code?:unknown})?.code,errorCode=typeof code==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(code)?code:'CANDIDATE_OUTCOME_UNKNOWN';
   // This succeeds only if no original computation/ref action is unresolved.
   const failed=await this.options.storage.request('failUnsentCandidateIntegration',{...original(record),errorCode}).catch(()=>null);
   if(!failed)await this.options.storage.request('markCandidateIntegrationUncertain',{...original(record),errorCode}).catch(()=>{});throw error;
  }finally{if(fence)await fence.release();}
 }
  /** Prepare a dependency-specific snapshot before scheduler admission. This is
   * a trusted hook, separate from its read-only resource planner. */
  async prepareWorkInput(input:{principalId:string;runId:string;workId:string},signal=new AbortController().signal){
   const subject={...input,purpose:'work-input' as const},basis=await this.options.storage.request('getCandidateSourceBasis',subject);
   if(basis.sources.length===0)return;
   let snapshot:CandidateIntegration;
   try{snapshot=await this.options.storage.request('getQualifiedCandidateSnapshot',subject);}
   catch(error){
    if((error as {code?:unknown})?.code!=='CANDIDATE_SNAPSHOT_UNAVAILABLE')throw error;
    // A stable original ID prevents a tick/process restart from replacing an
    // unresolved operation. Known failures require an explicit trusted retry.
    const operationId='op_'+hash(canonical({principalId:input.principalId,basisSha256:basis.sha256})).slice(0,32);
    snapshot=await this.integrate({...subject,operationId},signal);
   }
   if(snapshot.state!=='ACKNOWLEDGED'||snapshot.purpose!=='work-input'||snapshot.workId!==input.workId||snapshot.basisSha256!==basis.sha256||!snapshot.manifest)deny('CANDIDATE_SNAPSHOT_UNAVAILABLE');
   const fence=await this.options.fencer.acquire({kind:'project',directoryRoot:this.controlDataRoot,resourceId:basis.repository.resourceId,operationId:snapshot.operationId},signal);
   try{
    const provider=await this.project(basis);
    for(const ref of snapshot.updates){if(ref.ref.startsWith('refs/devmesh/candidates/')||await provider.readRef(ref.ref,signal)!==snapshot.manifest.commit)deny('CANDIDATE_SNAPSHOT_REF_CHANGED');}
    const manifest=await provider.manifest(snapshot.manifest.commit,signal);
    if(canonical({commit:manifest.commit,tree:manifest.tree,sha256:manifest.sha256})!==canonical(snapshot.manifest))deny('CANDIDATE_MANIFEST_CHANGED');
    await this.options.storage.request('assertCandidateSourceBasis',{...subject,basisSha256:basis.sha256});
    const current=await this.options.storage.request('getQualifiedCandidateSnapshot',subject);if(current.operationId!==snapshot.operationId||canonical(current.manifest)!==canonical(snapshot.manifest))deny('CANDIDATE_SNAPSHOT_CHANGED');
   }finally{await fence.release();}
  }
 async reconcile(input:Request<'getCandidateIntegration'>,signal=new AbortController().signal){
  const record=await this.options.storage.request('getCandidateIntegration',input);
   return this.integrate({principalId:input.principalId,operationId:input.operationId,runId:record.runId,purpose:record.purpose,...(record.workId?{workId:record.workId}:{}),...(record.originOperationId?{originOperationId:record.originOperationId}:{})},signal);
 }
}
