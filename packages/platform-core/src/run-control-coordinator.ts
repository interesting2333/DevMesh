import {randomUUID} from 'node:crypto';
import {opaqueKey} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,ControlStatusView,ControlTargetView} from '@devmesh/storage-sqlite';

export interface ControlStopTarget { runId:string; targetKind:string; targetId:string }
export type ControlStopObservation = { state:'RELEASED'|'UNKNOWN'|'STOPPING'; evidence?:Record<string,string|number|boolean|null> };
/** Explicit host backend. `stop` is the only action that may perform a new stop; `inspect` only queries. */
export interface ControlStopBackend {
  readonly configured:boolean;
  stop(target:ControlStopTarget):Promise<ControlStopObservation>;
  inspect?(target:ControlStopTarget):Promise<ControlStopObservation>;
}
export interface RunControlCoordinatorOptions { principalId:string; maximumRuns?:number; saveRetries?:number }

/**
 * Drives durable pause cleanup for PAUSING runs. Unknown targets are only inspected, never
 * stopped again. A run becomes PAUSED only after the storage command sees every target released.
 */
export class RunControlCoordinator {
  readonly #stop=new AbortController();
  readonly #maximumRuns:number;
  readonly #saveRetries:number;
  readonly #principalId:string;
  constructor(readonly storage:Pick<SqliteStorage,'request'>,readonly backend:ControlStopBackend,options:RunControlCoordinatorOptions){
    if(!backend||typeof backend.configured!=='boolean'||typeof backend.stop!=='function'||backend.inspect!==undefined&&typeof backend.inspect!=='function')throw new StorageError('CONTROL_COORDINATOR_INVALID',422,'Explicit control stop backend is required');
    this.#principalId=opaqueKey.parse(options.principalId);
    const maximumRuns=options.maximumRuns??10;
    if(!Number.isSafeInteger(maximumRuns)||maximumRuns<1||maximumRuns>50)throw new StorageError('CONTROL_COORDINATOR_INVALID',422,'maximumRuns is out of range');
    const saveRetries=options.saveRetries??2;
    if(!Number.isSafeInteger(saveRetries)||saveRetries<0||saveRetries>5)throw new StorageError('CONTROL_COORDINATOR_INVALID',422,'saveRetries is out of range');
    this.#maximumRuns=maximumRuns;
    this.#saveRetries=saveRetries;
  }
  close(){this.#stop.abort();}
  async tick():Promise<void>{
    if(this.#stop.signal.aborted||!this.backend.configured)return;
    const runs=await this.storage.request('listControlRuns',{limit:this.#maximumRuns});
    for(const run of runs){
      if(this.#stop.signal.aborted)return;
      if(run.controlGate!=='PAUSING'&&run.controlGate!=='CANCELLING')continue;
      await this.#cleanup(run);
      if(run.controlGate==='PAUSING'){
        const status=await this.storage.request('getControlStatus',{runId:run.runId});
        if(status.controlGate==='PAUSING'&&status.unresolved.length===0)try{
          await this.storage.request('finishControl',{meta:this.#meta(run.runId),runId:run.runId,controlRevision:status.controlRevision,outcome:'PAUSED'});
        }catch(error){
          // A lost ACK may have committed the pause already; a competing tick may
          // also have won. Re-reading the gate on the next pass is authoritative.
          if(!(error instanceof StorageError&&['CONTROL_NOT_PAUSING','CONTROL_REVISION_CONFLICT'].includes(error.code)))throw error;
        }
      }
    }
  }
  async #cleanup(run:ControlStatusView):Promise<void>{
    for(const target of run.unresolved){
      if(this.#stop.signal.aborted)return;
      if(target.state==='UNKNOWN'&&!this.backend.inspect)continue;
      if(target.state==='STOPPING'&&!this.backend.inspect)continue;
      const queryOnly=target.state==='UNKNOWN'||target.state==='STOPPING';
      const observation=queryOnly?await this.backend.inspect!(target):await this.backend.stop(target);
      await this.#record(run.runId,target,observation);
    }
  }
  async #record(runId:string,target:ControlTargetView,observation:ControlStopObservation):Promise<void>{
    if(!['RELEASED','UNKNOWN','STOPPING'].includes(observation.state))throw new StorageError('CONTROL_OBSERVATION_INVALID',500,'Invalid control observation');
    const meta=this.#meta(runId);
    for(let attempt=0;;attempt++){
      try{
        await this.storage.request('recordControlTarget',{meta,runId,targetKind:target.targetKind as 'ATTEMPT'|'PREPARATION'|'PREVIEW'|'JOB'|'WORKSPACE',targetId:target.targetId,state:observation.state,...(observation.evidence?{evidence:observation.evidence}:{})});
        return;
      }catch(error){
        // Retrying only the save keeps the stop action single-shot; the reused idempotency key
        // returns the original receipt if the failed call had actually committed.
        if(attempt>=this.#saveRetries)throw error;
      }
    }
  }
  #meta(runId:string){return{principalId:this.#principalId,scopeId:runId,idempotencyKey:randomUUID()};}
}
