import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {acceptanceAbortDecision,canonical} from '@devmesh/storage-sqlite';
import type {AcceptanceAbortRecord,SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerStore} from './store.js';
import type {AcceptanceServiceAbort,AcceptanceAbortDriver,AcceptanceAbortKind} from './acceptance-abort.js';
import {RunnerError} from './protocol.js';
const optionsSchema=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,principalId:opaqueKey});
const inputSchema=z.strictObject({operationId:ids.operation,requestHash:sha256});
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
/** Explicit trusted composition. A model/caller cannot supply a cleanup decision. */
export class RunnerAcceptanceAbortBackend {
 readonly options:z.output<typeof optionsSchema>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly control:Pick<SqliteStorage,'request'>,readonly driver:AcceptanceAbortDriver,options:z.input<typeof optionsSchema>){this.options=optionsSchema.parse(options);if(store.options.runnerId!==this.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);}
 get configured(){return this.options.enabled&&this.driver.configured;}
 async #decision(i:z.output<typeof inputSchema>):Promise<AcceptanceAbortRecord>{
  const record=await this.control.request('getAcceptanceAbortDecision',{principalId:this.options.principalId,preparationOperationId:i.operationId,requestHash:i.requestHash});if(!record)throw new RunnerError('ACCEPTANCE_ABORT_NOT_REQUESTED',409);
  const d=acceptanceAbortDecision.parse(record.decision),q=d.preparation;if(hash(d)!==record.decisionHash||q.operationId!==i.operationId||d.preparationRequestHash!==i.requestHash||q.runnerId!==this.options.runnerId||q.backendRef!==this.options.backendRef||q.backendPrincipalId!==this.options.principalId)throw new RunnerError('ACCEPTANCE_ABORT_IDENTITY_CHANGED',409);return {decision:d,decisionHash:record.decisionHash};
 }
 async advance(raw:z.input<typeof inputSchema>):Promise<AcceptanceServiceAbort>{
  if(!this.configured)throw new RunnerError('ACCEPTANCE_ABORT_NOT_CONFIGURED',503,'not-sent');const i=inputSchema.parse(raw),record=await this.#decision(i),b={controllerId:this.options.controllerId,operationId:i.operationId,decisionHash:record.decisionHash};
  let current=await this.store.request('acceptanceAbortEnroll',{controllerId:b.controllerId,...record});if(current.networkCleared)return current;
  const r=current.reservation;if(!r)return current;const bound={controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash};let j=await this.store.request('acceptanceServiceJournal',bound);if(!j)return current;
  // Recover identities only for actions already granted before the abort. No
  // network/create/start is issued by this adapter, including after restart.
  try{
   if(!j.networkId){const original=j.actions.find(a=>a.request.kind==='NETWORK_CREATE');if(!original)return current;const networkId=await this.driver.network(j.profile,r.request);if(!networkId)return current;j=await this.store.request('acceptanceServiceActionObserve',{...bound,kind:'NETWORK_CREATE',actionRequestHash:original.requestHash,observation:{objectId:networkId,state:'CREATED',checkedAt:new Date().toISOString()}});}
   if(!j.containerId&&j.actions.some(a=>a.request.kind==='CREATE')){
    const f=await this.driver.inspect(j.profile,r.request,j.networkId!,null);if(!f||f.state!=='created')return current;const original=j.actions.find(a=>a.request.kind==='CREATE')!;j=await this.store.request('acceptanceServiceActionObserve',{...bound,kind:'CREATE',actionRequestHash:original.requestHash,observation:{objectId:f.containerId,state:'CREATED',checkedAt:new Date().toISOString()}});
   }
   const kinds:AcceptanceAbortKind[]=j.actions.some(a=>a.request.kind==='CREATE')?['STOP','CONTAINER_REMOVE','NETWORK_REMOVE']:['NETWORK_REMOVE'];
   for(const kind of kinds){
    if((await this.#decision(i)).decisionHash!==b.decisionHash)throw new RunnerError('ACCEPTANCE_ABORT_IDENTITY_CHANGED',409);
    const grant=await this.store.request('acceptanceAbortActionBegin',{...b,kind}),a=grant.action;if(a.state==='OBSERVED')continue;
    const allowed=async()=>(await this.#decision(i)).decisionHash===b.decisionHash&&(await this.store.request('acceptanceAbortActionAuthorized',{...b,kind,actionRequestHash:a.requestHash})).allowed;
    if(kind==='STOP'){
     const fact=grant.dispatch?await this.driver.stop(j.profile,r.request,a.request.networkId,a.request.containerId!,allowed):await this.driver.inspect(j.profile,r.request,a.request.networkId,a.request.containerId);
     if(!fact||!['created','exited'].includes(fact.state)||fact.containerId!==a.request.containerId)return this.store.request('acceptanceAbortGet',b);
     current=await this.store.request('acceptanceAbortActionObserve',{...b,kind,actionRequestHash:a.requestHash,observation:{kind:'STOP',objectId:fact.containerId,state:fact.state==='created'?'CREATED':'EXITED',checkedAt:new Date().toISOString()}});
    }else{
     if(grant.dispatch){if(kind==='CONTAINER_REMOVE')await this.driver.removeContainer(j.profile,r.request,a.request.networkId,a.request.containerId!,allowed);else await this.driver.removeNetwork(j.profile,r.request,a.request.networkId,allowed);}
     const absent=kind==='CONTAINER_REMOVE'?await this.driver.containerAbsent(a.request.containerId!):await this.driver.networkAbsent(a.request.networkId);if(!absent)return this.store.request('acceptanceAbortGet',b);
     current=await this.store.request('acceptanceAbortActionObserve',{...b,kind,actionRequestHash:a.requestHash,observation:{kind,objectId:kind==='CONTAINER_REMOVE'?a.request.containerId!:a.request.networkId,absenceVerified:true,checkedAt:new Date().toISOString()}});
    }
   }
  }catch(error){if(!(error instanceof RunnerError)&&!(error instanceof Error))throw error;return this.store.request('acceptanceAbortGet',b);}
  return current;
 }
}
