import {createHash} from 'node:crypto';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical,previewStartRequest,previewStopRequest,previewRuntimeFact} from '@devmesh/storage-sqlite';
import type {PreviewEffect,PreviewStartRequest,PreviewStopRequest,PreviewExecutionBackend,PreviewExecutionResult,PreviewRuntimeFact,DatasetPreparationBackend} from '@devmesh/storage-sqlite';
import {RunnerStore} from './store.js';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {RunnerError} from './protocol.js';
import {runnerCapacity,previewResourceLimits} from './preview-reservation.js';
import type {PreviewReservation} from './preview-reservation.js';
import {previewRepository,previewContainerProfile,previewContainerNames} from './preview-container.js';
import type {PreviewContainerDriver,PreviewContainerJournal,PreviewContainerAction,PreviewContainerFact} from './preview-container.js';
import {probePreviewHealth} from './preview-health.js';
const optionsSchema=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,repository:previewRepository,capacity:runnerCapacity,resourceLimits:previewResourceLimits,datasetBytes:z.number().int().min(4096).max(256*1024*1024).default(64*1024*1024)});
export type RunnerPreviewBackendOptions=z.input<typeof optionsSchema>;
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const bound=(r:PreviewReservation)=>({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});
/** Explicit trusted composition, no public registration or container-receipt API. */
export class RunnerPreviewBackend implements PreviewExecutionBackend {
 readonly configured:boolean;readonly options:z.output<typeof optionsSchema>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly paths:RunnerDatasetPaths,readonly datasets:DatasetPreparationBackend,readonly driver:PreviewContainerDriver,options:RunnerPreviewBackendOptions){this.options=optionsSchema.parse(options);if(this.options.runnerId!==store.options.runnerId||paths.options.runnerId!==store.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);this.configured=this.options.enabled&&driver.configured&&datasets.configured;}
 #enabled(){if(!this.configured)throw new RunnerError('PREVIEW_RUNNER_NOT_CONFIGURED',503,'not-sent');}
 #request(effect:PreviewEffect){const r=effect.kind==='PREVIEW_START'?previewStartRequest.parse(effect.request):effect.kind==='PREVIEW_STOP'?previewStopRequest.parse(effect.request):null;if(!r||r.operationId!==effect.operationId||r.projectId!==effect.projectId||r.runId!==effect.runId||r.candidateId!==effect.candidateId||r.previewId!==effect.previewId||r.datasetId!==effect.datasetId||r.policyHash!==effect.policyHash||effect.remoteKey!==r.previewId||hash(r)!==effect.requestHash||r.runnerId!==this.options.runnerId||r.backendRef!==this.options.backendRef)throw new RunnerError('PREVIEW_ORIGINAL_REQUEST_CHANGED',409);return r;}
 #profile(r:PreviewReservation){return previewContainerProfile.parse({schemaVersion:'devmesh.preview-container-profile.v1',reservationId:r.reservationId,requestHash:r.requestHash,repository:this.options.repository,datasetDirectory:this.paths.resolve(r.request).directory,datasetBytes:this.options.datasetBytes,resourceLimits:r.resourceLimits,...previewContainerNames(r.reservationId)});}
 async preflight(effect:PreviewEffect,datasetEffect:PreviewEffect){
  this.#enabled();const r=this.#request(effect);if(r.schemaVersion==='devmesh.preview-stop.v1'){const reservation=await this.#reservation(r);if(!reservation)throw new RunnerError('PREVIEW_ORIGINAL_RESERVATION_MISSING',409);return;}
  if(r.templateVersion!=='web-crud-v1'||r.schemaRevision!=='web-crud-v1.schema.1'||r.datasetOperationId!==datasetEffect.operationId||r.datasetId!==datasetEffect.datasetId||r.projectId!==datasetEffect.projectId||r.candidateId!==datasetEffect.candidateId||r.manifestHash!==datasetEffect.request.manifestHash||datasetEffect.state!=='SUCCEEDED'||datasetEffect.receipt?.kind!=='DATASET_READY'||r.storageKey!==datasetEffect.receipt.storageKey)throw new RunnerError('PREVIEW_DATASET_CHANGED',409);
  const actual=await this.datasets.inspect(datasetEffect);if(actual.state!=='SUCCEEDED'||canonical(actual.receipt)!==canonical(datasetEffect.receipt))throw new RunnerError('PREVIEW_DATASET_UNVERIFIED',409);
  this.paths.resolve(r);await this.store.request('capacityConfigure',this.options.capacity);await this.driver.probe(r,this.options.repository);
 }
 async #reservation(r:PreviewStartRequest|PreviewStopRequest){const reservation=await this.store.request('previewReservationByOperation',{controllerId:this.options.controllerId,operationId:r.schemaVersion==='devmesh.preview-start.v1'?r.operationId:r.startOperationId});if(reservation){const original=reservation.request;if(r.schemaVersion==='devmesh.preview-start.v1'){if(hash(r)!==reservation.requestHash)throw new RunnerError('PREVIEW_ORIGINAL_REQUEST_CHANGED',409);}else {if(r.startRequestHash!==reservation.requestHash||reservation.instanceId!==r.instanceId)throw new RunnerError('PREVIEW_ORIGINAL_REQUEST_CHANGED',409);for(const k of ['projectId','runId','candidateId','policyHash','backendRef','runnerId','previewId','datasetId','imageDigest'] as const)if(r[k]!==original[k])throw new RunnerError('PREVIEW_ORIGINAL_REQUEST_CHANGED',409);}}return reservation;}
 #result(effect:PreviewEffect,fact:PreviewRuntimeFact):PreviewExecutionResult{
  if(effect.kind==='PREVIEW_START'&&fact.state==='HEALTHY')return {fact,observation:{state:'SUCCEEDED',receipt:{kind:'PREVIEW_READY',previewId:fact.previewId,datasetId:fact.datasetId,imageDigest:fact.imageDigest,instanceId:fact.instanceId!,healthy:true,checkedAt:fact.checkedAt}}};
  if(effect.kind==='PREVIEW_STOP'&&fact.state==='EXITED')return {fact,observation:{state:'SUCCEEDED',receipt:{kind:'PREVIEW_STOPPED',previewId:fact.previewId,instanceId:fact.instanceId!,exitVerified:true,checkedAt:fact.checkedAt}}};
  if(effect.kind==='PREVIEW_START'&&fact.state==='EXITED')return {fact,observation:{state:'FAILED',errorCode:'PREVIEW_ORIGINAL_EXITED',absenceVerified:true}};
  return {fact,observation:{state:'UNKNOWN',errorCode:'PREVIEW_ORIGINAL_UNVERIFIED'}};
 }
 #unknown(effect:PreviewEffect){const r=this.#request(effect);return this.#result(effect,previewRuntimeFact.parse({previewId:r.previewId,datasetId:r.datasetId,imageDigest:r.imageDigest,state:'UNKNOWN',instanceId:null,endpoint:null,checkedAt:new Date().toISOString()}));}
 async #observe(r:PreviewReservation,j:PreviewContainerJournal,kind:PreviewContainerAction,f:PreviewContainerFact|string){const action=j.actions.find(a=>a.kind===kind);if(!action||action.state==='OBSERVED')return j;const state=typeof f==='string'?'CREATED':f.state==='exited'?'EXITED':f.state==='running'?'RUNNING':f.state==='created'?'CREATED':null;if(!state||kind==='START'&&state==='CREATED'||kind==='STOP'&&state!=='EXITED')return j;return this.store.request('previewContainerActionObserve',{...bound(r),kind,actionRequestHash:action.requestHash,observation:{objectId:typeof f==='string'?f:f.containerId,state,checkedAt:new Date().toISOString()}});}
 async inspect(effect:PreviewEffect):Promise<PreviewExecutionResult>{
  this.#enabled();const request=this.#request(effect),r=await this.#reservation(request);if(!r)return this.#unknown(effect);let j=await this.store.request('previewContainerGet',bound(r));if(!j)return this.#unknown(effect);
  if(r.state==='CANCELLED'&&j.actions.length===0&&effect.kind==='PREVIEW_START')return {...this.#unknown(effect),observation:{state:'FAILED',errorCode:'PREVIEW_CANCELLED_WITHOUT_DISPATCH',absenceVerified:true}};
  const networkId=await this.driver.network(j.profile,r.request);if(!networkId)return this.#unknown(effect);if(j.networkId!==null&&j.networkId!==networkId)throw new RunnerError('PREVIEW_CONTAINER_IDENTITY_CHANGED',409);
  j=await this.#observe(r,j,'NETWORK_CREATE',networkId);if(!j.networkId||!j.actions.some(a=>a.kind==='CREATE'))return this.#unknown(effect);
  const f=await this.driver.inspect(j.profile,r.request,j.networkId,j.containerId);if(!f)return this.#unknown(effect);j=await this.#observe(r,j,'CREATE',f);if(j.containerId!==f.containerId)throw new RunnerError('PREVIEW_CONTAINER_IDENTITY_CHANGED',409);
  j=await this.#observe(r,j,'START',f);await this.#observe(r,j,'STOP',f);
  const healthy=f.state==='running'&&f.endpoint?await probePreviewHealth(f.endpoint):false;
  const fact=previewRuntimeFact.parse({previewId:r.request.previewId,datasetId:r.request.datasetId,imageDigest:r.request.imageDigest,state:f.state==='running'?healthy?'HEALTHY':'UNHEALTHY':f.state==='created'?'CREATED':f.state==='exited'?'EXITED':'UNKNOWN',instanceId:f.state==='unknown'?null:f.containerId,endpoint:f.state==='running'?f.endpoint:null,checkedAt:new Date().toISOString()});
  if(!['EXITED','CANCELLED'].includes(r.state))await this.store.request('previewReservationRecord',{...bound(r),expectedRevision:r.revision,fact});return this.#result(effect,fact);
 }
 async execute(effect:PreviewEffect,datasetEffect:PreviewEffect,authorize:()=>Promise<boolean>):Promise<PreviewExecutionResult>{
  await this.preflight(effect,datasetEffect);if(effect.state!=='SENT')throw new RunnerError('PREVIEW_DISPATCH_GRANT_REQUIRED',409);const request=this.#request(effect);
  if(request.schemaVersion==='devmesh.preview-stop.v1'){
   const r=(await this.#reservation(request))!,j=await this.store.request('previewContainerGet',bound(r));if(!j?.networkId||!j.containerId||!await authorize())return this.inspect(effect);
   const before=await this.driver.inspect(j.profile,r.request,j.networkId,j.containerId);if(before?.state==='exited')return this.inspect(effect);
   if(!await authorize())return this.inspect(effect);const grant=await this.store.request('previewContainerActionBegin',{...bound(r),action:{kind:'STOP',requestHash:effect.requestHash,request}});if(!grant.dispatch||!await authorize())return this.inspect(effect);
   await this.driver.stop(j.profile,r.request,j.networkId,j.containerId,authorize);return this.inspect(effect);
  }
  if(!await authorize())return this.#unknown(effect);
  const r=await this.store.request('previewReserve',{controllerId:this.options.controllerId,request,requestHash:effect.requestHash,resourceLimits:this.options.resourceLimits,capacity:this.options.capacity});
  const j=await this.store.request('previewContainerPrepare',{...bound(r),profile:this.#profile(r)});
  if(r.state!=='RESERVED')return this.inspect(effect);
  try{await this.driver.prepare(j.profile);}catch(error){await this.store.request('previewReservationCancel',bound(r));throw error;}if(!await authorize()){await this.store.request('previewReservationCancel',bound(r));return this.inspect(effect);}
  const permitted=await this.store.request('previewReservationDispatch',bound(r));if(!permitted.dispatch)return this.inspect(effect);
  for(const kind of ['NETWORK_CREATE','CREATE','START'] as const){
   if(!await authorize())return this.inspect(effect);
   const grant=await this.store.request('previewContainerActionBegin',{...bound(r),action:{kind,requestHash:effect.requestHash,request}});if(!grant.dispatch||!await authorize())return this.inspect(effect);
   const current=grant.journal;
   if(kind==='NETWORK_CREATE')await this.#observe(r,current,kind,await this.driver.createNetwork(current.profile,request,authorize));
   else if(kind==='CREATE'){const f=await this.driver.create(current.profile,request,current.networkId!,authorize);if(!f)return this.inspect(effect);await this.#observe(r,current,kind,f);}
   else{const f=await this.driver.start(current.profile,request,current.networkId!,current.containerId!,authorize);if(!f)return this.inspect(effect);await this.#observe(r,current,kind,f);}
  }
  return this.inspect(effect);
 }
}
