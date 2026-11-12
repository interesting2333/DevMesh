import {releaseFreezeFixture} from './release-freeze.mjs';
import {meta,hash} from './storage-data.mjs';
export async function previewIntentFixture(t){
 const f=await releaseFreezeFixture(t),candidate=await f.freeze(),principalId='preview.backend.local';
 const policy={schemaVersion:'devmesh.preview-backend.v1',backendPrincipalId:principalId,backendRef:'sqlite.local-development.v1',runnerId:'runner.preview.local',templateVersion:candidate.manifest.delivery.record.dataPlan.templateVersion,schemaRevision:'schema.v1',retentionDays:30,initialModes:['EMPTY','DEMO'],allowSnapshots:true};
 const configured=await f.storage.request('registerPreviewBackendPolicy',{principalId:'user_1',projectId:f.p.projectId,policy});
 const conditional=async()=>({meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+(await f.storage.request('getRun',{runId:f.p.runId})).resourceRevision+'"',candidateId:candidate.candidateId,manifestHash:candidate.manifestHash});
 const datasetInput=async(overrides={})=>({...await conditional(),policyHash:configured.policyHash,...overrides});
 const createDataset=async(overrides={})=>f.storage.request('createPreviewDataset',await datasetInput(overrides));
 const readEffect=operationId=>f.storage.request('getPreviewEffect',{principalId,operationId});
 const bound=e=>({principalId,operationId:e.operationId,requestHash:e.requestHash,expectedRevision:e.revision});
 const sent=async e=>(await f.storage.request('markPreviewEffectSent',bound(e))).effect;
 const observe=(e,observation)=>f.storage.request('recordPreviewEffectObservation',{...bound(e),observation});
 const readyDataset=async d=>{const e=await sent(await readEffect(d.operationId));await observe(e,{state:'SUCCEEDED',receipt:{kind:'DATASET_READY',datasetId:d.datasetId,storageKey:d.storageKey,originDatasetId:d.sourceDatasetId,schemaRevision:d.schemaRevision,snapshotAt:new Date().toISOString(),sha256:hash('controlled dataset receipt; no actual snapshot in these intent tests'),byteSize:4096,integrity:'ok'}});return f.storage.request('getPreviewDataset',{principalId:'user_1',runId:f.p.runId,datasetId:d.datasetId});};
 const createPreview=async d=>f.storage.request('createPreviewIntent',{...await conditional(),datasetId:d.datasetId,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const readyPreview=async p=>{const e=await sent(await readEffect(p.operationId));await observe(e,{state:'SUCCEEDED',receipt:{kind:'PREVIEW_READY',previewId:p.previewId,datasetId:p.datasetId,imageDigest:p.imageDigest,instanceId:'instance.original.'+p.previewId,healthy:true,checkedAt:new Date().toISOString()}});return f.storage.request('getPreview',{principalId:'user_1',runId:f.p.runId,previewId:p.previewId});};
 const stopInput=p=>({meta:meta(p.previewId),runId:f.p.runId,previewId:p.previewId,previewRevision:p.revision,impactReviewHash:p.impactReviewHash,reason:'USER'});
 return {...f,candidate,principalId,policy,configured,conditional,datasetInput,createDataset,readEffect,bound,sent,observe,readyDataset,createPreview,readyPreview,stopInput};
}
