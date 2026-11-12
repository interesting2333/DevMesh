// Explicit adapter statements for control-plane protocol tests only. These fields
// are not physical fences, actual Runner custody, containers, or HTTP health.
import {hash,canonical} from './storage-data.mjs';
export const binding=(f,p)=>({principalId:f.policy.backendPrincipalId,operationId:p.operationId,requestHash:p.requestHash});
export function preparedObservation(p){
  const r=p.request,now=new Date().toISOString(),claim={schemaVersion:'devmesh.preview-release-claim.v1',operationId:p.operationId,releaseId:r.releaseId,candidateId:r.candidateId,manifestHash:r.manifestHash,previewId:'preview_acceptance_fixture',datasetId:r.target.datasetId,imageDigest:r.image.imageDigest,startOperationId:'op_acceptance_fixture_start',startRequestHash:hash('explicit start'),instanceId:'acceptance.fixture.instance',acceptanceRequestHash:p.requestHash};
  const fence=name=>({kind:'DURABLE_WRITE_FENCE',fenceId:name,generation:1,proofHash:hash(name),heldAt:now,state:'HELD'});
  const proof={schemaVersion:'devmesh.acceptance-prepared.v1',operationId:p.operationId,requestHash:p.requestHash,...Object.fromEntries(['releaseId','projectId','runId','candidateId','manifestHash','reviewHash','dataPlanHash','runnerId','backendRef'].map(k=>[k,r[k]])),data:{datasetId:r.target.datasetId,storageKey:r.target.storageKey,schemaRevision:r.target.schemaRevision,originDatasetId:r.dataPlan.strategy==='PRESERVE_MIGRATE'?r.source.datasetId:null,sourceReleaseId:r.expectedAcceptedReleaseId,snapshotAt:now,sha256:hash('explicit data snapshot'),byteSize:4096,integrity:'ok',journalHash:hash('explicit journal'),migrationRef:r.dataPlan.migrationRef},sourceFence:null,targetFence:{datasetId:r.target.datasetId,physical:fence('acceptance.fixture.target.fence'),writeState:'CLOSED'},service:{reservationId:'acceptance.fixture.reservation',profileHash:hash('explicit profile'),endpoint:{host:'127.0.0.1',port:19081},claim,claimHash:hash(canonical(claim)),custodyState:'RELEASE_HELD',custodyRevision:2},preparedAt:now};
  return {state:'READY',proof,fences:{sourceProofHash:null,targetProofHash:proof.targetFence.physical.proofHash,state:'HELD',writeState:'CLOSED'},health:{instanceId:claim.instanceId,datasetId:claim.datasetId,imageDigest:claim.imageDigest,endpoint:proof.service.endpoint,claimHash:proof.service.claimHash,custodyState:'RELEASE_HELD',custodyRevision:2,state:'HEALTHY'},checkedAt:now};
}
export function explicitAcceptanceBackend(){
  let observation;
  const counts={preflight:0,prepare:0,inspect:0};
  return {configured:true,counts,setObservation(value){observation=value;},async preflight(){counts.preflight++;},async prepare(p,authorize){counts.prepare++;if(!await authorize())throw Error('Authorization closed');observation??=preparedObservation(p);return observation;},async inspect(){counts.inspect++;return observation?.state==='READY'?{...observation,checkedAt:new Date().toISOString()}:{state:'UNKNOWN',errorCode:'FIXTURE_ORIGINAL_UNCERTAIN',checkedAt:new Date().toISOString()};}};
}
