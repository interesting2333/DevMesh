import {setTimeout as delay} from 'node:timers/promises';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,PreviewEffect,DatasetPreparationBackend} from '@devmesh/storage-sqlite';
import {DatasetPreparer} from './dataset-preparer.js';

export interface PreviewDatasetBinding {
 projectId:string;policyHash:string;principalId:string;backendRef:string;runnerId:string;
 backend:DatasetPreparationBackend;
}
export interface PreviewDatasetConsumerOptions {
 bindings:readonly PreviewDatasetBinding[];
 pollIntervalMs?:number;maxConcurrentProjects?:number;maxScopesPerPass?:number;pageSize?:number;
}
type Scope={binding:Readonly<PreviewDatasetBinding>;manager:DatasetPreparer;cursor:number};
const invalid=():never=>{throw new StorageError('DATASET_CONSUMER_CONFIG_INVALID',422,'Explicit bounded trusted dataset bindings are required');};

/** Consume recorded dataset preparation only. No new owner decisions or acceptance. */
export class PreviewDatasetConsumer {
 readonly #stop=new AbortController();readonly #scopes:Scope[];
 readonly #limits:{pollIntervalMs:number;maxConcurrentProjects:number;maxScopesPerPass:number;pageSize:number};
 #nextScope=0;#loop:Promise<void>|undefined;#pass:Promise<void>|undefined;#drain:Promise<void>|undefined;
 lastError:string|null=null;
 private constructor(readonly storage:Pick<SqliteStorage,'request'>,options:PreviewDatasetConsumerOptions){
  const limit=(v:number|undefined,fallback:number,min:number,max:number)=>{const n=v??fallback;if(!Number.isSafeInteger(n)||n<min||n>max)invalid();return n;};
  if(!Array.isArray(options.bindings)||options.bindings.length<1||options.bindings.length>32)invalid();
  this.#limits={pollIntervalMs:limit(options.pollIntervalMs,5000,1000,10000),maxConcurrentProjects:limit(options.maxConcurrentProjects,2,1,2),maxScopesPerPass:limit(options.maxScopesPerPass,32,1,32),pageSize:limit(options.pageSize,1,1,20)};
  const projects=new Set<string>();
  this.#scopes=options.bindings.map(input=>{
   const binding=Object.freeze({projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),principalId:opaqueKey.parse(input.principalId),backendRef:opaqueKey.parse(input.backendRef),runnerId:opaqueKey.parse(input.runnerId),backend:input.backend});
   if(projects.has(binding.projectId)||!binding.backend?.configured||['preflight','prepare','inspect'].some(k=>typeof binding.backend[k as keyof DatasetPreparationBackend]!=='function'))invalid();
   projects.add(binding.projectId);
   const check=(e:PreviewEffect)=>{if(e.kind!=='DATASET_PREPARE'||e.previewId!==null||e.projectId!==binding.projectId||e.policyHash!==binding.policyHash||e.request.projectId!==binding.projectId||e.request.policyHash!==binding.policyHash||e.request.backendRef!==binding.backendRef||e.request.runnerId!==binding.runnerId)throw new StorageError('DATASET_RECOVERY_SCOPE_CHANGED',409,'Original dataset binding changed');};
   const backend=binding.backend,preflight=backend.preflight.bind(backend),prepare=backend.prepare.bind(backend),inspect=backend.inspect.bind(backend);
   const scoped:DatasetPreparationBackend={get configured(){return backend.configured;},async preflight(e){check(e);await preflight(e);},async prepare(e,authorize){check(e);return prepare(e,authorize);},async inspect(e){check(e);return inspect(e);}};
   return {binding,manager:new DatasetPreparer(storage,binding.principalId,scoped),cursor:0};
  });
 }
 static async create(storage:Pick<SqliteStorage,'request'>,options:PreviewDatasetConsumerOptions){
  const consumer=new PreviewDatasetConsumer(storage,options);
  for(const {binding:b} of consumer.#scopes){const {policy}=await storage.request('getPreviewLifecycleScope',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash});if(policy.backendPrincipalId!==b.principalId||policy.backendRef!==b.backendRef||policy.runnerId!==b.runnerId)invalid();}
  return consumer;
 }
 tick():Promise<void>{if(this.#stop.signal.aborted)return Promise.resolve();return this.#pass??=this.consume().finally(()=>{this.#pass=undefined;});}
 private async consume(){
  const count=Math.min(this.#limits.maxScopesPerPass,this.#scopes.length),scopes=Array.from({length:count},(_,i)=>this.#scopes[(this.#nextScope+i)%this.#scopes.length]!);this.#nextScope=(this.#nextScope+count)%this.#scopes.length;
  for(let i=0;i<scopes.length&&!this.#stop.signal.aborted;i+=this.#limits.maxConcurrentProjects)await Promise.all(scopes.slice(i,i+this.#limits.maxConcurrentProjects).map(s=>this.consumeScope(s)));
 }
 private async consumeScope(scope:Scope){
  const {binding:b}=scope;
  try{
   if(this.#stop.signal.aborted)return;
   if(!b.backend.configured)throw new StorageError('DATASET_BACKEND_NOT_CONFIGURED',503,'Original trusted backend unavailable');
   const page=await this.storage.request('listPreviewDatasetWork',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash,afterSequence:scope.cursor,limit:this.#limits.pageSize});scope.cursor=page.nextSequence??0;
   for(const {effect:e} of page.items){
    if(this.#stop.signal.aborted)return;
    if(e.projectId!==b.projectId||e.policyHash!==b.policyHash)throw new StorageError('DATASET_RECOVERY_SCOPE_CHANGED',409,'Original dataset work changed');
    try{await scope.manager.advance(e.operationId);}catch(error){this.recordError(error);}
   }
  }catch(error){this.recordError(error);}
 }
 private recordError(error:unknown){if(this.#stop.signal.aborted)return;const code=error instanceof StorageError?error.code:'';this.lastError=/^[A-Z][A-Z0-9_]{0,95}$/.test(code)?code:'DATASET_RECOVERY_UNAVAILABLE';}
 start(){
  if(this.#loop||this.#stop.signal.aborted)throw new Error('Preview dataset consumer can only start once');
  this.#loop=(async()=>{while(!this.#stop.signal.aborted){await this.tick();try{await delay(this.#limits.pollIntervalMs,undefined,{signal:this.#stop.signal});}catch{break;}}})();
 }
 stopAdmission(){this.#stop.abort();for(const s of this.#scopes)s.manager.stopAdmission();}
 stop():Promise<void>{this.stopAdmission();return this.#drain??=Promise.all([this.#loop,this.#pass]).then(()=>undefined);}
}
