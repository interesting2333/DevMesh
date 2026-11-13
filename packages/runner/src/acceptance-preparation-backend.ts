import {createHash} from 'node:crypto';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical,acceptancePreparationObservation} from '@devmesh/storage-sqlite';
import type {AcceptancePreparation,AcceptancePreparationBackend,AcceptancePreparationObservation} from '@devmesh/storage-sqlite';
import {RunnerStore} from './store.js';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {LocalSqliteAcceptanceDatasetBackend,validateAcceptanceDataset,validateAcceptanceFences} from './acceptance-dataset-backend.js';
import {acceptanceServiceRequest,acceptanceServiceProfile,acceptanceServiceNames} from './acceptance-service.js';
import type {AcceptanceServiceRequest,AcceptanceServiceReservation,AcceptanceServiceJournal,AcceptanceServiceDriver} from './acceptance-service.js';
import type {ServiceContainerFact} from './service-docker.js';
import {runnerCapacity,previewResourceLimits} from './preview-reservation.js';
import {previewRepository} from './preview-container.js';
import {probePreviewHealth} from './preview-health.js';
import {RunnerError} from './protocol.js';
const optionsSchema=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,repository:previewRepository,capacity:runnerCapacity,resourceLimits:previewResourceLimits,datasetBytes:z.number().int().min(4096).max(256*1024*1024).default(64*1024*1024)});
export type RunnerAcceptancePreparationOptions=z.input<typeof optionsSchema>;
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const bound=(r:AcceptanceServiceReservation)=>({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});
/** Explicit trusted composition. Infrastructure adapters are never inferred from
 * a client receipt or installed by platform startup. */
export class RunnerAcceptancePreparationBackend implements AcceptancePreparationBackend {
 readonly options:z.output<typeof optionsSchema>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly paths:RunnerDatasetPaths,readonly datasets:LocalSqliteAcceptanceDatasetBackend,readonly driver:AcceptanceServiceDriver,options:RunnerAcceptancePreparationOptions){
  this.options=optionsSchema.parse(options);
  if(this.options.runnerId!==store.options.runnerId||paths.options.runnerId!==this.options.runnerId||datasets.options.runnerId!==this.options.runnerId||datasets.options.backendRef!==this.options.backendRef||new RunnerDatasetPaths(datasets.options).root!==paths.root)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
 }
 get configured(){return this.options.enabled&&this.driver.configured&&this.datasets.configured;}
 #enabled(p:AcceptancePreparation){if(!this.configured)throw new RunnerError('ACCEPTANCE_RUNNER_NOT_CONFIGURED',503,'not-sent');validateAcceptanceDataset(p,this.datasets.options);}
 #unknown(errorCode='ACCEPTANCE_ORIGINAL_UNVERIFIED'):AcceptancePreparationObservation{return {state:'UNKNOWN',errorCode,checkedAt:new Date().toISOString()};}
 async preflight(p:AcceptancePreparation){this.#enabled(p);await this.datasets.preflight(p);await this.store.request('capacityConfigure',this.options.capacity);await this.driver.probe(p.request,this.options.repository);}
 async #request(p:AcceptancePreparation,receipt:AcceptanceServiceRequest['dataReceipt']){
  const fences=validateAcceptanceFences(await this.datasets.authority!.inspect(p),p);
  return acceptanceServiceRequest.parse({schemaVersion:'devmesh.acceptance-service-start.v1',purpose:'ACCEPTANCE',preparation:p.request,acceptanceRequestHash:p.requestHash,dataReceipt:receipt,fences});
 }
 async #authorized(p:AcceptancePreparation,r:AcceptanceServiceRequest,authorize:()=>Promise<boolean>){
  if(!await authorize())return false;
  const fences=validateAcceptanceFences(await this.datasets.authority!.inspect(p),p);
  return canonical(fences)===canonical(r.fences)&&await authorize();
 }
 #profile(r:AcceptanceServiceReservation){return acceptanceServiceProfile.parse({schemaVersion:'devmesh.acceptance-service-profile.v1',purpose:'ACCEPTANCE',accessMode:'READ_ONLY',reservationId:r.reservationId,requestHash:r.requestHash,repository:this.options.repository,datasetDirectory:this.paths.resolve({projectId:r.request.preparation.projectId,datasetId:r.request.preparation.target.datasetId}).directory,datasetBytes:this.options.datasetBytes,resourceLimits:r.resourceLimits,...acceptanceServiceNames(r.reservationId)});}
 #journal(r:AcceptanceServiceReservation,j:AcceptanceServiceJournal){
  const p=acceptanceServiceProfile.parse(j.profile),names=acceptanceServiceNames(r.reservationId);
  if(hash(p)!==j.profileHash||p.requestHash!==r.requestHash||p.reservationId!==r.reservationId||canonical(p.resourceLimits)!==canonical(r.resourceLimits)||p.datasetDirectory!==this.paths.resolve({projectId:r.request.preparation.projectId,datasetId:r.request.preparation.target.datasetId}).directory||p.networkName!==names.networkName||p.containerName!==names.containerName)throw new RunnerError('ACCEPTANCE_SERVICE_PROFILE_CHANGED',409);
 }
 async #observe(r:AcceptanceServiceReservation,j:AcceptanceServiceJournal,kind:'NETWORK_CREATE'|'CREATE'|'START',fact:string|ServiceContainerFact){
  const action=j.actions.find(a=>a.request.kind===kind);if(!action||action.state==='OBSERVED')return j;
  const state=typeof fact==='string'?'CREATED':fact.state==='created'?'CREATED':fact.state==='running'?'RUNNING':fact.state==='exited'?'EXITED':null;
  if(!state||kind==='CREATE'&&state!=='CREATED'||kind==='START'&&state==='CREATED')return j;
  return this.store.request('acceptanceServiceActionObserve',{...bound(r),kind,actionRequestHash:action.requestHash,observation:{objectId:typeof fact==='string'?fact:fact.containerId,state,checkedAt:new Date().toISOString()}});
 }
 async inspect(p:AcceptancePreparation):Promise<AcceptancePreparationObservation>{
  this.#enabled(p);const data=await this.datasets.inspect(p);if(data.state!=='MATERIALIZED')return this.#unknown(data.errorCode);
  const request=await this.#request(p,data.receipt);let r=await this.store.request('acceptanceServiceByOperation',{controllerId:this.options.controllerId,operationId:p.operationId});
  if(!r)return this.#unknown();if(r.requestHash!==hash(request)||canonical(r.request)!==canonical(request))throw new RunnerError('ACCEPTANCE_SERVICE_IDENTITY_CHANGED',409);
  if(r.releasedAt!==null||r.state==='RESERVED')return this.#unknown('ACCEPTANCE_SERVICE_NOT_RUNNING');
  let j=await this.store.request('acceptanceServiceJournal',bound(r));if(!j)return this.#unknown();this.#journal(r,j);
  if(!j.actions.some(a=>a.request.kind==='NETWORK_CREATE'))return this.#unknown();const networkId=await this.driver.network(j.profile,request);if(!networkId)return this.#unknown();if(j.networkId!==null&&j.networkId!==networkId)throw new RunnerError('ACCEPTANCE_SERVICE_IDENTITY_CHANGED',409);
  j=await this.#observe(r,j,'NETWORK_CREATE',networkId);if(!j.networkId||!j.actions.some(a=>a.request.kind==='CREATE'))return this.#unknown();
  const f=await this.driver.inspect(j.profile,request,j.networkId,j.containerId);if(!f)return this.#unknown();j=await this.#observe(r,j,'CREATE',f);if(j.containerId!==f.containerId)throw new RunnerError('ACCEPTANCE_SERVICE_IDENTITY_CHANGED',409);j=await this.#observe(r,j,'START',f);
  const healthy=f.state==='running'&&f.endpoint?await probePreviewHealth(f.endpoint):false;
  const fact={operationId:p.operationId,releaseId:p.releaseId,datasetId:p.request.target.datasetId,imageDigest:p.request.image.imageDigest,state:f.state==='running'?healthy?'HEALTHY' as const:'UNHEALTHY' as const:f.state==='created'?'CREATED' as const:f.state==='exited'?'EXITED' as const:'UNKNOWN' as const,instanceId:f.state==='unknown'?null:f.containerId,endpoint:f.state==='running'?f.endpoint:null,checkedAt:new Date().toISOString()};
  r=await this.store.request('acceptanceServiceRecord',{...bound(r),expectedRevision:r.revision,fact});if(fact.state!=='HEALTHY'||!fact.endpoint||!fact.instanceId)return this.#unknown('ACCEPTANCE_SERVICE_UNHEALTHY');
  // Query the original physical fences again after HTTP. No reacquisition.
  if(!await this.#authorized(p,request,async()=>true))return this.#unknown('ACCEPTANCE_DATA_CUSTODY_CHANGED');
  const q=p.request,claim={schemaVersion:'devmesh.acceptance-service-claim.v1' as const,purpose:'ACCEPTANCE' as const,operationId:q.operationId,acceptanceRequestHash:p.requestHash,releaseId:q.releaseId,projectId:q.projectId,runId:q.runId,candidateId:q.candidateId,manifestHash:q.manifestHash,reviewHash:q.reviewHash,dataPlanHash:q.dataPlanHash,datasetId:q.target.datasetId,imageDigest:q.image.imageDigest,reservationId:r.reservationId,profileHash:j.profileHash,serviceRequestHash:r.requestHash,instanceId:fact.instanceId};
  r=await this.store.request('acceptanceServiceHold',{...bound(r),claim,claimHash:hash(claim)});const proof=await this.store.request('acceptanceServicePrepareProof',bound(r));
  return acceptancePreparationObservation.parse({state:'READY',proof,fences:{sourceProofHash:request.fences.sourceFence?.physical.proofHash??null,targetProofHash:request.fences.targetFence.physical.proofHash,state:'HELD',writeState:'CLOSED'},health:{instanceId:fact.instanceId,datasetId:q.target.datasetId,imageDigest:q.image.imageDigest,endpoint:fact.endpoint,claimHash:r.claimHash,custodyState:'RELEASE_HELD',custodyRevision:r.revision,state:'HEALTHY'},checkedAt:fact.checkedAt});
 }
 async prepare(p:AcceptancePreparation,authorize:()=>Promise<boolean>):Promise<AcceptancePreparationObservation>{
  this.#enabled(p);if(p.state!=='SENT')throw new RunnerError('ACCEPTANCE_SERVICE_DISPATCH_GRANT_REQUIRED',409);
  const data=await this.datasets.prepare(p,authorize);if(data.state!=='MATERIALIZED')return this.#unknown(data.errorCode);const request=await this.#request(p,data.receipt);
  if(!await this.#authorized(p,request,authorize))return this.#unknown('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED');
  const r=await this.store.request('acceptanceServiceReserve',{controllerId:this.options.controllerId,request,requestHash:hash(request),resourceLimits:this.options.resourceLimits,capacity:this.options.capacity}),j=await this.store.request('acceptanceServiceProfilePrepare',{...bound(r),profile:this.#profile(r)});
  if(r.state!=='RESERVED')return this.inspect(p);
  if(!await this.#authorized(p,request,authorize)){await this.store.request('acceptanceServiceCancel',bound(r));return this.#unknown('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED');}
  try{await this.driver.prepare(j.profile);}catch(error){await this.store.request('acceptanceServiceCancel',bound(r));throw error;}
  if(!await this.#authorized(p,request,authorize)){await this.store.request('acceptanceServiceCancel',bound(r));return this.#unknown('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED');}
  if(!(await this.store.request('acceptanceServiceDispatch',bound(r))).dispatch)return this.inspect(p);
  for(const kind of ['NETWORK_CREATE','CREATE','START'] as const){
   if(!await this.#authorized(p,request,authorize))return this.#unknown('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED');
   const grant=await this.store.request('acceptanceServiceActionBegin',{...bound(r),kind}),action=grant.journal.actions.find(a=>a.request.kind===kind)!;if(!grant.dispatch)return this.inspect(p);
   const current=grant.journal,allowed=async()=>await this.#authorized(p,request,authorize)&&(await this.store.request('acceptanceServiceActionAuthorized',{...bound(r),kind,actionRequestHash:action.requestHash})).allowed;
   if(kind==='NETWORK_CREATE')await this.#observe(r,current,kind,await this.driver.createNetwork(current.profile,request,allowed));
   else if(kind==='CREATE'){const f=await this.driver.create(current.profile,request,current.networkId!,allowed);if(!f)return this.inspect(p);await this.#observe(r,current,kind,f);}
   else {const f=await this.driver.start(current.profile,request,current.networkId!,current.containerId!,allowed);if(!f)return this.inspect(p);await this.#observe(r,current,kind,f);}
  }
  return this.inspect(p);
 }
}
