import {createHash} from 'node:crypto';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical,releasePublicationObservation} from '@devmesh/storage-sqlite';
import type {ReleasePublication,ReleasePublicationBackend,ReleasePublicationObservation,SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerStore} from './store.js';
import type {RunnerReleaseRetirementBackend} from './release-retirement-backend.js';
import {releaseServiceRequest,releaseServiceProfile,releaseServiceNames,releaseServiceGateBinding} from './release-service.js';
import type {ReleaseServiceJournal,ReleaseServiceAction,ReleaseServiceKind,ReleaseServiceAuthority,ReleaseServiceDriver,ReleaseServiceRoutes} from './release-service.js';
import {runnerCapacity,previewResourceLimits} from './preview-reservation.js';
import {previewRepository} from './preview-container.js';
import {probePreviewHealth} from './preview-health.js';
import {RunnerError} from './protocol.js';

const optionsSchema=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,principalId:opaqueKey,repository:previewRepository,capacity:runnerCapacity,resourceLimits:previewResourceLimits});
export type RunnerReleaseServiceOptions=z.input<typeof optionsSchema>;
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex'),time=()=>new Date().toISOString();
/** Explicit trusted composition. Query recovery never begins another physical
 * stage. Provider implementations must enforce physical fencing on every write. */
export class RunnerReleaseServiceBackend implements ReleasePublicationBackend {
 readonly options:z.output<typeof optionsSchema>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly control:Pick<SqliteStorage,'request'>,readonly retirement:RunnerReleaseRetirementBackend,readonly authority:ReleaseServiceAuthority,readonly driver:ReleaseServiceDriver,readonly routes:ReleaseServiceRoutes,options:RunnerReleaseServiceOptions){
  this.options=optionsSchema.parse(options);const o=this.options,r=retirement.options;
  if(store.options.runnerId!==o.runnerId||retirement.store!==store||retirement.control!==control||r.runnerId!==o.runnerId||r.controllerId!==o.controllerId||r.backendRef!==o.backendRef||r.principalId!==o.principalId)throw new RunnerError('RELEASE_SERVICE_COMPOSITION_CHANGED',409);
 }
 get configured(){return this.options.enabled&&this.retirement.configured&&this.authority.configured&&this.driver.configured&&this.routes.configured;}
 #enabled(){if(!this.configured)throw new RunnerError('RELEASE_SERVICE_NOT_CONFIGURED',503,'not-sent');}
 #unknown(errorCode='RELEASE_SERVICE_ORIGINAL_UNVERIFIED'):ReleasePublicationObservation{return {state:'UNKNOWN',errorCode,checkedAt:time()};}
 #bound(p:ReleasePublication){
  if(!p.basis)throw new RunnerError('RELEASE_SERVICE_NOT_DISPATCHED',409);
  const old={schemaVersion:'devmesh.release-retirement.v1',promotion:p.request,promotionRequestHash:p.requestHash,gates:p.basis};
  const request=releaseServiceRequest.parse({...old,schemaVersion:'devmesh.release-service-start.v1',purpose:'RELEASE',retirementRequestHash:hash(old)});
  return {request,bound:{controllerId:this.options.controllerId,releaseId:p.releaseId,requestHash:hash(request)}};
 }
  async #current(p:ReleasePublication,authorize:boolean,continuation=false){
  const q=p.request.preparation,o=this.options;
  if(q.runnerId!==o.runnerId||q.backendRef!==o.backendRef||q.backendPrincipalId!==o.principalId||q.releaseId!==p.releaseId||hash(p.request)!==p.requestHash)throw new RunnerError('RELEASE_SERVICE_IDENTITY_CHANGED',409);
  const c=await this.control.request('getReleasePublication',{principalId:o.principalId,releaseId:p.releaseId});
  if(c.requestHash!==p.requestHash||canonical(c.request)!==canonical(p.request)||canonical(c.basis)!==canonical(p.basis))throw new RunnerError('RELEASE_SERVICE_IDENTITY_CHANGED',409);
   if(authorize&&!(await this.control.request(continuation?'verifyReleasePublicationContinuation':'verifyReleasePublication',{principalId:o.principalId,releaseId:p.releaseId,requestHash:p.requestHash})).allowed)throw new RunnerError('RELEASE_SERVICE_AUTHORITY_CLOSED',409);
 }
 async preflight(p:ReleasePublication){this.#enabled();await this.#current(p,false);await this.authority.preflight(p);await this.routes.preflight(p);await this.store.request('capacityConfigure',this.options.capacity);await this.driver.probe(p.request.preparation,this.options.repository);}
  async #allowed(p:ReleasePublication,j:ReleaseServiceJournal,authorize:()=>Promise<boolean>,continuation=false){
   try{await this.#current(p,true,continuation);if(!await authorize())return false;const a=j.actions.find(a=>a.request.kind==='ARM_FENCES'&&a.state==='OBSERVED');if(a?.observation?.kind==='ARM_FENCES'&&canonical(await this.authority.inspect(j.retirement))!==canonical(a.observation.proof))return false;if(j.actions.some(a=>a.request.kind==='PROFILE_PREPARE'&&a.state==='OBSERVED')&&!await this.driver.prepared(j.profile!,j.request))return false;const g=j.actions.find(a=>a.request.kind==='GUARD_ENFORCE'&&a.state==='OBSERVED');if(g?.observation?.kind==='GUARD_ENFORCE'&&canonical(await this.driver.inspectGuard(j.profile!,j.request,j.controllerId))!==canonical(g.observation.proof))return false;return await authorize();}catch{return false;}
 }
  async #step(p:ReleasePublication,j:ReleaseServiceJournal,kind:ReleaseServiceKind,authorize:()=>Promise<boolean>,continuation=false){
   if(!await this.#allowed(p,j,authorize,continuation))throw new RunnerError('RELEASE_SERVICE_AUTHORITY_CLOSED',409);
  const {bound}=this.#bound(p),g=await this.store.request('releaseServiceActionBegin',{...bound,kind});
   if(!g.dispatch&&!continuation)return false;
   const allowed=async()=>await this.#allowed(p,j,authorize,continuation)&&(await this.store.request('releaseServiceActionAuthorized',{...bound,kind,actionRequestHash:g.action.requestHash})).allowed;
   j=await this.#observe(p,j,g.action,g.dispatch,allowed);return j.actions.some(a=>a.request.kind===kind&&a.state==='OBSERVED');
 }
 async publish(p:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleasePublicationObservation>{
   return this.#advance(p,authorize,false);
  }
  async resume(p:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleasePublicationObservation>{
   return this.#advance(p,authorize,true);
  }
  async #advance(p:ReleasePublication,authorize:()=>Promise<boolean>,continuation:boolean):Promise<ReleasePublicationObservation>{
   if(p.state!=='SENT'&&!(continuation&&p.state==='UNKNOWN'))return this.inspect(p);
   await this.preflight(p);
  try{
    await this.#current(p,true,continuation);const retired=continuation?await this.retirement.resume(p,authorize):await this.retirement.retire(p,authorize);if(!retired.networkCleared)return this.#unknown('RELEASE_SERVICE_RETIREMENT_UNVERIFIED');
   const {request,bound}=this.#bound(p);if(!await authorize())return this.#unknown('RELEASE_SERVICE_AUTHORITY_CLOSED');
    const grant=await this.store.request('releaseServiceEnroll',{controllerId:bound.controllerId,request,requestHash:bound.requestHash,resourceLimits:this.options.resourceLimits});if(!grant.dispatch&&!continuation)return this.inspect(p);let j=grant.journal;
    for(const kind of ['ARM_FENCES',...j.source?['SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE'] as const:[]] as ReleaseServiceKind[]){if(!await this.#step(p,j,kind,authorize,continuation))return this.inspect(p);j=await this.store.request('releaseServiceGet',bound);}
    if(!await this.#allowed(p,j,authorize,continuation))return this.#unknown('RELEASE_SERVICE_AUTHORITY_CLOSED');
   j=await this.store.request('releaseServiceReserve',{...bound,capacity:this.options.capacity});const r=j.reservation!,f=j.actions.find(a=>a.request.kind==='ARM_FENCES')!.observation;if(f?.kind!=='ARM_FENCES')return this.#unknown();
   const profile=releaseServiceProfile.parse({schemaVersion:'devmesh.release-service-profile.v1',purpose:'RELEASE',accessMode:'READ_WRITE',writeAdmission:'CONTROL_GATE_FENCED',reservationId:r.reservationId,requestHash:bound.requestHash,repository:this.options.repository,datasetDirectory:j.retirement.original.profile.datasetDirectory,datasetBytes:j.retirement.original.profile.datasetBytes,resourceLimits:r.resourceLimits,...releaseServiceNames(r.reservationId),fenceProofHash:f.proof.target.proofHash,gateBindingHash:releaseServiceGateBinding(request)});
    j=await this.store.request('releaseServiceProfilePrepare',{...bound,profile});
    for(const kind of ['PROFILE_PREPARE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START'] as const){if(!await this.#step(p,j,kind,authorize,continuation))return this.inspect(p);j=await this.store.request('releaseServiceGet',bound);}
    j=await this.#refresh(p,j);if(!await this.#allowed(p,j,authorize,continuation)||j.reservation?.fact?.state!=='HEALTHY')return this.#unknown('RELEASE_SERVICE_UNHEALTHY');
    j=await this.store.request('releaseServiceOwn',bound);if(!await this.#step(p,j,'ROUTE_BIND',authorize,continuation))return this.inspect(p);
   await this.store.request('releaseServicePrepareProof',bound);return this.inspect(p);
  }catch(e){return this.#unknown(e instanceof RunnerError?e.code:'RELEASE_SERVICE_OUTCOME_UNKNOWN');}
 }
 /** Query original actions only. No new enrollment/reservation/profile, guard
  * enforcement, ownership claim, create/start, route bind or physical handoff. */
 async inspect(p:ReleasePublication):Promise<ReleasePublicationObservation>{
  this.#enabled();try{
   await this.#current(p,false);const {bound}=this.#bound(p);let j=await this.store.request('releaseServiceGet',bound);
   for(const a of j.actions){if(a.state==='OBSERVED')continue;j=await this.#observe(p,j,a,false,async()=>false);}
    if(!j.reservation||j.reservation.releasedAt!==null||!j.profile||!j.containerId||!j.networkId||!await this.driver.prepared(j.profile,j.request))return this.#unknown();
   j=await this.#refresh(p,j);if(j.reservation?.fact?.state!=='HEALTHY'||!j.reservation.claimHash||!j.actions.some(a=>a.request.kind==='ROUTE_BIND'&&a.state==='OBSERVED'))return this.#unknown('RELEASE_SERVICE_UNHEALTHY');
   j=await this.store.request('releaseServicePrepareProof',bound);const proof=j.proof!,arm=j.actions.find(a=>a.request.kind==='ARM_FENCES')!.observation,guard=j.actions.find(a=>a.request.kind==='GUARD_ENFORCE')!.observation;
   if(arm?.kind!=='ARM_FENCES'||guard?.kind!=='GUARD_ENFORCE'||canonical(await this.authority.inspect(j.retirement))!==canonical(arm.proof)||canonical(await this.driver.inspectGuard(j.profile!,j.request,j.controllerId))!==canonical(guard.proof)||canonical(await this.routes.inspect(j))!==canonical(proof.route))return this.#unknown('RELEASE_SERVICE_CURRENT_CHANGED');
   if(!await this.retirement.driver.containerAbsent(proof.readonlyRetirement.instanceId)||!await this.retirement.driver.networkAbsent(proof.readonlyRetirement.networkId))return this.#unknown('RELEASE_SERVICE_RETIREMENT_CHANGED');
   if(j.source&&(!await this.driver.containerAbsent(j.source.containerId)||!await this.driver.networkAbsent(j.source.networkId)))return this.#unknown('RELEASE_SERVICE_SOURCE_NOT_CLEARED');
   const c=proof.service.claim,r=proof.route;
   return releasePublicationObservation.parse({state:'PUBLISHED',proof,checkedAt:time(),current:{service:{instanceId:c.instanceId,datasetId:c.datasetId,imageDigest:c.imageDigest,profileHash:c.profileHash,claimHash:proof.service.claimHash,endpoint:proof.service.endpoint,accessMode:c.accessMode,custodyState:c.custodyState,writeAdmission:c.writeAdmission,state:'HEALTHY'},route:{routeId:r.routeId,routeHash:proof.routeHash,generation:r.generation,instanceId:r.instanceId,state:'BOUND'},fences:{targetProofHash:proof.target.proofHash,sourceProofHash:proof.source?.proofHash??null,revocationProofHash:proof.revocation.proofHash,targetState:'ARMED',targetWriteState:'CONTROL_CLOSED',sourceWriteState:'CLOSED'}}});
  }catch(e){return this.#unknown(e instanceof RunnerError?e.code:'RELEASE_SERVICE_OUTCOME_UNKNOWN');}
 }
 async #refresh(p:ReleasePublication,j:ReleaseServiceJournal){
  if(!j.profile||!j.networkId||!j.containerId)return j;const f=await this.driver.inspect(j.profile,j.request,j.networkId,j.containerId);if(!f||f.containerId!==j.containerId||f.networkId!==j.networkId)throw new RunnerError('RELEASE_SERVICE_OBJECT_CHANGED',409);
  const healthy=f.state==='running'&&f.endpoint?await probePreviewHealth(f.endpoint):false,q=p.request.preparation;
  return this.store.request('releaseServiceRecord',{...this.#bound(p).bound,expectedRevision:j.reservation!.revision,fact:{releaseId:p.releaseId,datasetId:q.target.datasetId,imageDigest:q.image.imageDigest,state:f.state==='running'?healthy?'HEALTHY':'UNHEALTHY':f.state==='created'?'CREATED':f.state==='exited'?'EXITED':'UNKNOWN',instanceId:f.state==='unknown'?null:f.containerId,endpoint:f.state==='running'?f.endpoint:null,checkedAt:time()}});
 }
 async #observe(p:ReleasePublication,j:ReleaseServiceJournal,a:ReleaseServiceAction,dispatch:boolean,authorize:()=>Promise<boolean>):Promise<ReleaseServiceJournal>{
  if(a.state==='OBSERVED')return j;const {bound}=this.#bound(p),kind=a.request.kind;
   if(kind==='PROFILE_PREPARE'){if(dispatch&&j.profilePreparation==='EXECUTE_ONCE')await this.driver.prepare(j.profile!,j.request,authorize);return await this.driver.prepared(j.profile!,j.request)?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,profileHash:j.profileHash!,checkedAt:time()}}):j;}
  if(kind==='ARM_FENCES'){const proof=dispatch?await this.authority.handoff(j.retirement,authorize):await this.authority.inspect(j.retirement);return proof?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,proof,checkedAt:time()}}):j;}
  if(kind==='GUARD_ENFORCE'){const proof=dispatch?await this.driver.enforceGuard(j.profile!,j.request,j.controllerId,authorize):await this.driver.inspectGuard(j.profile!,j.request,j.controllerId);return proof?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,proof,checkedAt:time()}}):j;}
  if(kind==='ROUTE_BIND'){const route=dispatch?await this.routes.bind(j,authorize):await this.routes.inspect(j);return route?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,route,routeHash:hash(route),checkedAt:time()}}):j;}
  if(kind==='SOURCE_STOP'||kind==='SOURCE_CONTAINER_REMOVE'||kind==='SOURCE_NETWORK_REMOVE'){
   const s=j.source!;
   if(kind==='SOURCE_STOP'){const f=dispatch?await this.driver.stop(s.profile,s.request,s.networkId,s.containerId,authorize):await this.driver.inspectRetired(s.profile,s.request,s.networkId,s.containerId);if(!f||f.containerId!==s.containerId||f.networkId!==s.networkId||!['created','exited'].includes(f.state))return j;return this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:f.containerId,state:f.state==='created'?'CREATED':'EXITED',checkedAt:time()}});}
   if(dispatch){if(kind==='SOURCE_CONTAINER_REMOVE')await this.driver.removeContainer(s.profile,s.request,s.networkId,s.containerId,authorize);else await this.driver.removeNetwork(s.profile,s.request,s.networkId,authorize);}
   const id=kind==='SOURCE_CONTAINER_REMOVE'?s.containerId:s.networkId,absent=kind==='SOURCE_CONTAINER_REMOVE'?await this.driver.containerAbsent(id):await this.driver.networkAbsent(id);return absent?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:id,absenceVerified:true,checkedAt:time()}}):j;
  }
  if(kind==='NETWORK_CREATE'){const id=dispatch?await this.driver.createNetwork(j.profile!,j.request,authorize):await this.driver.network(j.profile!,j.request);return id?this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:id,state:'CREATED',checkedAt:time()}}):j;}
  const f=dispatch?(kind==='CREATE'?await this.driver.create(j.profile!,j.request,j.networkId!,authorize):await this.driver.start(j.profile!,j.request,j.networkId!,j.containerId!,authorize)):await this.driver.inspect(j.profile!,j.request,j.networkId!,j.containerId);
  if(!f||f.networkId!==j.networkId||kind==='CREATE'&&f.state!=='created'||kind==='START'&&!['running','exited'].includes(f.state))return j;
  return this.store.request('releaseServiceActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:f.containerId,state:f.state==='created'?'CREATED':f.state==='running'?'RUNNING':'EXITED',checkedAt:time()}});
 }
}
