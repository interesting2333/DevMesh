import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {StorageError,releasePublicationObservation} from '@devmesh/storage-sqlite';
import type {SqliteStorage,ReleasePublication,ReleasePublicationBackend} from '@devmesh/storage-sqlite';

/** Trusted explicit composition. No physical publisher is installed by default. */
export class ReleasePublisher {
 constructor(readonly storage:Pick<SqliteStorage,'request'>,readonly principalId:string,readonly backend?:ReleasePublicationBackend){opaqueKey.parse(principalId);}
 async advance(releaseId:string,signal?:AbortSignal):Promise<ReleasePublication>{
  signal?.throwIfAborted();
  const subject={principalId:this.principalId,releaseId:ids.release.parse(releaseId)};
  let publication=await this.storage.request('getReleasePublication',subject);
  if(publication.state==='PUBLISHED')return publication;
  signal?.throwIfAborted();
  if(!this.backend?.configured)throw new StorageError('RELEASE_PUBLICATION_BACKEND_NOT_CONFIGURED',503,'An explicit trusted publication backend is required');
  const bound={...subject,requestHash:sha256.parse(publication.requestHash)};
  let dispatch=false;
  if(publication.state==='PENDING'){
   await this.backend.preflight(publication);
   signal?.throwIfAborted();
   const grant=await this.storage.request('beginReleasePublication',{...bound,expectedRevision:publication.revision});
   publication=grant.publication;dispatch=grant.dispatch;
   if(publication.state==='PUBLISHED')return publication;
  }
  signal?.throwIfAborted();
  let observation;
   try{
    observation=releasePublicationObservation.parse(dispatch?await this.backend.publish(publication,async()=>!signal?.aborted&&(await this.storage.request('verifyReleasePublication',bound)).allowed&&!signal?.aborted):await this.backend.inspect(publication));
    // A new phase receives its own Runner grant; the original publish is never replayed.
    if(!dispatch&&observation.state==='UNKNOWN'&&this.backend.resume&&!signal?.aborted){
     const authorize=async()=>!signal?.aborted&&(await this.storage.request('verifyReleasePublicationContinuation',bound)).allowed&&!signal?.aborted;
     if(await authorize())observation=releasePublicationObservation.parse(await this.backend.resume(publication,authorize));
    }
   }
  catch{observation={state:'UNKNOWN' as const,errorCode:'RELEASE_PUBLICATION_BACKEND_UNCERTAIN',checkedAt:new Date().toISOString()};}
  return this.storage.request('recordReleasePublicationObservation',{...bound,expectedRevision:publication.revision,expectedSequence:publication.sequence,observation});
 }
 async recoverPage(input:{projectId:string;policyHash:string;afterSequence?:number;limit?:number}){
  const page=await this.storage.request('listReleasePublications',{principalId:this.principalId,projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),...(input.afterSequence===undefined?{}:{afterSequence:input.afterSequence}),...(input.limit===undefined?{}:{limit:input.limit})}),results=[];
  for(const {publication} of page.items){try{const value=await this.advance(publication.releaseId);results.push({releaseId:publication.releaseId,state:value.state,errorCode:value.errorCode});}catch(error){results.push({releaseId:publication.releaseId,state:'UNAVAILABLE',errorCode:error instanceof StorageError?error.code:'RELEASE_PUBLICATION_RECOVERY_UNAVAILABLE'});}}
  return {results,nextSequence:page.nextSequence};
 }
}
