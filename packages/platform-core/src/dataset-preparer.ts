import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,PreviewEffect,DatasetPreparationBackend,DatasetPreparationObservation} from '@devmesh/storage-sqlite';
import {opaqueKey,ids,sha256} from '@devmesh/contracts';
export class DatasetPreparer {
 constructor(readonly storage:Pick<SqliteStorage,'request'>,readonly principalId:string,readonly backend?:DatasetPreparationBackend){opaqueKey.parse(principalId);}
 async advance(operationId:string):Promise<PreviewEffect>{
  const subject={principalId:this.principalId,operationId:ids.operation.parse(operationId)};
  let effect=await this.storage.request('getPreviewEffect',subject);
  if(effect.kind!=='DATASET_PREPARE')throw new StorageError('DATASET_OPERATION_REQUIRED',422,'Only dataset preparation can be advanced here');
  if(effect.state==='SUCCEEDED'||effect.state==='FAILED')return effect;
  if(!this.backend?.configured)throw new StorageError('DATASET_BACKEND_NOT_CONFIGURED',503,'An explicit trusted dataset backend is required');
  let dispatch=false;
  if(effect.state==='PREPARED'){
   await this.backend.preflight(effect);
   const grant=await this.storage.request('markPreviewEffectSent',{...subject,requestHash:sha256.parse(effect.requestHash),expectedRevision:effect.revision});
   effect=grant.effect;dispatch=grant.dispatch;
   if(effect.state==='SUCCEEDED'||effect.state==='FAILED')return effect;
  }
  let observation:DatasetPreparationObservation;
  try{observation=dispatch?await this.backend.prepare(effect):await this.backend.inspect(effect);}
  catch{observation={state:'UNKNOWN',errorCode:'DATASET_BACKEND_UNCERTAIN'};}
  const current=await this.storage.request('getPreviewEffect',subject);
  if(current.state==='SUCCEEDED'||current.state==='FAILED')return current;
  if(current.requestHash!==effect.requestHash)throw new StorageError('PREVIEW_REQUEST_CHANGED',409,'Original dataset request changed');
  return this.storage.request('recordPreviewEffectObservation',{...subject,requestHash:sha256.parse(effect.requestHash),expectedRevision:current.revision,observation});
 }
 async recoverPage(input:{projectId:string;policyHash:string;afterSequence?:number;limit?:number}){
  const page=await this.storage.request('listPreviewEffects',{principalId:this.principalId,projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),...(input.afterSequence===undefined?{}:{afterSequence:input.afterSequence}),...(input.limit===undefined?{}:{limit:input.limit})}),results=[];
  for(const row of page.items){if(row.effect.kind!=='DATASET_PREPARE')continue;try{const effect=await this.advance(row.effect.operationId);results.push({operationId:effect.operationId,state:effect.state,errorCode:effect.errorCode});}catch(error){results.push({operationId:row.effect.operationId,state:row.effect.state,errorCode:error instanceof StorageError?error.code:'DATASET_RECOVERY_UNAVAILABLE'});}}
  return {results,nextSequence:page.nextSequence};
 }
}
