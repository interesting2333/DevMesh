import {Worker} from 'node:worker_threads';
import {z} from 'zod';
import {opaqueKey,sha256} from '@devmesh/contracts';
import {acceptancePreparationRequest,canonical} from '@devmesh/storage-sqlite';
import type {AcceptancePreparation} from '@devmesh/storage-sqlite';
import {RunnerDatasetPaths} from './dataset-paths.js';
import {localSqliteDatasetOptions} from './dataset-backend.js';
import {webCrudDatasetProfile} from './dataset-profile.js';
import {acceptanceDatasetFences,acceptanceDatasetReceipt,datasetHash} from './dataset-journal.js';
import type {AcceptanceDatasetFences} from './dataset-journal.js';
import {RunnerError} from './protocol.js';

export const acceptanceDataOptions=localSqliteDatasetOptions.extend({backendRef:opaqueKey});
export const acceptanceCopyPlan=z.strictObject({schemaVersion:z.literal('devmesh.sqlite-migration.v1'),kind:z.literal('COPY_SAME_SCHEMA'),templateVersion:z.literal(webCrudDatasetProfile.templateVersion),fromSchema:z.literal(webCrudDatasetProfile.schemaRevision),toSchema:z.literal(webCrudDatasetProfile.schemaRevision)});
export type AcceptanceDatasetObservation={state:'MATERIALIZED';receipt:z.output<typeof acceptanceDatasetReceipt>}|{state:'UNKNOWN';errorCode:string};
/** Implementations must durably exclude every source/target writer, including
 * already admitted work. A process lock or control-plane CLOSED flag is insufficient. */
export interface AcceptanceDatasetAuthority {
 readonly configured:boolean;
 /** Read-only configuration and original-subject check. */
 preflight(preparation:AcceptancePreparation):Promise<void>;
 /** Only the exclusive original journal winner may acquire. Recheck authorize
 * immediately before each physical effect. Retain custody after interruption. */
 acquire(preparation:AcceptancePreparation,authorize:()=>Promise<boolean>):Promise<AcceptanceDatasetFences>;
 /** Query original durable custody only; never acquire, renew, or replace it. */
 inspect(preparation:AcceptancePreparation):Promise<AcceptanceDatasetFences>;
}
export type AcceptanceDatasetOptions=z.input<typeof acceptanceDataOptions>&{
 authority?:AcceptanceDatasetAuthority;
 trustedMigrationHashes?:readonly string[];
 loadMigration?:(ref:NonNullable<AcceptancePreparation['request']['dataPlan']['migrationRef']>)=>Promise<Uint8Array>;
};
export function validateAcceptanceDataset(preparation:AcceptancePreparation,options:z.output<typeof acceptanceDataOptions>){
 const r=acceptancePreparationRequest.parse(preparation.request);
 if(r.operationId!==preparation.operationId||r.releaseId!==preparation.releaseId||r.projectId!==preparation.projectId||r.runId!==preparation.runId||r.candidateId!==preparation.candidateId||r.policyHash!==preparation.policyHash||r.dataPlanHash!==datasetHash(canonical(r.dataPlan))||datasetHash(canonical(r))!==preparation.requestHash||r.runnerId!==options.runnerId||r.backendRef!==options.backendRef)throw new RunnerError('ACCEPTANCE_DATA_ORIGINAL_CHANGED',409);
 if(r.dataPlan.templateVersion!==webCrudDatasetProfile.templateVersion||r.target.schemaRevision!==webCrudDatasetProfile.schemaRevision||r.source&&r.source.schemaRevision!==webCrudDatasetProfile.schemaRevision)throw new RunnerError('ACCEPTANCE_DATA_MIGRATION_NOT_CONFIGURED',503);
 return r;
}
export function validateAcceptanceFences(value:unknown,p:AcceptancePreparation){
 const f=acceptanceDatasetFences.parse(value),s=p.request.source;
 if(f.operationId!==p.operationId||f.requestHash!==p.requestHash||f.targetFence.datasetId!==p.request.target.datasetId||(s?f.sourceFence?.datasetId!==s.datasetId||f.sourceFence.datasetOperationId!==s.datasetOperationId:f.sourceFence!==null))throw new RunnerError('ACCEPTANCE_DATA_CUSTODY_CHANGED',409);
 return f;
}
export function validateAcceptanceMigration(bytes:Uint8Array,preparation:AcceptancePreparation,trusted:readonly string[]){
 const ref=preparation.request.dataPlan.migrationRef;
 if(!ref||bytes.length>32768||!trusted.includes(ref.sha256)||datasetHash(bytes)!==ref.sha256)throw new RunnerError('ACCEPTANCE_DATA_MIGRATION_UNTRUSTED',409);
 return acceptanceCopyPlan.parse(JSON.parse(Buffer.from(bytes).toString('utf8')));
}
/** Explicit local data materializer. This produces data evidence only; it does
 * not implement AcceptancePreparationBackend or attest service/release readiness. */
export class LocalSqliteAcceptanceDatasetBackend {
 readonly options:z.output<typeof acceptanceDataOptions>;readonly authority:AcceptanceDatasetAuthority|undefined;
 readonly trustedMigrationHashes:readonly string[];readonly loadMigration:AcceptanceDatasetOptions['loadMigration'];
 #active=0;#waiting:(()=>void)[]=[];
 constructor(options:AcceptanceDatasetOptions){
  const {authority,trustedMigrationHashes=[],loadMigration,...paths}=options;
  this.options=acceptanceDataOptions.parse(paths);new RunnerDatasetPaths(this.options);this.authority=authority;this.trustedMigrationHashes=Object.freeze(trustedMigrationHashes.map(h=>sha256.parse(h)));this.loadMigration=loadMigration;
 }
 get configured(){return this.authority?.configured===true;}
 async #call(action:'preflight'|'prepare'|'inspect',preparation:AcceptancePreparation,authorize?:()=>Promise<boolean>){
  validateAcceptanceDataset(preparation,this.options);
  if(!this.configured)throw new RunnerError('ACCEPTANCE_DATA_CUSTODY_NOT_CONFIGURED',503,'not-sent');
  if(this.#active>=this.options.maximumWorkers){if(this.#waiting.length>=128)throw new RunnerError('ACCEPTANCE_DATA_WORKER_BUSY',503,'not-sent');await new Promise<void>(resolve=>this.#waiting.push(resolve));}else this.#active++;
  try{return await new Promise<AcceptanceDatasetObservation|undefined>((resolve,reject)=>{
   const worker=new Worker(new URL('./acceptance-dataset-worker.mjs',import.meta.url),{workerData:{action,preparation,options:this.options,trustedMigrationHashes:this.trustedMigrationHashes},execArgv:[]});
   let value:AcceptanceDatasetObservation|undefined,error:RunnerError|undefined,received=false,finished=false;
   const rpc=new Set<Promise<void>>();
   const allowed=async()=>!finished&&!!authorize&&await authorize()&&!finished;
   const timeout=setTimeout(()=>{finished=true;error=new RunnerError('ACCEPTANCE_DATA_OUTCOME_UNKNOWN',503,'unknown');void worker.terminate();},this.options.timeoutMs);
   worker.on('message',(m:{rpc?:string;id?:number;value?:AcceptanceDatasetObservation;error?:{code:string;status:number}})=>{
    if(m.rpc){const task=(async()=>{
     try{
      let result:unknown;
      if(finished)return;
      if(m.rpc==='authorize')result=await allowed();
      else if(m.rpc==='preflight')await this.authority!.preflight(preparation);
      else if(m.rpc==='acquire'){if(!await allowed())throw new RunnerError('ACCEPTANCE_DATA_AUTHORIZATION_CHANGED',409);result=validateAcceptanceFences(await this.authority!.acquire(preparation,allowed),preparation);}
      else if(m.rpc==='inspect'||m.rpc==='verify'){if(m.rpc==='verify'&&!await allowed())throw new RunnerError('ACCEPTANCE_DATA_AUTHORIZATION_CHANGED',409);result=validateAcceptanceFences(await this.authority!.inspect(preparation),preparation);}
      else if(m.rpc==='migration'){if(!this.loadMigration)throw new RunnerError('ACCEPTANCE_DATA_MIGRATION_NOT_CONFIGURED',503);const bytes=await this.loadMigration(preparation.request.dataPlan.migrationRef!);validateAcceptanceMigration(bytes,preparation,this.trustedMigrationHashes);result=bytes;}
      else throw new RunnerError('ACCEPTANCE_DATA_WORKER_PROTOCOL',409);
      if(!finished)worker.postMessage({id:m.id,value:result});
     }catch(e){if(!finished)worker.postMessage({id:m.id,error:{code:e instanceof RunnerError?e.code:'ACCEPTANCE_DATA_AUTHORITY_UNVERIFIED',status:e instanceof RunnerError?e.status:503}});}
    })();rpc.add(task);void task.finally(()=>rpc.delete(task));return;}
    received=true;if(m.error)error=new RunnerError(m.error.code,m.error.status);else value=m.value;
   });
   worker.on('error',()=>{error=new RunnerError('ACCEPTANCE_DATA_OUTCOME_UNKNOWN',503,'unknown');});
   worker.once('exit',code=>{finished=true;clearTimeout(timeout);void (async()=>{
    // Worker termination does not terminate authority, authorization or migration
    // calls in this process. Keep the caller and its slot until those calls drain.
    await Promise.allSettled(rpc);
    if(error)reject(error);else if(code!==0||!received)reject(new RunnerError('ACCEPTANCE_DATA_OUTCOME_UNKNOWN',503,'unknown'));else resolve(value);
   })();});
  });}finally{const next=this.#waiting.shift();if(next)next();else this.#active--;}
 }
 async preflight(preparation:AcceptancePreparation){await this.#call('preflight',preparation);}
 async prepare(preparation:AcceptancePreparation,authorize:()=>Promise<boolean>){if(preparation.state!=='SENT')throw new RunnerError('ACCEPTANCE_DATA_DISPATCH_GRANT_REQUIRED',409);return (await this.#call('prepare',preparation,authorize))!;}
 async inspect(preparation:AcceptancePreparation){return (await this.#call('inspect',preparation))!;}
}
