// Explicit container/health fact provider. This is not a container runtime or
// production adapter and must never be used to claim real image health.
import {previewStartRequest,previewStopRequest} from '../../packages/storage-sqlite/dist/index.mjs';
export class ControlledPreviewBackend {
 configured=true;facts=new Map();starts=[];stops=[];queries=[];loseStart=false;loseStop=false;unknownStop=false;
 async preflight(effect,dataset){if(effect.kind==='PREVIEW_START'){const r=previewStartRequest.parse(effect.request);if(r.datasetOperationId!==dataset.operationId||r.datasetId!==dataset.datasetId||dataset.state!=='SUCCEEDED')throw Error('explicit fixture dataset binding mismatch');}else previewStopRequest.parse(effect.request);}
 async execute(effect,dataset,authorize){await this.preflight(effect,dataset);if(!await authorize())throw Error('explicit fixture authorization denied');
  if(effect.kind==='PREVIEW_START'){this.starts.push(effect.operationId);this.facts.set(effect.previewId,{state:'HEALTHY',instanceId:'container.original.'+effect.previewId,endpoint:{host:'127.0.0.1',port:54321}});if(this.loseStart){this.loseStart=false;throw Error('explicit lost start ACK');}}
  else{this.stops.push(effect.operationId);const previous=this.facts.get(effect.previewId);if(previous?.instanceId!==effect.request.instanceId)throw Error('explicit fixture wrong stop instance');if(!this.unknownStop)this.facts.set(effect.previewId,{state:'EXITED',instanceId:previous.instanceId,endpoint:null});if(this.loseStop){this.loseStop=false;throw Error('explicit lost stop ACK');}}
  return this.inspect(effect);
 }
 async inspect(effect){this.queries.push(effect.operationId);const saved=this.facts.get(effect.previewId)??{state:'UNKNOWN',instanceId:null,endpoint:null},fact={previewId:effect.previewId,datasetId:effect.datasetId,imageDigest:effect.request.imageDigest,...saved,checkedAt:new Date().toISOString()};let observation;
  if(effect.kind==='PREVIEW_START'&&fact.state==='HEALTHY')observation={state:'SUCCEEDED',receipt:{kind:'PREVIEW_READY',previewId:effect.previewId,datasetId:effect.datasetId,imageDigest:effect.request.imageDigest,instanceId:fact.instanceId,healthy:true,checkedAt:fact.checkedAt}};
  else if(effect.kind==='PREVIEW_START'&&fact.state==='EXITED')observation={state:'FAILED',errorCode:'PREVIEW_ORIGINAL_EXITED',absenceVerified:true};
  else if(effect.kind==='PREVIEW_STOP'&&fact.state==='EXITED')observation={state:'SUCCEEDED',receipt:{kind:'PREVIEW_STOPPED',previewId:effect.previewId,instanceId:fact.instanceId,exitVerified:true,checkedAt:fact.checkedAt}};
  else observation={state:'UNKNOWN',errorCode:'PREVIEW_ORIGINAL_UNVERIFIED'};return {observation,fact};
 }
}
