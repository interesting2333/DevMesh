import {StorageError,previewRuntimeFact} from '@devmesh/storage-sqlite';
import type {SqliteStorage,PreviewEffect,PreviewExecutionBackend,PreviewExecutionResult,PreviewLifecycle} from '@devmesh/storage-sqlite';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
export interface PreviewRecoveryScope {projectId:string;policyHash:string}
export class PreviewLifecycleManager {
 #timer:NodeJS.Timeout|undefined;#tick:Promise<void>|undefined;#closed=false;
 constructor(readonly storage:Pick<SqliteStorage,'request'>,readonly principalId:string,readonly backend?:PreviewExecutionBackend){opaqueKey.parse(principalId);}
 #subject(effect:PreviewEffect){return {principalId:this.principalId,operationId:effect.operationId,requestHash:effect.requestHash};}
 #lifecycle(previewId:string){return this.storage.request('getPreviewLifecycle',{principalId:this.principalId,previewId:ids.preview.parse(previewId)});}
 #configured(){if(!this.backend?.configured)throw new StorageError('PREVIEW_BACKEND_NOT_CONFIGURED',503,'An explicit trusted preview execution backend is required');return this.backend;}
 async #runtime(before:PreviewLifecycle,result:PreviewExecutionResult){
  // The sequence captured before I/O prevents an older health response from
  // overwriting a later observation from another recovery controller.
  return this.storage.request('recordPreviewRuntimeObservation',{...this.#subject(before.startEffect),expectedSequence:before.runtime?.sequence??0,fact:previewRuntimeFact.parse(result.fact)});
 }
 async advance(operationId:string):Promise<PreviewEffect>{
  let effect=await this.storage.request('getPreviewEffect',{principalId:this.principalId,operationId:ids.operation.parse(operationId)});
  if(effect.kind==='DATASET_PREPARE')throw new StorageError('PREVIEW_OPERATION_REQUIRED',422,'Use the dataset preparer for data operations');
  if(effect.state==='SUCCEEDED'||effect.state==='FAILED')return effect;
  const backend=this.#configured();let before=await this.#lifecycle(effect.previewId!),dispatch=false;
  if(effect.kind==='PREVIEW_START'&&effect.state==='PREPARED'&&Date.parse(before.preview.expiresAt)<=Date.now())return this.storage.request('recordPreviewEffectObservation',{...this.#subject(effect),expectedRevision:effect.revision,observation:{state:'FAILED',errorCode:'PREVIEW_EXPIRED_WITHOUT_DISPATCH',absenceVerified:true}});
  if(effect.state==='PREPARED'){
   await backend.preflight(effect,before.datasetEffect);
   const grant=await this.storage.request('markPreviewEffectSent',{...this.#subject(effect),expectedRevision:effect.revision});effect=grant.effect;dispatch=grant.dispatch;
   if(effect.state==='SUCCEEDED'||effect.state==='FAILED')return effect;
  }
  before=await this.#lifecycle(effect.previewId!);
  let result:PreviewExecutionResult;
  try{result=dispatch?await backend.execute(effect,before.datasetEffect,async()=>{const allowed=await this.storage.request('verifyPreviewExecution',this.#subject(effect));return allowed.allowed;}):await backend.inspect(effect);}
  catch{result={observation:{state:'UNKNOWN',errorCode:'PREVIEW_BACKEND_UNCERTAIN'},fact:{previewId:effect.previewId!,datasetId:effect.datasetId,imageDigest:before.preview.imageDigest,state:'UNKNOWN',instanceId:null,endpoint:null,checkedAt:new Date().toISOString()}};}
  await this.#runtime(before,result);
  const current=await this.storage.request('getPreviewEffect',{principalId:this.principalId,operationId:effect.operationId});
  if(current.state==='SUCCEEDED'||current.state==='FAILED')return current;
  return this.storage.request('recordPreviewEffectObservation',{...this.#subject(current),expectedRevision:current.revision,observation:result.observation});
 }
 async reconcilePreview(previewId:string){
  let current=await this.#lifecycle(previewId);const backend=this.#configured();
  if(!['SUCCEEDED','FAILED'].includes(current.startEffect.state))await this.advance(current.startEffect.operationId);
  else if(current.startEffect.state==='SUCCEEDED'&&!['STOPPED','EXPIRED'].includes(current.preview.state)){
   let result:PreviewExecutionResult;
   try{result=await backend.inspect(current.startEffect);}
   catch{result={observation:{state:'UNKNOWN',errorCode:'PREVIEW_BACKEND_UNCERTAIN'},fact:{previewId,datasetId:current.preview.datasetId,imageDigest:current.preview.imageDigest,state:'UNKNOWN',instanceId:null,endpoint:null,checkedAt:new Date().toISOString()}};}
   await this.#runtime(current,result);
  }
  current=await this.#lifecycle(previewId);
  if(current.stopEffect&&!['SUCCEEDED','FAILED'].includes(current.stopEffect.state))await this.advance(current.stopEffect.operationId);
  current=await this.#lifecycle(previewId);
  if(!current.accepted&&!current.stopEffect&&current.preview.instanceId&&['READY','STARTING','UNKNOWN'].includes(current.preview.state)&&Date.parse(current.preview.expiresAt)<=Date.now()){
   const stopped=await this.storage.request('preparePreviewExpiry',{principalId:this.principalId,previewId});await this.advance(stopped.stopOperationId!);
  }
  return (await this.#lifecycle(previewId)).preview;
 }
 async reconcilePage(input:PreviewRecoveryScope&{afterSequence?:number;limit?:number}){
  const page=await this.storage.request('listPreviewLifecycles',{principalId:this.principalId,projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),...(input.afterSequence===undefined?{}:{afterSequence:input.afterSequence}),...(input.limit===undefined?{}:{limit:input.limit})}),results=[];
  for(const item of page.items){const id=item.lifecycle.preview.previewId;try{const preview=await this.reconcilePreview(id);results.push({previewId:id,state:preview.state,errorCode:null});}catch(error){results.push({previewId:id,state:item.lifecycle.preview.state,errorCode:error instanceof StorageError?error.code:'PREVIEW_RECOVERY_UNAVAILABLE'});}}
  return {results,nextSequence:page.nextSequence};
 }
 async start(scopes:readonly PreviewRecoveryScope[],options:{pollIntervalMs?:number;onError?:(code:string)=>void}={}){
  const interval=options.pollIntervalMs??10000;if(this.#timer||this.#closed||scopes.length<1||scopes.length>32||!Number.isInteger(interval)||interval<1000||interval>30000)throw new StorageError('PREVIEW_RECOVERY_CONFIG_INVALID',422,'A bounded explicit recovery scope is required');
  this.#configured();const fixed=scopes.map(s=>({projectId:ids.project.parse(s.projectId),policyHash:sha256.parse(s.policyHash)}));
  const cycle=async()=>{for(const scope of fixed){let cursor:number|undefined;do{const page=await this.reconcilePage({...scope,...(cursor===undefined?{}:{afterSequence:cursor})});for(const r of page.results)if(r.errorCode)options.onError?.(r.errorCode);cursor=page.nextSequence??undefined;}while(cursor!==undefined&&!this.#closed);}};
  this.#tick=cycle();try{await this.#tick;}finally{this.#tick=undefined;}
  if(!this.#closed){this.#timer=setInterval(()=>{if(!this.#tick)this.#tick=cycle().catch(()=>options.onError?.('PREVIEW_RECOVERY_UNAVAILABLE')).finally(()=>{this.#tick=undefined;});},interval);this.#timer.unref();}
 }
 async close(){this.#closed=true;clearInterval(this.#timer);await this.#tick;}
}
