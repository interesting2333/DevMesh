import {deliveryDataPlan,previewImageLimits} from '@devmesh/contracts';
import type {SqliteStorage,Request,ReleaseDeliveryMaterial} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {RunnerClient} from '@devmesh/runner';
import {originalRunnerFact} from './collector.js';
import {canonical,sha256} from './source.js';
import {parseSourceJson,reject} from './json.js';
import {verifyPreviewImage} from './preview-image.js';

/** Collects only the approved original Job's fixed outputs. No execution path. */
export class DeliveryCollector {
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore,readonly runner?:Pick<RunnerClient,'get'|'output'>){}
 async collect(input:Request<'beginReleaseDelivery'>){
  const delivery=await this.storage.request('beginReleaseDelivery',input);
  if(delivery.state==='READY')return delivery;
  if(delivery.qualification!=='CURRENT')return reject('RELEASE_DELIVERY_BASIS_STALE');
  const subject={principalId:input.principalId,operationId:input.operationId},bound={...subject,requestHash:delivery.requestHash},origin=await this.storage.request('getReleaseDeliveryOrigin',bound),rows=await this.storage.request('listReleaseDeliveryMaterials',subject),bytes=new Map<string,Uint8Array>();
  if(rows.some(row=>!row.contentHash)){
   if(!this.runner)return reject('DELIVERY_RUNNER_NOT_CONFIGURED');
   if(canonical(originalRunnerFact(await this.runner.get(origin.job.jobId)))!==canonical(origin.job))return reject('DELIVERY_ORIGIN_FACT_CHANGED');
  }
  for(const row of rows){
   const target={kind:'releaseDelivery' as const,operationId:input.operationId,materialKey:row.materialKey};
   let value:Uint8Array;
   if(row.contentHash)value=await this.content.readBytes(input.principalId,target,previewImageLimits.blobBytes);
   else {
    value=await this.runner!.output(origin.job.jobId,row.outputIndex,{sha256:row.expectedHash,byteSize:row.byteSize},previewImageLimits.blobBytes);
    this.check(row,value);
    await this.content.put({meta:{principalId:input.principalId,scopeId:input.operationId,idempotencyKey:row.writeKey},target,expectedHash:row.expectedHash,expectedSize:row.byteSize,mimeType:'application/octet-stream'},value);
   }
   this.check(row,value);bytes.set(row.materialKey,value);
  }
  const imageRows=rows.filter(row=>row.materialKey==='image.config'||row.materialKey.startsWith('image.layer.'));
  const image=verifyPreviewImage({targetCommit:delivery.basis.targetCommit,buildArtifactHash:sha256(bytes.get('build')!),manifestBytes:bytes.get('image.manifest')!,expectedDigest:'sha256:'+rows.find(row=>row.materialKey==='image.manifest')!.expectedHash,blobs:new Map(imageRows.map(row=>['sha256:'+row.expectedHash,bytes.get(row.materialKey)!]))});
  const parsed=deliveryDataPlan.safeParse(parseSourceJson(bytes.get('data.plan')!));if(!parsed.success)return reject('DELIVERY_DATA_PLAN_INVALID');
  return this.storage.request('completeReleaseDelivery',{...bound,image,dataPlan:parsed.data});
 }
 private check(row:ReleaseDeliveryMaterial,bytes:Uint8Array){if(bytes.byteLength!==row.byteSize||sha256(bytes)!==row.expectedHash)return reject('DELIVERY_MATERIAL_BYTES_CHANGED');}
}
