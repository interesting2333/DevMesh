import {createHash} from 'node:crypto';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical} from '@devmesh/storage-sqlite';
import type {ReleasePublication,SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerStore} from './store.js';
import type {AcceptanceAbortDriver} from './acceptance-abort.js';
import {releaseRetirementRequest,releaseRetirementRevocation} from './release-retirement.js';
import type {ReleaseRetirement,ReleaseRetirementAction,ReleaseRetirementAuthority,ReleaseRetirementKind} from './release-retirement.js';
import {RunnerError} from './protocol.js';

const optionsSchema=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,principalId:opaqueKey});
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
/** Only the unique publication winner calls retire. This adapter implements the
 * readonly retirement stage, not writable service creation or publication success. */
export class RunnerReleaseRetirementBackend {
 readonly options:z.output<typeof optionsSchema>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly control:Pick<SqliteStorage,'request'>,readonly driver:AcceptanceAbortDriver,readonly authority:ReleaseRetirementAuthority,options:z.input<typeof optionsSchema>){
  this.options=optionsSchema.parse(options);
  if(store.options.runnerId!==this.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);
 }
 get configured(){return this.options.enabled&&this.driver.configured&&this.authority.configured;}
 #bound(p:ReleasePublication){
  if(!p.basis)throw new RunnerError('RELEASE_RETIREMENT_NOT_DISPATCHED',409);
  const request=releaseRetirementRequest.parse({schemaVersion:'devmesh.release-retirement.v1',promotion:p.request,promotionRequestHash:p.requestHash,gates:p.basis});
  return {request,bound:{controllerId:this.options.controllerId,releaseId:p.releaseId,requestHash:hash(request)}};
 }
  async #current(p:ReleasePublication,authorize:boolean,continuation=false){
  const q=p.request.preparation,o=this.options;
  if(q.runnerId!==o.runnerId||q.backendRef!==o.backendRef||q.backendPrincipalId!==o.principalId||q.releaseId!==p.releaseId||hash(p.request)!==p.requestHash)throw new RunnerError('RELEASE_RETIREMENT_IDENTITY_CHANGED',409);
  const current=await this.control.request('getReleasePublication',{principalId:o.principalId,releaseId:p.releaseId});
  if(current.requestHash!==p.requestHash||canonical(current.request)!==canonical(p.request)||canonical(current.basis)!==canonical(p.basis)||current.dispatchedAt===null||current.state==='PENDING')throw new RunnerError('RELEASE_RETIREMENT_IDENTITY_CHANGED',409);
   if(authorize&&!(await this.control.request(continuation?'verifyReleasePublicationContinuation':'verifyReleasePublication',{principalId:o.principalId,releaseId:p.releaseId,requestHash:p.requestHash})).allowed)throw new RunnerError('RELEASE_RETIREMENT_AUTHORITY_CLOSED',409);
 }
  async preflight(p:ReleasePublication,continuation=false){
  if(!this.configured)throw new RunnerError('RELEASE_RETIREMENT_NOT_CONFIGURED',503,'not-sent');
   const {request}=this.#bound(p);await this.#current(p,true,continuation);await this.authority.preflight(request);
 }
 async retire(p:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleaseRetirement>{
   return this.#advance(p,authorize,false);
  }
  /** Explicit coordination; only unstarted stages receive new unique grants. */
  async resume(p:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleaseRetirement>{
   return this.#advance(p,authorize,true);
  }
  async #advance(p:ReleasePublication,authorize:()=>Promise<boolean>,continuation:boolean):Promise<ReleaseRetirement>{
   if(p.state!=='SENT'&&!(continuation&&p.state==='UNKNOWN'))return this.inspect(p);
   await this.preflight(p,continuation);
  if(!await authorize())throw new RunnerError('RELEASE_RETIREMENT_AUTHORITY_CLOSED',409,'not-sent');
  const {request,bound}=this.#bound(p),grant=await this.store.request('releaseRetirementEnroll',{controllerId:bound.controllerId,request,requestHash:bound.requestHash});
   if(!grant.dispatch&&!continuation)return this.inspect(p);
  let current=grant.journal;
  for(const kind of ['REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE'] as ReleaseRetirementKind[]){
   try{
    await this.#current(p,true,continuation);if(!await authorize())break;
    const g=await this.store.request('releaseRetirementActionBegin',{...bound,kind}),a=g.action;
    const allowed=async()=>{try{await this.#current(p,true,continuation);return await authorize()&&(await this.store.request('releaseRetirementActionAuthorized',{...bound,kind,actionRequestHash:a.requestHash})).allowed;}catch{return false;}};
    current=await this.#observe(p,current,a,g.dispatch,allowed);
    if(!current.actions.some(x=>x.request.kind===kind&&x.state==='OBSERVED'))break;
   }catch{break;}
  }
  return this.store.request('releaseRetirementGet',bound);
 }
 /** Never enroll, begin a stage, revoke, stop, remove or start from recovery. */
 async inspect(p:ReleasePublication):Promise<ReleaseRetirement>{
  if(!this.configured)throw new RunnerError('RELEASE_RETIREMENT_NOT_CONFIGURED',503,'not-sent');
  await this.#current(p,false);const {bound}=this.#bound(p);let current=await this.store.request('releaseRetirementGet',bound);
  for(const a of current.actions){if(a.state==='OBSERVED')continue;try{current=await this.#observe(p,current,a,false,async()=>false);}catch{break;}}
  return current;
 }
 async #observe(p:ReleasePublication,j:ReleaseRetirement,a:ReleaseRetirementAction,dispatch:boolean,allowed:()=>Promise<boolean>):Promise<ReleaseRetirement>{
  const {bound}=this.#bound(p),kind=a.request.kind,r=j.reservation,original=j.original;
  if(a.state==='OBSERVED')return j;
  const checkedAt=()=>new Date().toISOString();
  // Explicitly typed branches preserve the discriminated observation at the RPC.
  if(kind==='REVOKE_PREPARATION'){
   const value=dispatch?await this.authority.revoke(j.request,bound.controllerId,allowed):await this.authority.inspect(j.request,bound.controllerId);
   if(!value)return j;const proof=releaseRetirementRevocation.parse(value);
   return this.store.request('releaseRetirementActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,proof,checkedAt:checkedAt()}});
  }
  if(kind==='STOP'){
   const fact=dispatch?await this.driver.stop(original.profile,r.request,a.request.networkId,a.request.containerId,allowed):await this.driver.inspect(original.profile,r.request,a.request.networkId,a.request.containerId);
   if(!fact||fact.containerId!==a.request.containerId||fact.networkId!==a.request.networkId||!['created','exited'].includes(fact.state))return j;
   return this.store.request('releaseRetirementActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:fact.containerId,state:fact.state==='created'?'CREATED':'EXITED',checkedAt:checkedAt()}});
  }
  if(dispatch){if(kind==='CONTAINER_REMOVE')await this.driver.removeContainer(original.profile,r.request,a.request.networkId,a.request.containerId,allowed);else await this.driver.removeNetwork(original.profile,r.request,a.request.networkId,allowed);}
  const absent=kind==='CONTAINER_REMOVE'?await this.driver.containerAbsent(a.request.containerId):await this.driver.networkAbsent(a.request.networkId);
  if(!absent)return j;
  return this.store.request('releaseRetirementActionObserve',{...bound,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:kind==='CONTAINER_REMOVE'?a.request.containerId:a.request.networkId,absenceVerified:true,checkedAt:checkedAt()}});
 }
}
