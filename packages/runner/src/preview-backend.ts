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
   if(effect.kind==='PREVIEW_STOP'&&fact.state==='REMOVED')return {fact,observation:{state:'SUCCEEDED',receipt:{kind:'PREVIEW_REMOVED',previewId:fact.previewId,instanceId:fact.instanceId!,removalVerified:true,checkedAt:fact.checkedAt}}};
   if(effect.kind==='PREVIEW_START'&&fact.state==='REMOVED')return {fact,observation:{state:'FAILED',errorCode:'PREVIEW_ORIGINAL_REMOVED',absenceVerified:true}};
  if(effect.kind==='PREVIEW_START'&&fact.state==='EXITED')return {fact,observation:{state:'FAILED',errorCode:'PREVIEW_ORIGINAL_EXITED',absenceVerified:true}};
  return {fact,observation:{state:'UNKNOWN',errorCode:'PREVIEW_ORIGINAL_UNVERIFIED'}};
 }
 #unknown(effect:PreviewEffect){const r=this.#request(effect);return this.#result(effect,previewRuntimeFact.parse({previewId:r.previewId,datasetId:r.datasetId,imageDigest:r.imageDigest,state:'UNKNOWN',instanceId:null,endpoint:null,checkedAt:new Date().toISOString()}));}
 async #observe(r:PreviewReservation,j:PreviewContainerJournal,kind:PreviewContainerAction,f:PreviewContainerFact|string){const action=j.actions.find(a=>a.kind===kind);if(!action||action.state==='OBSERVED')return j;const state=typeof f==='string'?'CREATED':f.state==='exited'?'EXITED':f.state==='running'?'RUNNING':f.state==='created'?'CREATED':null;if(!state||kind==='START'&&state==='CREATED'||kind==='STOP'&&state!=='EXITED')return j;return this.store.request('previewContainerActionObserve',{...bound(r),kind,actionRequestHash:action.requestHash,observation:{objectId:typeof f==='string'?f:f.containerId,state,checkedAt:new Date().toISOString()}});}
 async inspect(effect:PreviewEffect):Promise<PreviewExecutionResult>{
   this.#enabled();const request=this.#request(effect),r=await this.#reservation(request);if(!r)return this.#unknown(effect);
    let removal=(await this.store.request('previewCleanupGet',bound(r))).find(a=>a.request.kind==='CONTAINER_REMOVE');
    if(removal?.state==='SENT'&&await this.driver.containerAbsent(removal.request.containerId))removal=await this.store.request('previewCleanupActionObserve',{...bound(r),kind:'CONTAINER_REMOVE',actionRequestHash:removal.requestHash,observation:{objectId:removal.request.containerId,absenceVerified:true,checkedAt:new Date().toISOString()}});
    if(removal?.state==='OBSERVED')return this.#result(effect,previewRuntimeFact.parse({previewId:r.request.previewId,datasetId:r.request.datasetId,imageDigest:r.request.imageDigest,state:'REMOVED',instanceId:removal.request.containerId,endpoint:null,checkedAt:new Date().toISOString()}));
   if(r.state==='CANCELLED'&&effect.kind==='PREVIEW_START')return {...this.#unknown(effect),observation:{state:'FAILED',errorCode:'PREVIEW_CANCELLED_WITHOUT_DISPATCH',absenceVerified:true}};
   let j=await this.store.request('previewContainerGet',bound(r));if(!j)return this.#unknown(effect);
  const networkId=await this.driver.network(j.profile,r.request);if(!networkId)return this.#unknown(effect);if(j.networkId!==null&&j.networkId!==networkId)throw new RunnerError('PREVIEW_CONTAINER_IDENTITY_CHANGED',409);
  j=await this.#observe(r,j,'NETWORK_CREATE',networkId);if(!j.networkId||!j.actions.some(a=>a.kind==='CREATE'))return this.#unknown(effect);
  const f=await this.driver.inspect(j.profile,r.request,j.networkId,j.containerId);if(!f)return this.#unknown(effect);j=await this.#observe(r,j,'CREATE',f);if(j.containerId!==f.containerId)throw new RunnerError('PREVIEW_CONTAINER_IDENTITY_CHANGED',409);
  j=await this.#observe(r,j,'START',f);await this.#observe(r,j,'STOP',f);
  const healthy=f.state==='running'&&f.endpoint?await probePreviewHealth(f.endpoint):false;
  const fact=previewRuntimeFact.parse({previewId:r.request.previewId,datasetId:r.request.datasetId,imageDigest:r.request.imageDigest,state:f.state==='running'?healthy?'HEALTHY':'UNHEALTHY':f.state==='created'?'CREATED':f.state==='exited'?'EXITED':'UNKNOWN',instanceId:f.state==='unknown'?null:f.containerId,endpoint:f.state==='running'?f.endpoint:null,checkedAt:new Date().toISOString()});
   if(!['EXITED','CANCELLED','REMOVED'].includes(r.state))await this.store.request('previewReservationRecord',{...bound(r),expectedRevision:r.revision,fact});return this.#result(effect,fact);
 }
 async execute(effect:PreviewEffect,datasetEffect:PreviewEffect,authorize:()=>Promise<boolean>):Promise<PreviewExecutionResult>{
  await this.preflight(effect,datasetEffect);if(effect.state!=='SENT')throw new RunnerError('PREVIEW_DISPATCH_GRANT_REQUIRED',409);const request=this.#request(effect);
  if(request.schemaVersion==='devmesh.preview-stop.v1'){
   const r=(await this.#reservation(request))!,j=await this.store.request('previewContainerGet',bound(r));if(!j?.networkId||!j.containerId||!await authorize())return this.inspect(effect);
    if((await this.store.request('previewCleanupGet',bound(r))).some(a=>a.request.kind==='CONTAINER_REMOVE'))return this.inspect(effect);
   const before=await this.driver.inspect(j.profile,r.request,j.networkId,j.containerId);if(before?.state==='exited')return this.inspect(effect);
   if(!await authorize())return this.inspect(effect);const grant=await this.store.request('previewContainerActionBegin',{...bound(r),action:{kind:'STOP',requestHash:effect.requestHash,request}});if(!grant.dispatch||!await authorize())return this.inspect(effect);
    await this.driver.stop(j.profile,r.request,j.networkId,j.containerId,async()=>await authorize()&&(await this.store.request('previewLifecycleActionAuthorized',{...bound(r),kind:'STOP',actionRequestHash:effect.requestHash})).allowed);return this.inspect(effect);
  }
  if(!await authorize())return this.#unknown(effect);
  const r=await this.store.request('previewReserve',{controllerId:this.options.controllerId,request,requestHash:effect.requestHash,resourceLimits:this.options.resourceLimits,capacity:this.options.capacity});
   await this.store.request('previewLifecycleEnroll',bound(r));
  const j=await this.store.request('previewContainerPrepare',{...bound(r),profile:this.#profile(r)});
  if(r.state!=='RESERVED')return this.inspect(effect);
  try{await this.driver.prepare(j.profile);}catch(error){await this.store.request('previewReservationCancel',bound(r));throw error;}if(!await authorize()){await this.store.request('previewReservationCancel',bound(r));return this.inspect(effect);}
  const permitted=await this.store.request('previewReservationDispatch',bound(r));if(!permitted.dispatch)return this.inspect(effect);
  for(const kind of ['NETWORK_CREATE','CREATE','START'] as const){
   if(!await authorize())return this.inspect(effect);
   const grant=await this.store.request('previewContainerActionBegin',{...bound(r),action:{kind,requestHash:effect.requestHash,request}});if(!grant.dispatch||!await authorize())return this.inspect(effect);
   const current=grant.journal;
    const currentAuthority=async()=>await authorize()&&(await this.store.request('previewLifecycleActionAuthorized',{...bound(r),kind,actionRequestHash:effect.requestHash})).allowed;
    if(kind==='NETWORK_CREATE')await this.#observe(r,current,kind,await this.driver.createNetwork(current.profile,request,currentAuthority));
    else if(kind==='CREATE'){const f=await this.driver.create(current.profile,request,current.networkId!,currentAuthority);if(!f)return this.inspect(effect);await this.#observe(r,current,kind,f);}
    else{const f=await this.driver.start(current.profile,request,current.networkId!,current.containerId!,currentAuthority);if(!f)return this.inspect(effect);await this.#observe(r,current,kind,f);}
  }
  return this.inspect(effect);
 }
  /** Original-ID removal. Existing SENT actions only query, including after restart. */
  async cleanupReservation(reservationId:string,isOpen:()=>boolean=()=>true){
   this.#enabled();const r=await this.store.request('previewReservationGet',{controllerId:this.options.controllerId,reservationId:opaqueKey.parse(reservationId)}),life=await this.store.request('previewLifecycleGet',bound(r));if(!life||life.state!=='STOPPING'||!isOpen())return {state:life?.state??'UNENROLLED'};
   const j=await this.store.request('previewContainerGet',bound(r));if(!j?.containerId||!j.networkId||!j.actions.some(a=>a.kind==='STOP'))return {state:'UNKNOWN'};
   for(const kind of ['CONTAINER_REMOVE','NETWORK_REMOVE'] as const){
    if(!isOpen())return {state:'UNKNOWN'};let action=(await this.store.request('previewCleanupGet',bound(r))).find(a=>a.request.kind===kind);if(action?.state==='OBSERVED')continue;
    const id=kind==='CONTAINER_REMOVE'?j.containerId:j.networkId,absent=()=>kind==='CONTAINER_REMOVE'?this.driver.containerAbsent(id):this.driver.networkAbsent(id);let gone=await absent();
    if(!action){
     if(kind==='CONTAINER_REMOVE'&&!gone){const original=await this.driver.inspect(j.profile,r.request,j.networkId,j.containerId);if(!original||!['created','exited'].includes(original.state))return {state:'UNKNOWN'};}
     if(!isOpen())return {state:'UNKNOWN'};const grant=await this.store.request('previewCleanupActionBegin',{...bound(r),kind});action=grant.action;
     if(grant.dispatch&&!gone){const actionRequestHash=action.requestHash,authorize=async()=>isOpen()&&(await this.store.request('previewCleanupActionAuthorized',{...bound(r),kind,actionRequestHash})).allowed;if(kind==='CONTAINER_REMOVE')await this.driver.removeContainer(j.profile,r.request,j.networkId,j.containerId,authorize);else await this.driver.removeNetwork(j.profile,r.request,j.networkId,authorize);gone=await absent();}
    }
    if(!gone)return {state:'UNKNOWN'};if(action.state!=='OBSERVED')await this.store.request('previewCleanupActionObserve',{...bound(r),kind,actionRequestHash:action.requestHash,observation:{objectId:id,absenceVerified:true,checkedAt:new Date().toISOString()}});
   }
   return {state:(await this.store.request('previewReservationGet',{controllerId:this.options.controllerId,reservationId})).state};
  }
  /** Runner-only expiry path; never depends on a control database connection. */
  async expireReservation(reservationId:string,isOpen:()=>boolean=()=>true){
   this.#enabled();let r=await this.store.request('previewReservationGet',{controllerId:this.options.controllerId,reservationId:opaqueKey.parse(reservationId)});
   let life=await this.store.request('previewLifecycleGet',bound(r));if(!life)return {state:'UNENROLLED' as const,result:null};
   if(life.state.startsWith('RELEASE_'))return {state:life.state,result:null};
   life=await this.store.request('previewExpiryPrepare',bound(r));
   if(!life||life.state!=='STOPPING'||!isOpen())return {state:life?.state??'UNENROLLED',result:null};
   if(r.state==='RESERVED'){await this.store.request('previewReservationCancel',bound(r));return {state:'CANCELLED' as const,result:null};}
   const request=r.request,start:PreviewEffect={operationId:request.operationId,projectId:request.projectId,runId:request.runId,candidateId:request.candidateId,datasetId:request.datasetId,previewId:request.previewId,policyHash:request.policyHash,kind:'PREVIEW_START',remoteKey:request.previewId,requestHash:r.requestHash,request,state:'SENT',revision:0,receipt:null,errorCode:null,createdAt:r.createdAt};
   const observed=await this.inspect(start);r=await this.store.request('previewReservationGet',{controllerId:this.options.controllerId,reservationId});if(r.releasedAt)return {state:r.state,result:observed};
   life=await this.store.request('previewExpiryPrepare',bound(r));const journal=await this.store.request('previewContainerGet',bound(r));if(!life?.expiryRequest||!life.expiryRequestHash||journal?.actions.some(a=>a.kind==='STOP')||!isOpen())return {state:life?.state??'UNENROLLED',result:observed};
   const effect:PreviewEffect={...start,operationId:life.expiryRequest.operationId,kind:'PREVIEW_STOP',requestHash:life.expiryRequestHash,request:life.expiryRequest};
   const expiryRequestHash=life.expiryRequestHash,result=await this.execute(effect,start,async()=>isOpen()&&(await this.store.request('previewExpiryAuthorized',{...bound(r),expiryRequestHash})).allowed);
   return {state:(await this.store.request('previewReservationGet',{controllerId:this.options.controllerId,reservationId})).state,result};
  }
}
