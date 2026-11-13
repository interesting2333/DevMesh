import {Worker} from 'node:worker_threads';
import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {acceptanceAbortDecision,canonical} from '@devmesh/storage-sqlite';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {RunnerStore} from './store.js';
import {acceptanceDataOptions} from './acceptance-dataset-backend.js';
import {acceptanceDatasetAbortRequest,validateDatasetAbortJournal,validateDatasetAbortProof} from './acceptance-dataset-abort.js';
import type {AcceptanceDatasetAbortAuthority,AcceptanceDatasetAbortObservation} from './acceptance-dataset-abort.js';
import {datasetHash} from './dataset-journal.js';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {RunnerError} from './protocol.js';

export const acceptanceDatasetAbortOptions=acceptanceDataOptions.extend({enabled:z.boolean().default(false),controllerId:opaqueKey,principalId:opaqueKey});
const input=z.strictObject({operationId:ids.operation,requestHash:sha256});
/** Explicit trusted composition; the caller supplies neither a decision nor a
 * cleanup-success flag. Each Worker owns one bounded durable file operation. */
export class RunnerAcceptanceDatasetAbortBackend {
 readonly options:z.output<typeof acceptanceDatasetAbortOptions>;#active=0;#authorityActive=0;#waiting:(()=>void)[]=[];
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly control:Pick<SqliteStorage,'request'>,readonly authority:AcceptanceDatasetAbortAuthority|undefined,options:z.input<typeof acceptanceDatasetAbortOptions>){this.options=acceptanceDatasetAbortOptions.parse(options);new RunnerDatasetPaths(this.options);if(store.options.runnerId!==this.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);}
 get configured(){return this.options.enabled&&this.authority?.configured===true;}
 async #authorityCall<T>(call:()=>Promise<T>):Promise<T>{if(this.#authorityActive>=this.options.maximumWorkers)throw new RunnerError('ACCEPTANCE_DATA_ABORT_AUTHORITY_BUSY',503,'not-sent');this.#authorityActive++;try{return await call();}finally{this.#authorityActive--;}}
 async #request(i:z.output<typeof input>){
  const record=await this.control.request('getAcceptanceAbortDecision',{principalId:this.options.principalId,preparationOperationId:i.operationId,requestHash:i.requestHash});if(!record)throw new RunnerError('ACCEPTANCE_ABORT_NOT_REQUESTED',409);
  const d=acceptanceAbortDecision.parse(record.decision),q=d.preparation;if(datasetHash(canonical(d))!==record.decisionHash||q.operationId!==i.operationId||d.preparationRequestHash!==i.requestHash||q.runnerId!==this.options.runnerId||q.backendRef!==this.options.backendRef||q.backendPrincipalId!==this.options.principalId)throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);
  const cleanup=await this.store.request('acceptanceAbortGet',{controllerId:this.options.controllerId,operationId:i.operationId,decisionHash:record.decisionHash});if(canonical(cleanup.record)!==canonical(record))throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);if(!cleanup.serviceCleared||!cleanup.networkCleared)return null;
  return acceptanceDatasetAbortRequest.parse({schemaVersion:'devmesh.acceptance-dataset-abort.v1',...record,controllerId:this.options.controllerId,serviceCleanupHash:datasetHash(canonical(cleanup))});
 }
 async advance(raw:z.input<typeof input>,signal?:AbortSignal):Promise<AcceptanceDatasetAbortObservation>{
  signal?.throwIfAborted();
  if(!this.configured)throw new RunnerError('ACCEPTANCE_DATA_ABORT_NOT_CONFIGURED',503,'not-sent');const i=input.parse(raw),request=await this.#request(i);if(!request)return {state:'UNKNOWN',errorCode:'ACCEPTANCE_DATA_ABORT_SERVICE_UNRESOLVED'};
  signal?.throwIfAborted();
  if(this.#active>=this.options.maximumWorkers){if(this.#waiting.length>=128)throw new RunnerError('ACCEPTANCE_DATA_WORKER_BUSY',503,'not-sent');await new Promise<void>(resolve=>this.#waiting.push(resolve));}else this.#active++;
  try{signal?.throwIfAborted();return await new Promise<AcceptanceDatasetAbortObservation>((resolve,reject)=>{
   const worker=new Worker(new URL('./acceptance-dataset-abort-worker.mjs',import.meta.url),{workerData:{request,options:this.options},execArgv:[]});let value:AcceptanceDatasetAbortObservation|undefined,error:RunnerError|undefined,received=false,finished=false;
   const rpc=new Set<Promise<void>>();
   const allowed=async()=>{if(finished||signal?.aborted)return false;const current=await this.#request(i);return !finished&&!signal?.aborted&&current!==null&&canonical(current)===canonical(request);};
   const timeout=setTimeout(()=>{finished=true;error=new RunnerError('ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN',503,'unknown');void worker.terminate();},this.options.timeoutMs);
   worker.on('message',(m:{rpc?:string;id?:number;journal?:unknown;value?:AcceptanceDatasetAbortObservation;error?:{code:string;status:number}})=>{
    if(m.rpc){const task=(async()=>{try{if(finished)return;signal?.throwIfAborted();let result:unknown;if(m.rpc==='authorize')result=await allowed();else{const j=validateDatasetAbortJournal(m.journal);if(canonical(j.request)!==canonical(request))throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);if(m.rpc==='abort'){if(!await allowed())throw new RunnerError('ACCEPTANCE_DATA_ABORT_AUTHORIZATION_CHANGED',409);result=validateDatasetAbortProof(await this.#authorityCall(()=>this.authority!.abort(j,allowed)),j);}else if(m.rpc==='inspectAbort'){const p=await this.#authorityCall(()=>this.authority!.inspectAbort(j));result=p===null?null:validateDatasetAbortProof(p,j);}else throw new RunnerError('ACCEPTANCE_DATA_WORKER_PROTOCOL',409);}if(!finished)worker.postMessage({id:m.id,value:result});}catch(e){if(!finished)worker.postMessage({id:m.id,error:{code:e instanceof RunnerError?e.code:'ACCEPTANCE_DATA_ABORT_AUTHORITY_UNVERIFIED',status:e instanceof RunnerError?e.status:503}});}})();rpc.add(task);void task.finally(()=>rpc.delete(task));return;}
    received=true;if(m.error)error=new RunnerError(m.error.code,m.error.status);else value=m.value;
   });
   worker.on('error',()=>{error=new RunnerError('ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN',503,'unknown');});worker.once('exit',code=>{finished=true;clearTimeout(timeout);void(async()=>{await Promise.allSettled(rpc);if(error)reject(error);else if(code!==0||!received||!value)reject(new RunnerError('ACCEPTANCE_DATA_ABORT_OUTCOME_UNKNOWN',503,'unknown'));else resolve(value);})();});
  });}finally{const next=this.#waiting.shift();if(next)next();else this.#active--;}
 }
}
