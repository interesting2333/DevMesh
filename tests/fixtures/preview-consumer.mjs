// Actual control Worker; upstream candidate/OCI and container facts are explicit.
import {DatasetPreparer} from '../../packages/platform-core/dist/index.mjs';
import {acceptanceFixture} from './acceptance.mjs';
import {containerFixture} from './preview-container.mjs';
import {ControlledPreviewBackend} from './preview-lifecycle.mjs';
import {meta,hash} from './storage-data.mjs';
export const barrier=()=>Promise.withResolvers();
export const previewScope=(f,backend=f.backend)=>({projectId:f.p.projectId,policyHash:f.policyHash,principalId:f.principalId,backendRef:f.policy.backendRef,runnerId:f.policy.runnerId,backend});
export async function previewConsumerFixture(t,{runner=false,expiresInMs=3600000,pendingDataset=false}={}){
 const f=await acceptanceFixture(t,{register:false,reviewed:false}),local=runner?await containerFixture(t):undefined,principalId='preview.backend.local',policy={schemaVersion:'devmesh.preview-backend.v1',backendPrincipalId:principalId,backendRef:'sqlite.local-development.v1',runnerId:'runner.preview.local',templateVersion:f.candidate.manifest.templateVersion,schemaRevision:'web-crud-v1.schema.1',retentionDays:30,initialModes:['EMPTY','DEMO'],allowSnapshots:true},registration=await f.call('registerPreviewBackendPolicy',{principalId:'user_1',projectId:f.p.projectId,policy});
 const storage={request:(m,i)=>f.call(m,i)},readEffect=operationId=>f.call('getPreviewEffect',{principalId,operationId}),view=previewId=>f.call('getPreview',{principalId:'user_1',runId:f.p.runId,previewId}),lifecycle=previewId=>f.call('getPreviewLifecycle',{principalId,previewId});
 const create=async()=>{
  const conditional=async()=>({meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+(await f.call('getRun',{runId:f.p.runId})).resourceRevision+'"',candidateId:f.candidate.candidateId,manifestHash:f.candidate.manifestHash}),d=await f.call('createPreviewDataset',{...await conditional(),policyHash:registration.policyHash});
  if(pendingDataset)return {d,preview:null};
  if(local)await new DatasetPreparer(storage,principalId,local.data.backend).advance(d.operationId);
  else{const e=await readEffect(d.operationId),b={principalId,operationId:e.operationId,requestHash:e.requestHash};const sent=(await f.call('markPreviewEffectSent',{...b,expectedRevision:e.revision})).effect;await f.call('recordPreviewEffectObservation',{...b,expectedRevision:sent.revision,observation:{state:'SUCCEEDED',receipt:{kind:'DATASET_READY',datasetId:d.datasetId,storageKey:d.storageKey,originDatasetId:null,schemaRevision:d.schemaRevision,snapshotAt:new Date().toISOString(),sha256:hash('explicit consumer fixture dataset receipt'),byteSize:4096,integrity:'ok'}}});}
  const preview=await f.call('createPreviewIntent',{...await conditional(),datasetId:d.datasetId,expiresAt:new Date(Date.now()+expiresInMs).toISOString()});return {d,preview};
 };
 const original=await create(),backend=local?.backend??new ControlledPreviewBackend();
 return {...f,...original,policy,policyHash:registration.policyHash,principalId,storage,backend,local,readEffect,view,lifecycle,create,stopInput:p=>({meta:meta(p.previewId),runId:f.p.runId,previewId:p.previewId,previewRevision:p.revision,impactReviewHash:p.impactReviewHash,reason:'USER'})};
}
