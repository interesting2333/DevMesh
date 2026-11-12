import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {AgentRegistry,CredentialResolver} from '@devmesh/a2a-adapter';
import {scheduledWorkClient} from '@devmesh/a2a-adapter';
import type {Request,ScheduledCandidate,ScheduledDispatch,SqliteStorage} from '@devmesh/storage-sqlite';
import {StorageError} from '@devmesh/storage-sqlite';

type Admission=Request<'admitScheduledWork'>;
type ResourcePlan=Pick<Admission,'runnerId'|'reservationKey'|'runnerCapacity'|'runnerLimits'|'templateVersion'|'checkConfigHash'|'maximumAttempts'|'maximumReservedMs'>&
  Pick<Admission['work'],'roleSnapshot'|'resources'>;
export interface WorkflowSchedulerOptions {
  callerId:string;
  /** Trusted pre-admission code preparation; Worker admission rechecks its current basis. */
  prepareCodeBasis?(candidate:ScheduledCandidate,signal:AbortSignal):Promise<void>;
  /** Trusted, read-only allocator. Absence of a concrete grant plan keeps the work queued. */
  planResources(candidate:ScheduledCandidate,signal:AbortSignal):Promise<ResourcePlan|null>;
}

export class WorkflowScheduler {
  readonly #stop=new AbortController();
  #loop:Promise<void>|undefined;
  lastError:string|null=null;
  constructor(readonly storage:SqliteStorage,readonly registry:AgentRegistry,readonly credential:CredentialResolver,readonly options:WorkflowSchedulerOptions){}
  async send(dispatch:ScheduledDispatch,signal:AbortSignal){
    if(dispatch.callerId!==this.options.callerId)return;
    const key={attemptId:dispatch.attemptId,callerId:dispatch.callerId};
    const current=await this.storage.request('reconcileScheduledDispatch',key);
    if(current.state!=='PENDING')return current;
    const token=await this.credential(dispatch.endpoint.credentialRef);
    if(!token||signal.aborted)return current;
    const send=await scheduledWorkClient(dispatch.endpoint,token,signal);
    signal.throwIfAborted();
    const mark=await this.storage.request('markScheduledDispatchSent',key);
    if(!mark.send)return this.storage.request('reconcileScheduledDispatch',key);
    try{await send(dispatch.delegation);}catch{/* A missing response cannot prove non-admission. */}
    return this.storage.request('reconcileScheduledDispatch',key);
  }
  async tick(signal:AbortSignal){
    for(const item of await this.storage.request('listScheduledDispatches',{limit:8})){
      if(signal.aborted)return null;
      try{await this.send(item,signal);}catch(error){this.lastError=error instanceof StorageError?error.code:'SCHEDULED_TRANSPORT_UNAVAILABLE';}
    }
    if(signal.aborted)return null;
    for(const candidate of await this.storage.request('nextScheduledWork',{limit:24})){
      if(signal.aborted)return null;
      const defer=()=>this.storage.request('deferScheduledWork',{runId:candidate.runId,resourceRevision:candidate.resourceRevision});
      try{
        await this.options.prepareCodeBasis?.(candidate,signal);
        signal.throwIfAborted();
        const allocation=await this.options.planResources(candidate,signal);
        if(!allocation){await defer();continue;}
        const target=await this.registry.resolveRole(candidate.work.role),version=this.registry.version;
        const {roleSnapshot,resources,...policy}=allocation;
        const result=await this.storage.request('admitScheduledWork',{
          ...policy,meta:{scopeId:candidate.runId,principalId:candidate.principalId,idempotencyKey:randomUUID()},
          runId:candidate.runId,ifMatch:`"r${candidate.resourceRevision}"`,runEpoch:candidate.runEpoch,planRevision:candidate.planRevision,callerId:this.options.callerId,
          work:{workId:candidate.work.workId,workRevision:candidate.work.workRevision,workEpoch:candidate.workEpoch,roleSnapshot,resources,
            endpoint:{endpointId:target.config.endpointId,revision:target.config.revision,cardHash:target.config.cardHash,registryGenerationId:version.generationId}},
        });
        return result;
      }catch(error){
        this.lastError=error instanceof StorageError?error.code:'SCHEDULER_CANDIDATE_UNAVAILABLE';
        if(!signal.aborted&&(!(error instanceof StorageError)||error.status<500))await defer();
      }
    }
    return null;
  }
  start(){
    if(this.#loop||this.#stop.signal.aborted)throw new Error('Scheduler can only start once');
    this.#loop=(async()=>{const signal=this.#stop.signal;
      while(!signal.aborted){
        try{await this.tick(signal);}catch(error){this.lastError=error instanceof StorageError?error.code:'SCHEDULER_UNAVAILABLE';}
        try{await delay(250,undefined,{signal});}catch{break;}
      }
    })();
  }
  async stop(){this.#stop.abort();await this.#loop;}
}
