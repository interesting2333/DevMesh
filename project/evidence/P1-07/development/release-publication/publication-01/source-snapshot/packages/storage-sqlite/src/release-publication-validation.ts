import type {ReleasePublication,ReleasePublicationObservation} from './release-publication-protocol.js';
import {canonical} from './json.js';
import {digest} from './migrations.js';
import {StorageError} from './errors.js';
const fail=(code:string):never=>{throw new StorageError(code,409,'Publication requires the exact original accepted release, distinct writable service and fresh fenced route');};
export function validateReleasePublication(publication:ReleasePublication,o:Extract<ReleasePublicationObservation,{state:'PUBLISHED'}>,now:number){
 const request=publication.request,q=request.preparation,prepared=request.preparedProof,p=o.proof,claim=p.service.claim,route=p.route,old=prepared.service.claim;
 if(old.schemaVersion!=='devmesh.acceptance-service-claim.v1')return fail('RELEASE_PUBLICATION_PURPOSE_REQUIRED');
 if(p.releaseId!==q.releaseId||p.acceptanceOperationId!==request.acceptanceOperationId||p.preparationOperationId!==q.operationId||p.promotionRequestHash!==publication.requestHash||p.preparedProofHash!==request.proofHash||p.runnerId!==q.runnerId||p.backendRef!==q.backendRef||canonical(p.gates)!==canonical(publication.basis))fail('RELEASE_PUBLICATION_PROOF_CHANGED');
 const retired=p.readonlyRetirement;
 if(retired.reservationId!==prepared.service.reservationId||retired.profileHash!==prepared.service.profileHash||retired.serviceRequestHash!==old.serviceRequestHash||retired.instanceId!==old.instanceId)fail('RELEASE_PUBLICATION_RETIREMENT_CHANGED');
 if(claim.reservationId===retired.reservationId||claim.profileHash===retired.profileHash||claim.instanceId===retired.instanceId||claim.networkId===retired.networkId)fail('RELEASE_PUBLICATION_DISTINCT_SERVICE_REQUIRED');
 const follows=(next:{fenceId:string;generation:number;previousHoldHash:string},held:{fenceId:string;generation:number;proofHash:string})=>next.fenceId===held.fenceId&&next.generation>held.generation&&next.previousHoldHash===held.proofHash;
 if(p.target.datasetId!==q.target.datasetId||!follows(p.target,prepared.targetFence.physical))fail('RELEASE_PUBLICATION_FENCE_CHANGED');
 if(q.source){if(!p.source||!prepared.sourceFence||p.source.releaseId!==q.source.releaseId||p.source.datasetId!==q.source.datasetId||p.source.datasetOperationId!==q.source.datasetOperationId||!follows(p.source,prepared.sourceFence.physical))fail('RELEASE_PUBLICATION_FENCE_CHANGED');}else if(p.source!==null)fail('RELEASE_PUBLICATION_SOURCE_NOT_APPLICABLE');
 const expectedClaim={releaseId:q.releaseId,projectId:q.projectId,runId:q.runId,candidateId:q.candidateId,acceptanceOperationId:request.acceptanceOperationId,preparationOperationId:q.operationId,promotionRequestHash:publication.requestHash,preparedProofHash:request.proofHash,runnerId:q.runnerId,datasetId:q.target.datasetId,imageDigest:q.image.imageDigest};
 for(const key of Object.keys(expectedClaim) as (keyof typeof expectedClaim)[])if(claim[key]!==expectedClaim[key])fail('RELEASE_PUBLICATION_CLAIM_CHANGED');
 const targetFence={fenceId:p.target.fenceId,generation:p.target.generation,proofHash:p.target.proofHash,previousHoldHash:p.target.previousHoldHash};
 if(canonical(claim.targetFence)!==canonical(targetFence)||p.service.claimHash!==digest(canonical(claim)))fail('RELEASE_PUBLICATION_CLAIM_CHANGED');
 if(route.routeId!=='release.'+q.projectId||route.projectId!==q.projectId||route.releaseId!==q.releaseId||route.previousReleaseId!==q.expectedAcceptedReleaseId||route.datasetId!==q.target.datasetId||route.imageDigest!==q.image.imageDigest||route.instanceId!==claim.instanceId||canonical(route.endpoint)!==canonical(p.service.endpoint)||route.serviceClaimHash!==p.service.claimHash||p.routeHash!==digest(canonical(route)))fail('RELEASE_PUBLICATION_ROUTE_CHANGED');
 const current=o.current,s=current.service,r=current.route,f=current.fences;
 if(s.instanceId!==claim.instanceId||s.datasetId!==claim.datasetId||s.imageDigest!==claim.imageDigest||s.profileHash!==claim.profileHash||s.claimHash!==p.service.claimHash||canonical(s.endpoint)!==canonical(p.service.endpoint))fail('RELEASE_PUBLICATION_HEALTH_CHANGED');
 if(r.routeId!==route.routeId||r.routeHash!==p.routeHash||r.generation!==route.generation||r.instanceId!==claim.instanceId)fail('RELEASE_PUBLICATION_ROUTE_CHANGED');
 if(f.targetProofHash!==p.target.proofHash||f.sourceProofHash!==(p.source?.proofHash??null)||f.revocationProofHash!==p.revocation.proofHash)fail('RELEASE_PUBLICATION_FENCE_CHANGED');
 const dispatched=Date.parse(publication.dispatchedAt??''),published=Date.parse(p.publishedAt),checked=Date.parse(o.checkedAt),retiredAt=Date.parse(retired.verifiedAt);
 if(!Number.isFinite(dispatched)||published<dispatched||published>checked||retiredAt<dispatched||retiredAt>published||checked>now||now-checked>30_000)fail('RELEASE_PUBLICATION_OBSERVATION_STALE');
 return p;
}
