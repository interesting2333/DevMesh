import {Worker} from 'node:worker_threads';
import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import {canonical,datasetPreparationRequest} from '@devmesh/storage-sqlite';
import type {PreviewEffect,DatasetPreparationBackend,DatasetPreparationObservation} from '@devmesh/storage-sqlite';
import {createHash} from 'node:crypto';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {webCrudDatasetProfile} from './dataset-profile.js';
import {RunnerError} from './protocol.js';
export const localSqliteDatasetOptions=z.strictObject({mode:z.literal('local-development'),runnerRoot:z.string(),controlDataRoot:z.string(),backupRoot:z.string(),runnerId:opaqueKey,backendRef:opaqueKey,maximumBytes:z.number().int().min(4096).max(256*1024*1024).default(64*1024*1024),timeoutMs:z.number().int().min(1000).max(120000).default(30000),maximumWorkers:z.number().int().min(1).max(8).default(2)});
export type LocalSqliteDatasetOptions=z.input<typeof localSqliteDatasetOptions>;
export function validateDatasetEffect(effect:PreviewEffect,options:z.output<typeof localSqliteDatasetOptions>){
 const request=datasetPreparationRequest.parse(effect.request),hash=createHash('sha256').update(canonical(request)).digest('hex');
 if(effect.kind!=='DATASET_PREPARE'||effect.previewId!==null||request.operationId!==effect.operationId||request.projectId!==effect.projectId||request.runId!==effect.runId||request.candidateId!==effect.candidateId||request.datasetId!==effect.datasetId||request.datasetId!==effect.remoteKey||request.policyHash!==effect.policyHash||hash!==effect.requestHash||request.runnerId!==options.runnerId||request.backendRef!==options.backendRef)throw new RunnerError('DATASET_ORIGINAL_REQUEST_CHANGED',409);
 if(request.templateVersion!==webCrudDatasetProfile.templateVersion||request.schemaRevision!==webCrudDatasetProfile.schemaRevision)throw new RunnerError('DATASET_MIGRATION_NOT_CONFIGURED',503);
 return request;
}
/** Explicit local development adapter. It cannot authorize a production migration. */
export class LocalSqliteDatasetBackend implements DatasetPreparationBackend {
 readonly configured=true;readonly options:z.output<typeof localSqliteDatasetOptions>;#active=0;#waiting:(()=>void)[]=[];
 constructor(options:LocalSqliteDatasetOptions){this.options=localSqliteDatasetOptions.parse(options);new RunnerDatasetPaths(this.options);}
 async #call(action:'preflight'|'prepare'|'inspect',effect:PreviewEffect){
  validateDatasetEffect(effect,this.options);
  if(this.#active>=this.options.maximumWorkers){if(this.#waiting.length>=128)throw new RunnerError('DATASET_WORKER_BUSY',503,'not-sent');await new Promise<void>(resolve=>this.#waiting.push(resolve));}
  else this.#active++;
  try{return await new Promise<DatasetPreparationObservation|undefined>((resolve,reject)=>{
   const worker=new Worker(new URL('./dataset-worker.mjs',import.meta.url),{workerData:{action,effect,options:this.options},execArgv:[]});let value:DatasetPreparationObservation|undefined,error:RunnerError|undefined,received=false;
   const timeout=setTimeout(()=>{error=new RunnerError('DATASET_WORKER_OUTCOME_UNKNOWN',503,'unknown');void worker.terminate();},this.options.timeoutMs);
   worker.on('message',(m:{value?:DatasetPreparationObservation;error?:{code:string;status:number}})=>{received=true;if(m.error)error=new RunnerError(m.error.code,m.error.status);else value=m.value;});
   worker.on('error',()=>{error=new RunnerError('DATASET_WORKER_OUTCOME_UNKNOWN',503,'unknown');});
   worker.once('exit',code=>{clearTimeout(timeout);if(error)reject(error);else if(code!==0||!received)reject(new RunnerError('DATASET_WORKER_OUTCOME_UNKNOWN',503,'unknown'));else resolve(value);});
  });}finally{const next=this.#waiting.shift();if(next)next();else this.#active--;}
 }
 async preflight(effect:PreviewEffect){await this.#call('preflight',effect);}
 async prepare(effect:PreviewEffect){if(effect.state!=='SENT')throw new RunnerError('DATASET_DISPATCH_GRANT_REQUIRED',409);return (await this.#call('prepare',effect))!;}
 async inspect(effect:PreviewEffect){return (await this.#call('inspect',effect))!;}
}
