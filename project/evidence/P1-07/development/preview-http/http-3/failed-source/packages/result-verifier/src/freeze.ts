import {roleOutput} from '@devmesh/contracts';
import type {SqliteStorage,Request,ContentReference} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import {canonical,sha256} from './source.js';
import {parseSourceJson,reject} from './json.js';
type Input=Omit<Request<'freezeReleaseCandidate'>,'basisHash'|'contentHashes'>;
type Ref={reference:ContentReference;sha256:string};
/** Actual bytes are read before a basis-checked Worker transaction. No execution. */
export class CandidateFreezer {
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore){}
 async freeze(input:Input){
  const principalId=input.meta.principalId,old=await this.storage.request('lookupOperation',input.meta);
  if(old){
   if(old.status!=='SUCCEEDED'||typeof old.result?.candidateId!=='string')return reject('IDEMPOTENCY_KEY_REUSED');
   const original=await this.storage.request('getReleaseCandidate',{principalId,runId:input.runId,candidateId:old.result.candidateId});
   return this.storage.request('freezeReleaseCandidate',{...input,basisHash:original.manifestHash,contentHashes:original.preflightHashes});
  }
  const prepared=await this.storage.request('prepareReleaseCandidateFreeze',{principalId,runId:input.runId,integrationOperationId:input.integrationOperationId,deliveryOperationId:input.deliveryOperationId}),manifest=prepared.manifest,queue:Ref[]=[],queued=new Set<string>(),candidates=new Set(manifest.works.map(w=>w.assessment.candidate.sha256));
  const add=(reference:ContentReference,hash:string)=>{if(!queued.has(hash)){if(queued.size>=2048)return reject('RELEASE_CANDIDATE_CONTENT_LIMIT');queued.add(hash);queue.push({reference,sha256:hash});}};
  function artifacts(value:unknown):void{
   if(Array.isArray(value)){for(const v of value)artifacts(v);return;}if(!value||typeof value!=='object')return;
   const v=value as Record<string,unknown>;if(typeof v.artifactId==='string'&&typeof v.sha256==='string')add({kind:'artifact',artifactId:v.artifactId},v.sha256);
   for(const child of Object.values(v))artifacts(child);
  }
  artifacts(manifest);
  for(const q of manifest.quality)for(const m of q.materials)add({kind:'qualityMaterial',operationId:q.verification.operationId,materialKey:m.materialKey},m.contentHash!);
  for(const m of manifest.delivery.materials)add({kind:'releaseDelivery',operationId:manifest.delivery.record.operationId,materialKey:m.materialKey},m.contentHash!);
  let total=0;
  for(let index=0;index<queue.length;index++){
   const ref=queue[index]!,bytes=await this.content.readBytes(principalId,ref.reference,64*1024*1024);total+=bytes.byteLength;
   if(total>512*1024*1024)return reject('RELEASE_CANDIDATE_CONTENT_LIMIT');if(sha256(bytes)!==ref.sha256)return reject('RELEASE_CANDIDATE_CONTENT_CHANGED');
   if(candidates.has(ref.sha256)){const parsed=roleOutput.safeParse(parseSourceJson(bytes));if(!parsed.success||sha256(canonical(parsed.data))!==ref.sha256)return reject('RELEASE_CANDIDATE_CONTENT_CHANGED');artifacts(parsed.data);}
  }
  return this.storage.request('freezeReleaseCandidate',{...input,basisHash:prepared.manifestHash,contentHashes:[...queued].sort()});
 }
}
