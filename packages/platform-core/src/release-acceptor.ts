import {createHash} from 'node:crypto';
import {roleOutput} from '@devmesh/contracts';
import {StorageError,canonical} from '@devmesh/storage-sqlite';
import type {SqliteStorage,Request,ContentReference} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
/** Trusted material preflight outside T5. Infrastructure readiness is supplied
 * by the separately configured preparer; this never creates or publishes it. */
export class ReleaseAcceptor {
  constructor(readonly storage:Pick<SqliteStorage,'request'>,readonly content:Pick<LocalContentStore,'readBytes'>){}
  async accept(input:Request<'commitReleaseAcceptance'>){
    // Recover via the writer's original request hash and current authorization.
    // Do not require current files/health/Run state to acknowledge an old commit.
    if(await this.storage.request('lookupOperation',input.meta))return this.storage.request('commitReleaseAcceptance',input);
    const principalId=input.meta.principalId,candidate=await this.storage.request('getReleaseCandidate',{principalId,runId:input.runId,candidateId:input.candidateId});
    const reject=():never=>{throw new StorageError('ACCEPTANCE_CONTENT_UNAVAILABLE',409,'Exact frozen candidate bytes are required before acceptance');};
    if(candidate.qualification!=='CURRENT'||candidate.revision!==input.candidateRevision||candidate.manifestHash!==input.manifestHash)throw new StorageError('ACCEPTANCE_BASIS_CHANGED',409,'Acceptance requires the exact current candidate');
    const queue:{reference:ContentReference;sha256:string}[]=[],seen=new Set<string>(),candidates=new Set(candidate.manifest.works.map(w=>w.assessment.candidate.sha256));
    const add=(reference:ContentReference,sha256:string)=>{if(!seen.has(sha256)){if(seen.size>=2048)reject();seen.add(sha256);queue.push({reference,sha256});}};
    function refs(value:unknown):void{
      if(Array.isArray(value)){for(const child of value)refs(child);return;}
      if(!value||typeof value!=='object')return;
      const ref=value as Record<string,unknown>;if(typeof ref.artifactId==='string'&&typeof ref.sha256==='string')add({kind:'artifact',artifactId:ref.artifactId},ref.sha256);
      for(const child of Object.values(ref))refs(child);
    }
    refs(candidate.manifest);
    for(const q of candidate.manifest.quality)for(const m of q.materials)add({kind:'qualityMaterial',operationId:q.verification.operationId,materialKey:m.materialKey},m.contentHash!);
    for(const m of candidate.manifest.delivery.materials)add({kind:'releaseDelivery',operationId:candidate.manifest.delivery.record.operationId,materialKey:m.materialKey},m.contentHash!);
    let total=0;
    for(let index=0;index<queue.length;index++){
      const ref=queue[index]!,bytes=await this.content.readBytes(principalId,ref.reference,64*1024*1024);total+=bytes.byteLength;
      if(total>512*1024*1024||hash(bytes)!==ref.sha256)reject();
      if(candidates.has(ref.sha256)){
        let value:unknown;try{value=JSON.parse(Buffer.from(bytes).toString('utf8'));}catch{reject();}
        const parsed=roleOutput.safeParse(value);if(!parsed.success)reject();
        if(hash(Buffer.from(canonical(parsed.data)))!==ref.sha256)reject();refs(parsed.data);
      }
    }
    if(canonical([...seen].sort())!==canonical(candidate.preflightHashes))reject();
    return this.storage.request('commitReleaseAcceptance',input);
  }
}
