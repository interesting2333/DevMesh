import type {SqliteStorage,VerifiedRepair,Request,Results} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,sha256} from './source.js';
import {VerificationError} from './json.js';
/** Proposes a new immutable plan. Execution still waits for explicit confirmation. */
export class RepairPlanner {
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore){}
 async prepare(input:Request<'prepareVerifiedRepair'>):Promise<VerifiedRepair>{
  let row=await this.storage.request('prepareVerifiedRepair',input);
  const body=Buffer.from(canonical(row.plan));if(sha256(body)!==row.expectedHash||body.byteLength!==row.byteSize)throw new VerificationError('VERIFIED_REPAIR_BYTES_CHANGED');
  await this.content.put({meta:{principalId:input.principalId,scopeId:row.operationId,idempotencyKey:row.writeKey},expectedHash:row.expectedHash,expectedSize:row.byteSize,mimeType:'application/json',target:{kind:'verifiedRepair',operationId:row.operationId}},body);
  row=await this.storage.request('getVerifiedRepair',{principalId:input.principalId,operationId:input.operationId});return row;
 }
 async publish(principalId:string,operationId:string):Promise<Results['publishVerifiedRepair']>{
  const row=await this.storage.request('getVerifiedRepair',{principalId,operationId});
  return this.storage.request('publishVerifiedRepair',{meta:{principalId,scopeId:row.runId,idempotencyKey:row.publishKey},runId:row.runId,operationId});
 }
}
